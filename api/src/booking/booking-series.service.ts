import type {
  BookingSeries,
  BookingStatus,
  Prisma,
  PrismaClient,
} from "../../generated/prisma/client";
import { AuditService } from "../audit/audit.service";
import {
  addCalendarDays,
  bangkokDateAsUtcDate,
  getBangkokDateTime,
} from "../lib/bangkok-time";
import {
  isExclusionConstraintError,
  withSerializableRetry,
} from "../lib/transaction-retry";
import { NotificationService } from "../notification/notification.service";
import { BookingAlternativeService } from "./booking-alternative.service";
import { BookingPolicyError } from "./booking.errors";
import { BookingPolicyService } from "./booking-policy.service";
import { BookingSeriesError } from "./booking-series.errors";
import {
  generateWeeklyOccurrences,
  type BookingSeriesOccurrence,
} from "./booking-series-recurrence";
import type {
  BookingOccurrencePatch,
  BookingSeriesActor,
  BookingSeriesConflict,
  BookingSeriesPreview,
  BookingSeriesTemplateInput,
  BookingSeriesTemplatePatch,
} from "./booking-series.types";

const CANCELLABLE_STATUSES: BookingStatus[] = ["PENDING", "CONFIRMED"];

class PreviewRollback extends Error {
  constructor(readonly result: BookingSeriesPreview) {
    super("ROLLBACK_BOOKING_SERIES_PREVIEW");
  }
}

function dateString(value: Date) {
  return value.toISOString().slice(0, 10);
}

function clockString(value: Date) {
  const bangkok = getBangkokDateTime(value);
  return `${String(bangkok.hour).padStart(2, "0")}:${String(bangkok.minute).padStart(2, "0")}`;
}

function actorType(role: string) {
  return role === "adminRole" ? ("ADMIN" as const) : ("USER" as const);
}

function safeBookingSelect() {
  return {
    id: true,
    userId: true,
    roomId: true,
    seriesId: true,
    occurrenceDate: true,
    isSeriesException: true,
    startTime: true,
    endTime: true,
    attendees: true,
    purpose: true,
    status: true,
    cancelledAt: true,
    cancelReason: true,
    createdAt: true,
    updatedAt: true,
    room: { select: { id: true, name: true, floor: true } },
  } satisfies Prisma.BookingSelect;
}

export class BookingSeriesService {
  private readonly audit = new AuditService();

  constructor(
    private readonly prisma: PrismaClient,
    private readonly policy = new BookingPolicyService(),
    private readonly alternatives = new BookingAlternativeService(policy),
    private readonly notifications = new NotificationService(prisma),
  ) {}

  async preview(input: BookingSeriesTemplateInput, actor: BookingSeriesActor) {
    const occurrences = generateWeeklyOccurrences(input);
    try {
      await this.prisma.$transaction(
        async (tx) => {
          await this.assertProEntitlement(tx, actor.userId);
          const validOccurrences: BookingSeriesPreview["validOccurrences"] = [];
          const conflicts: BookingSeriesConflict[] = [];

          for (const occurrence of occurrences) {
            const policyInput = this.policyInput(input, occurrence, actor);
            try {
              await this.policy.validateCreate(tx, policyInput);
              await tx.booking.create({
                data: {
                  userId: actor.userId,
                  roomId: input.roomId,
                  startTime: occurrence.startTime,
                  endTime: occurrence.endTime,
                  attendees: input.attendees,
                  purpose: input.purpose,
                  status: "PENDING",
                },
              });
              validOccurrences.push({
                date: occurrence.date,
                startTime: occurrence.startTime.toISOString(),
                endTime: occurrence.endTime.toISOString(),
              });
            } catch (error) {
              if (!(error instanceof BookingPolicyError)) throw error;
              conflicts.push(await this.toConflict(tx, occurrence, policyInput, error));
            }
          }

          throw new PreviewRollback({
            occurrenceCount: occurrences.length,
            validOccurrences,
            conflicts,
            canCreateAtomically: conflicts.length === 0,
          });
        },
        { isolationLevel: "Serializable" },
      );
    } catch (error) {
      if (error instanceof PreviewRollback) return error.result;
      throw error;
    }
    throw new Error("Booking series preview did not roll back");
  }

  async create(input: BookingSeriesTemplateInput, actor: BookingSeriesActor) {
    const occurrences = generateWeeklyOccurrences(input);
    let currentOccurrence = occurrences[0];
    try {
      const result = await withSerializableRetry(this.prisma, async (tx) => {
        await this.assertProEntitlement(tx, actor.userId);
        const series = await tx.bookingSeries.create({
          data: {
            userId: actor.userId,
            roomId: input.roomId,
            startDate: bangkokDateAsUtcDate(input.startDate),
            endDate: bangkokDateAsUtcDate(input.endDate),
            weekdays: input.weekdays,
            startTime: input.startTime,
            endTime: input.endTime,
            attendees: input.attendees,
            purpose: input.purpose,
          },
        });
        const conflicts: BookingSeriesConflict[] = [];
        const confirmedBookingIds: string[] = [];
        const bookingIds: string[] = [];

        for (const occurrence of occurrences) {
          currentOccurrence = occurrence;
          const policyInput = this.policyInput(input, occurrence, actor);
          try {
            const context = await this.policy.validateCreate(tx, policyInput);
            const autoConfirm =
              context.room.autoApprove || ["teacherRole", "adminRole"].includes(context.userRole);
            const status: BookingStatus = autoConfirm ? "CONFIRMED" : "PENDING";
            const booking = await tx.booking.create({
              data: {
                userId: actor.userId,
                roomId: input.roomId,
                seriesId: series.id,
                occurrenceDate: occurrence.occurrenceDate,
                startTime: occurrence.startTime,
                endTime: occurrence.endTime,
                attendees: input.attendees,
                purpose: input.purpose,
                status,
                approvedAt: autoConfirm ? new Date() : undefined,
                approvedBy: autoConfirm ? actor.userId : undefined,
              },
            });
            await this.recordBookingEvent(tx, booking, actor, "CREATED", null, status, {
              seriesId: series.id,
              occurrenceDate: occurrence.date,
              autoConfirmed: autoConfirm,
            });
            bookingIds.push(booking.id);
            if (status === "CONFIRMED") confirmedBookingIds.push(booking.id);
          } catch (error) {
            if (!(error instanceof BookingPolicyError)) throw error;
            conflicts.push(await this.toConflict(tx, occurrence, policyInput, error));
          }
        }

        if (conflicts.length > 0) {
          throw new BookingSeriesError(
            "SERIES_CONFLICT",
            "Recurring booking conflicts with one or more dates",
            conflicts,
          );
        }

        await this.audit.record(tx, {
          actor: {
            type: actorType(actor.role),
            id: actor.userId,
            correlationId: actor.correlationId,
          },
          targetType: "BOOKING_SERIES",
          targetId: series.id,
          roomId: series.roomId,
          eventType: "BOOKING_SERIES_CREATED",
          newStatus: "ACTIVE",
          metadata: {
            occurrenceCount: bookingIds.length,
            startDate: input.startDate,
            endDate: input.endDate,
            weekdays: input.weekdays,
          },
        });
        return { seriesId: series.id, bookingIds, confirmedBookingIds };
      });

      for (const bookingId of result.confirmedBookingIds) {
        await this.notifications.safelyEnqueueConfirmedBooking(bookingId);
      }
      return this.getById(result.seriesId, actor);
    } catch (error) {
      if (isExclusionConstraintError(error)) {
        throw new BookingSeriesError(
          "SERIES_CONFLICT",
          "A concurrent request reserved one of the recurring dates",
          [
            {
              date: currentOccurrence.date,
              startTime: currentOccurrence.startTime.toISOString(),
              endTime: currentOccurrence.endTime.toISOString(),
              code: "CONCURRENT_BOOKING_CONFLICT",
              message: "Room or user already has an overlapping active booking",
              suggestedAlternatives: [],
            },
          ],
        );
      }
      throw error;
    }
  }

  async list(actor: BookingSeriesActor) {
    return this.prisma.bookingSeries.findMany({
      where: actor.role === "adminRole" ? {} : { userId: actor.userId },
      include: {
        room: { select: { id: true, name: true, floor: true } },
        _count: { select: { bookings: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 100,
    });
  }

  async getById(seriesId: string, actor: BookingSeriesActor) {
    const series = await this.prisma.bookingSeries.findUnique({
      where: { id: seriesId },
      include: {
        room: { select: { id: true, name: true, floor: true } },
        bookings: {
          select: safeBookingSelect(),
          orderBy: [{ occurrenceDate: "asc" }, { id: "asc" }],
        },
      },
    });
    if (!series) throw new BookingSeriesError("SERIES_NOT_FOUND", "Booking series not found");
    this.assertOwner(series, actor);
    return series;
  }

  async editOccurrence(
    seriesId: string,
    bookingId: string,
    patch: BookingOccurrencePatch,
    actor: BookingSeriesActor,
  ) {
    return withSerializableRetry(this.prisma, async (tx) => {
      await this.assertProEntitlement(tx, actor.userId);
      const series = await this.findOwnedSeries(tx, seriesId, actor);
      this.assertActiveSeries(series);
      const booking = await tx.booking.findFirst({
        where: { id: bookingId, seriesId },
      });
      if (!booking || !booking.occurrenceDate) {
        throw new BookingSeriesError("OCCURRENCE_NOT_FOUND", "Series occurrence not found");
      }
      if (!CANCELLABLE_STATUSES.includes(booking.status)) {
        throw new BookingSeriesError(
          "INVALID_SERIES_SCOPE",
          `Cannot edit an occurrence in ${booking.status} status`,
        );
      }

      const date = patch.date ?? dateString(booking.occurrenceDate);
      const template: BookingSeriesTemplateInput = {
        roomId: patch.roomId ?? booking.roomId,
        startDate: date,
        endDate: date,
        weekdays: [getBangkokDateTime(new Date(`${date}T05:00:00.000Z`)).dayOfWeek],
        startTime: patch.startTime ?? clockString(booking.startTime),
        endTime: patch.endTime ?? clockString(booking.endTime),
        attendees: patch.attendees ?? booking.attendees,
        purpose: patch.purpose === undefined ? (booking.purpose ?? undefined) : (patch.purpose ?? undefined),
      };
      const occurrence = generateWeeklyOccurrences(template, {
        maxOccurrences: 1,
        maxSpanDays: 1,
      })[0];
      await this.policy.validateCreate(tx, {
        ...this.policyInput(template, occurrence, actor),
        excludeBookingId: booking.id,
      });

      const updated = await tx.booking.update({
        where: { id: booking.id },
        data: {
          roomId: template.roomId,
          occurrenceDate: occurrence.occurrenceDate,
          startTime: occurrence.startTime,
          endTime: occurrence.endTime,
          attendees: template.attendees,
          purpose: template.purpose,
          isSeriesException: true,
          qrTokenHash: null,
          qrExpiresAt: null,
        },
        select: safeBookingSelect(),
      });
      await this.audit.record(tx, {
        actor: {
          type: actorType(actor.role),
          id: actor.userId,
          correlationId: actor.correlationId,
        },
        targetType: "BOOKING",
        targetId: booking.id,
        bookingId: booking.id,
        roomId: updated.roomId,
        eventType: "BOOKING_SERIES_OCCURRENCE_EDITED",
        previousStatus: booking.status,
        newStatus: booking.status,
        metadata: {
          seriesId,
          previousDate: dateString(booking.occurrenceDate),
          newDate: occurrence.date,
        },
      });
      return updated;
    });
  }

  async cancelOccurrence(
    seriesId: string,
    bookingId: string,
    actor: BookingSeriesActor,
    reason = "Recurring occurrence cancelled",
  ) {
    return withSerializableRetry(this.prisma, async (tx) => {
      await this.findOwnedSeries(tx, seriesId, actor);
      const booking = await tx.booking.findFirst({ where: { id: bookingId, seriesId } });
      if (!booking) {
        throw new BookingSeriesError("OCCURRENCE_NOT_FOUND", "Series occurrence not found");
      }
      if (!CANCELLABLE_STATUSES.includes(booking.status)) {
        throw new BookingSeriesError(
          "INVALID_SERIES_SCOPE",
          `Cannot cancel an occurrence in ${booking.status} status`,
        );
      }
      await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancelReason: reason,
          isSeriesException: true,
          qrTokenHash: null,
          qrExpiresAt: null,
        },
      });
      await this.recordBookingEvent(tx, booking, actor, "CANCELLED", booking.status, "CANCELLED", {
        seriesId,
        reason,
        scope: "ONLY_THIS",
      });
      return tx.booking.findUniqueOrThrow({
        where: { id: booking.id },
        select: safeBookingSelect(),
      });
    });
  }

  async cancelSeries(
    seriesId: string,
    scope: "FUTURE" | "ENTIRE",
    actor: BookingSeriesActor,
    fromBookingId?: string,
  ) {
    return withSerializableRetry(this.prisma, async (tx) => {
      const series = await this.findOwnedSeries(tx, seriesId, actor);
      let pivotDate: Date | undefined;
      if (scope === "FUTURE") {
        if (!fromBookingId) {
          throw new BookingSeriesError(
            "INVALID_SERIES_SCOPE",
            "fromBookingId is required when cancelling future occurrences",
          );
        }
        const pivot = await tx.booking.findFirst({
          where: { id: fromBookingId, seriesId },
          select: { occurrenceDate: true },
        });
        if (!pivot?.occurrenceDate) {
          throw new BookingSeriesError("OCCURRENCE_NOT_FOUND", "Series occurrence not found");
        }
        pivotDate = pivot.occurrenceDate;
      }

      const bookings = await tx.booking.findMany({
        where: {
          seriesId,
          status: { in: CANCELLABLE_STATUSES },
          ...(pivotDate ? { occurrenceDate: { gte: pivotDate } } : {}),
        },
        orderBy: { occurrenceDate: "asc" },
      });
      const now = new Date();
      for (const booking of bookings) {
        await tx.booking.update({
          where: { id: booking.id },
          data: {
            status: "CANCELLED",
            cancelledAt: now,
            cancelReason: `Recurring series ${scope.toLowerCase()} cancellation`,
            qrTokenHash: null,
            qrExpiresAt: null,
          },
        });
        await this.recordBookingEvent(
          tx,
          booking,
          actor,
          "CANCELLED",
          booking.status,
          "CANCELLED",
          { seriesId, scope },
        );
      }

      const cancelEntire = scope === "ENTIRE" || !pivotDate || pivotDate <= series.startDate;
      const updatedSeries = await tx.bookingSeries.update({
        where: { id: seriesId },
        data: cancelEntire
          ? { status: "CANCELLED", cancelledAt: now }
          : { endDate: bangkokDateAsUtcDate(addCalendarDays(dateString(pivotDate!), -1)) },
      });
      await this.audit.record(tx, {
        actor: {
          type: actorType(actor.role),
          id: actor.userId,
          correlationId: actor.correlationId,
        },
        targetType: "BOOKING_SERIES",
        targetId: seriesId,
        roomId: series.roomId,
        eventType: scope === "ENTIRE" ? "BOOKING_SERIES_CANCELLED" : "BOOKING_SERIES_FUTURE_CANCELLED",
        previousStatus: series.status,
        newStatus: updatedSeries.status,
        metadata: { cancelledOccurrences: bookings.length, fromDate: pivotDate ? dateString(pivotDate) : null },
      });
      return { series: updatedSeries, cancelledOccurrences: bookings.length };
    });
  }

  async editSeries(
    seriesId: string,
    scope: "THIS_AND_FUTURE" | "WHOLE_SERIES",
    patch: BookingSeriesTemplatePatch,
    actor: BookingSeriesActor,
    fromBookingId?: string,
  ) {
    if (scope === "THIS_AND_FUTURE") {
      return this.splitAndEditFuture(seriesId, patch, actor, fromBookingId);
    }
    return this.editWholeSeries(seriesId, patch, actor);
  }

  private async editWholeSeries(
    seriesId: string,
    patch: BookingSeriesTemplatePatch,
    actor: BookingSeriesActor,
  ) {
    const result = await withSerializableRetry(this.prisma, async (tx) => {
      await this.assertProEntitlement(tx, actor.userId);
      const series = await this.findOwnedSeries(tx, seriesId, actor);
      this.assertActiveSeries(series);
      const template = this.mergeTemplate(series, patch);
      const desired = generateWeeklyOccurrences(template).filter(
        ({ startTime }) => startTime.getTime() > Date.now(),
      );
      if (desired.length === 0) {
        throw new BookingSeriesError("INVALID_RECURRENCE", "Series update has no future occurrences");
      }

      const existing = await tx.booking.findMany({
        where: {
          seriesId,
          status: { in: CANCELLABLE_STATUSES },
          startTime: { gt: new Date() },
        },
        orderBy: { occurrenceDate: "asc" },
      });
      for (const booking of existing) {
        await tx.booking.update({ where: { id: booking.id }, data: { status: "CANCELLED" } });
      }
      const byDate = new Map(existing.map((booking) => [dateString(booking.occurrenceDate!), booking]));
      const desiredDates = new Set(desired.map(({ date }) => date));
      const conflicts: BookingSeriesConflict[] = [];
      const confirmedBookingIds: string[] = [];

      for (const occurrence of desired) {
        const previous = byDate.get(occurrence.date);
        const policyInput = {
          ...this.policyInput(template, occurrence, actor),
          excludeBookingId: previous?.id,
        };
        try {
          const context = await this.policy.validateCreate(tx, policyInput);
          const status = previous?.status ??
            (context.room.autoApprove || ["teacherRole", "adminRole"].includes(context.userRole)
              ? "CONFIRMED"
              : "PENDING");
          if (previous) {
            await tx.booking.update({
              where: { id: previous.id },
              data: {
                roomId: template.roomId,
                startTime: occurrence.startTime,
                endTime: occurrence.endTime,
                attendees: template.attendees,
                purpose: template.purpose,
                status,
                cancelledAt: null,
                cancelReason: null,
                isSeriesException: false,
                qrTokenHash: null,
                qrExpiresAt: null,
              },
            });
          } else {
            const created = await tx.booking.create({
              data: {
                userId: actor.userId,
                roomId: template.roomId,
                seriesId,
                occurrenceDate: occurrence.occurrenceDate,
                startTime: occurrence.startTime,
                endTime: occurrence.endTime,
                attendees: template.attendees,
                purpose: template.purpose,
                status,
              },
            });
            await this.recordBookingEvent(tx, created, actor, "CREATED", null, status, {
              seriesId,
              occurrenceDate: occurrence.date,
              source: "whole-series-edit",
            });
            if (status === "CONFIRMED") confirmedBookingIds.push(created.id);
          }
        } catch (error) {
          if (!(error instanceof BookingPolicyError)) throw error;
          conflicts.push(await this.toConflict(tx, occurrence, policyInput, error));
        }
      }

      if (conflicts.length > 0) {
        throw new BookingSeriesError("SERIES_CONFLICT", "Series update conflicts with one or more dates", conflicts);
      }

      const removed = existing.filter((booking) => !desiredDates.has(dateString(booking.occurrenceDate!)));
      for (const booking of removed) {
        await tx.booking.update({
          where: { id: booking.id },
          data: {
            cancelledAt: new Date(),
            cancelReason: "Removed by whole-series edit",
            isSeriesException: true,
          },
        });
        await this.recordBookingEvent(tx, booking, actor, "CANCELLED", booking.status, "CANCELLED", {
          seriesId,
          scope: "WHOLE_SERIES",
        });
      }

      const updated = await tx.bookingSeries.update({
        where: { id: seriesId },
        data: {
          roomId: template.roomId,
          endDate: bangkokDateAsUtcDate(template.endDate),
          weekdays: template.weekdays,
          startTime: template.startTime,
          endTime: template.endTime,
          attendees: template.attendees,
          purpose: template.purpose,
        },
      });
      await this.auditSeriesEdit(tx, series, updated, actor, "WHOLE_SERIES");
      return { seriesId: updated.id, confirmedBookingIds };
    });
    for (const bookingId of result.confirmedBookingIds) {
      await this.notifications.safelyEnqueueConfirmedBooking(bookingId);
    }
    return this.getById(result.seriesId, actor);
  }

  private async splitAndEditFuture(
    seriesId: string,
    patch: BookingSeriesTemplatePatch,
    actor: BookingSeriesActor,
    fromBookingId?: string,
  ) {
    if (!fromBookingId) {
      throw new BookingSeriesError(
        "INVALID_SERIES_SCOPE",
        "fromBookingId is required for this-and-future edits",
      );
    }
    const result = await withSerializableRetry(this.prisma, async (tx) => {
      await this.assertProEntitlement(tx, actor.userId);
      const series = await this.findOwnedSeries(tx, seriesId, actor);
      this.assertActiveSeries(series);
      const pivot = await tx.booking.findFirst({
        where: { id: fromBookingId, seriesId },
        select: { occurrenceDate: true },
      });
      if (!pivot?.occurrenceDate) {
        throw new BookingSeriesError("OCCURRENCE_NOT_FOUND", "Series occurrence not found");
      }
      const pivotDate = dateString(pivot.occurrenceDate);
      const template = this.mergeTemplate(series, patch, pivotDate);
      const occurrences = generateWeeklyOccurrences(template);

      const oldBookings = await tx.booking.findMany({
        where: {
          seriesId,
          occurrenceDate: { gte: pivot.occurrenceDate },
          status: { in: CANCELLABLE_STATUSES },
        },
      });
      for (const booking of oldBookings) {
        await tx.booking.update({ where: { id: booking.id }, data: { status: "CANCELLED" } });
      }

      const newSeries = await tx.bookingSeries.create({
        data: {
          userId: series.userId,
          roomId: template.roomId,
          startDate: bangkokDateAsUtcDate(template.startDate),
          endDate: bangkokDateAsUtcDate(template.endDate),
          weekdays: template.weekdays,
          startTime: template.startTime,
          endTime: template.endTime,
          attendees: template.attendees,
          purpose: template.purpose,
        },
      });
      const conflicts: BookingSeriesConflict[] = [];
      const confirmedBookingIds: string[] = [];
      for (const occurrence of occurrences) {
        const policyInput = this.policyInput(template, occurrence, actor);
        try {
          const context = await this.policy.validateCreate(tx, policyInput);
          const autoConfirm =
            context.room.autoApprove || ["teacherRole", "adminRole"].includes(context.userRole);
          const status: BookingStatus = autoConfirm ? "CONFIRMED" : "PENDING";
          const booking = await tx.booking.create({
            data: {
              userId: series.userId,
              roomId: template.roomId,
              seriesId: newSeries.id,
              occurrenceDate: occurrence.occurrenceDate,
              startTime: occurrence.startTime,
              endTime: occurrence.endTime,
              attendees: template.attendees,
              purpose: template.purpose,
              status,
            },
          });
          await this.recordBookingEvent(tx, booking, actor, "CREATED", null, status, {
            seriesId: newSeries.id,
            previousSeriesId: series.id,
            occurrenceDate: occurrence.date,
            source: "this-and-future-edit",
          });
          if (status === "CONFIRMED") confirmedBookingIds.push(booking.id);
        } catch (error) {
          if (!(error instanceof BookingPolicyError)) throw error;
          conflicts.push(await this.toConflict(tx, occurrence, policyInput, error));
        }
      }
      if (conflicts.length > 0) {
        throw new BookingSeriesError("SERIES_CONFLICT", "Series update conflicts with one or more dates", conflicts);
      }

      for (const booking of oldBookings) {
        await tx.booking.update({
          where: { id: booking.id },
          data: {
            cancelledAt: new Date(),
            cancelReason: "Replaced by this-and-future series edit",
            isSeriesException: true,
          },
        });
        await this.recordBookingEvent(tx, booking, actor, "CANCELLED", booking.status, "CANCELLED", {
          seriesId,
          replacementSeriesId: newSeries.id,
          scope: "THIS_AND_FUTURE",
        });
      }

      const originalUpdate = pivot.occurrenceDate <= series.startDate
        ? { status: "CANCELLED" as const, cancelledAt: new Date() }
        : { endDate: bangkokDateAsUtcDate(addCalendarDays(pivotDate, -1)) };
      const updatedOriginal = await tx.bookingSeries.update({
        where: { id: series.id },
        data: originalUpdate,
      });
      await this.audit.record(tx, {
        actor: {
          type: actorType(actor.role),
          id: actor.userId,
          correlationId: actor.correlationId,
        },
        targetType: "BOOKING_SERIES",
        targetId: series.id,
        roomId: series.roomId,
        eventType: "BOOKING_SERIES_SPLIT",
        previousStatus: series.status,
        newStatus: updatedOriginal.status,
        metadata: {
          replacementSeriesId: newSeries.id,
          pivotDate,
          replacedOccurrences: oldBookings.length,
        },
      });
      return { seriesId: newSeries.id, confirmedBookingIds };
    });
    for (const bookingId of result.confirmedBookingIds) {
      await this.notifications.safelyEnqueueConfirmedBooking(bookingId);
    }
    return this.getById(result.seriesId, actor);
  }

  private mergeTemplate(
    series: BookingSeries,
    patch: BookingSeriesTemplatePatch,
    startDate = dateString(series.startDate),
  ): BookingSeriesTemplateInput {
    return {
      roomId: patch.roomId ?? series.roomId,
      startDate,
      endDate: patch.endDate ?? dateString(series.endDate),
      weekdays: patch.weekdays ?? series.weekdays,
      startTime: patch.startTime ?? series.startTime,
      endTime: patch.endTime ?? series.endTime,
      attendees: patch.attendees ?? series.attendees,
      purpose: patch.purpose === undefined ? (series.purpose ?? undefined) : (patch.purpose ?? undefined),
    };
  }

  private policyInput(
    template: Pick<BookingSeriesTemplateInput, "roomId" | "attendees">,
    occurrence: BookingSeriesOccurrence,
    actor: BookingSeriesActor,
  ) {
    return {
      userId: actor.userId,
      roomId: template.roomId,
      startTime: occurrence.startTime,
      endTime: occurrence.endTime,
      attendees: template.attendees,
      userRole: actor.role,
    };
  }

  private async toConflict(
    tx: Prisma.TransactionClient,
    occurrence: BookingSeriesOccurrence,
    policyInput: ReturnType<BookingSeriesService["policyInput"]> & { excludeBookingId?: string },
    error: BookingPolicyError,
  ): Promise<BookingSeriesConflict> {
    return {
      date: occurrence.date,
      startTime: occurrence.startTime.toISOString(),
      endTime: occurrence.endTime.toISOString(),
      code: error.code,
      message: error.message,
      suggestedAlternatives: await this.alternatives.suggest(tx, policyInput),
    };
  }

  private async assertProEntitlement(tx: Prisma.TransactionClient, userId: string, now = new Date()) {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { plan: true, planExpiresAt: true },
    });
    const active =
      user?.plan === "PRO" && (!user.planExpiresAt || user.planExpiresAt.getTime() > now.getTime());
    if (!active) {
      throw new BookingSeriesError(
        "PRO_REQUIRED",
        "An active Pro plan is required to create or edit recurring bookings",
      );
    }
  }

  private async findOwnedSeries(
    tx: Prisma.TransactionClient,
    seriesId: string,
    actor: BookingSeriesActor,
  ) {
    const series = await tx.bookingSeries.findUnique({ where: { id: seriesId } });
    if (!series) throw new BookingSeriesError("SERIES_NOT_FOUND", "Booking series not found");
    this.assertOwner(series, actor);
    return series;
  }

  private assertOwner(series: Pick<BookingSeries, "userId">, actor: BookingSeriesActor) {
    if (actor.role !== "adminRole" && series.userId !== actor.userId) {
      throw new BookingSeriesError("UNAUTHORIZED", "You do not have access to this booking series");
    }
  }

  private assertActiveSeries(series: Pick<BookingSeries, "status">) {
    if (series.status !== "ACTIVE") {
      throw new BookingSeriesError("SERIES_CANCELLED", "Booking series is cancelled");
    }
  }

  private async recordBookingEvent(
    tx: Prisma.TransactionClient,
    booking: { id: string; roomId: string },
    actor: BookingSeriesActor,
    eventType: "CREATED" | "CANCELLED",
    previousStatus: BookingStatus | null,
    newStatus: BookingStatus,
    metadata: Prisma.InputJsonObject,
  ) {
    const event = await tx.bookingEvent.create({
      data: {
        bookingId: booking.id,
        roomId: booking.roomId,
        actorType: actorType(actor.role),
        actorId: actor.userId,
        eventType,
        previousStatus,
        newStatus,
        metadata,
        correlationId: actor.correlationId,
      },
    });
    await this.audit.record(tx, {
      actor: {
        type: actorType(actor.role),
        id: actor.userId,
        correlationId: actor.correlationId,
      },
      targetType: "BOOKING",
      targetId: booking.id,
      sourceEventId: event.id,
      bookingId: booking.id,
      roomId: booking.roomId,
      eventType,
      previousStatus,
      newStatus,
      metadata,
      createdAt: event.createdAt,
    });
  }

  private async auditSeriesEdit(
    tx: Prisma.TransactionClient,
    previous: BookingSeries,
    current: BookingSeries,
    actor: BookingSeriesActor,
    scope: string,
  ) {
    await this.audit.record(tx, {
      actor: {
        type: actorType(actor.role),
        id: actor.userId,
        correlationId: actor.correlationId,
      },
      targetType: "BOOKING_SERIES",
      targetId: current.id,
      roomId: current.roomId,
      eventType: "BOOKING_SERIES_EDITED",
      previousStatus: previous.status,
      newStatus: current.status,
      metadata: { scope },
    });
  }
}
