import type { Prisma, PrismaClient } from "../../generated/prisma/client";
import { isExclusionConstraintError, withSerializableRetry } from "../lib/transaction-retry";
import { bangkokDayBounds, getBangkokDateTime } from "../lib/bangkok-time";
import { BookingPolicyError } from "./booking.errors";
import { BookingPolicyService } from "./booking-policy.service";
import {
  CHECK_IN_LATE_MINUTES,
  CheckInPolicyService,
} from "../check-in/check-in-policy.service";
import { CheckInPolicyError } from "../check-in/check-in.errors";
import { generateOpaqueToken, hashOpaqueToken } from "../lib/opaque-token";
import { NotificationService } from "../notification/notification.service";

type BookingStatus = "PENDING" | "CONFIRMED" | "CHECKED_IN" | "COMPLETED" | "CANCELLED" | "REJECTED" | "EXPIRED";
type BookingActorType = "USER" | "ADMIN" | "DEVICE" | "SYSTEM";
type BookingEventType = "CREATED" | "APPROVED" | "REJECTED" | "CANCELLED" | "CHECKED_IN" | "COMPLETED" | "EXPIRED";

export type BookingActor = {
  type: BookingActorType;
  id?: string;
  correlationId?: string;
  metadata?: Record<string, string | number | boolean | null>;
};

type CreateBookingData = {
  userId: string;
  roomId: string;
  startTime: Date;
  endTime: Date;
  attendees: number;
  purpose?: string;
  autoConfirm?: boolean;
  approvedBy?: string;
  userRole?: string;
  actor?: BookingActor;
};

const TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  PENDING: ["CONFIRMED", "REJECTED", "CANCELLED"],
  CONFIRMED: ["CHECKED_IN", "CANCELLED", "EXPIRED"],
  CHECKED_IN: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
  REJECTED: [],
  EXPIRED: [],
};

const EVENT_FOR_STATUS: Record<Exclude<BookingStatus, "PENDING">, BookingEventType> = {
  CONFIRMED: "APPROVED",
  CHECKED_IN: "CHECKED_IN",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
  REJECTED: "REJECTED",
  EXPIRED: "EXPIRED",
};

function withoutQrTokenHash<T extends { qrTokenHash: string | null }>(booking: T) {
  const { qrTokenHash: _qrTokenHash, ...safeBooking } = booking;
  return safeBooking;
}

export class BookingService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly policy = new BookingPolicyService(),
    private readonly checkInPolicy: CheckInPolicyService = new CheckInPolicyService(),
    private readonly notifications = new NotificationService(prisma),
  ) {}

  async createBooking(data: CreateBookingData) {
    try {
      const booking = await withSerializableRetry(this.prisma, async (tx) => {
        const context = await this.policy.validateCreate(tx, data);
        const autoConfirm = data.autoConfirm ?? (context.room.autoApprove || ["teacherRole", "adminRole"].includes(context.userRole));
        const status: BookingStatus = autoConfirm ? "CONFIRMED" : "PENDING";
        const actor = data.actor ?? this.userActor(data.userId, data.userRole);

        const created = await tx.booking.create({
          data: {
            userId: data.userId,
            roomId: data.roomId,
            startTime: data.startTime,
            endTime: data.endTime,
            attendees: data.attendees,
            purpose: data.purpose,
            status,
            approvedAt: autoConfirm ? new Date() : undefined,
            approvedBy: autoConfirm ? (data.approvedBy ?? data.userId) : undefined,
          },
          include: {
            room: { select: { name: true, floor: true } },
            user: { select: { name: true, email: true, plan: true } },
          },
        });

        await this.recordEvent(tx, {
          bookingId: created.id,
          roomId: created.roomId,
          actor,
          eventType: "CREATED",
          previousStatus: null,
          newStatus: status,
          metadata: autoConfirm ? { autoConfirmed: true } : undefined,
        });
        return created;
      });

      if (booking.status === "CONFIRMED") {
        await this.notifications.safelyEnqueueConfirmedBooking(booking.id);
      }
      return withoutQrTokenHash(booking);
    } catch (error) {
      if (isExclusionConstraintError(error)) {
        throw new BookingPolicyError(
          "CONCURRENT_BOOKING_CONFLICT",
          "Room or user already has an overlapping active booking",
        );
      }
      throw error;
    }
  }

  async getBookings(userId: string, role: string, params?: { status?: string; roomId?: string; userId?: string; date?: string; page?: number; limit?: number; forSelf?: boolean; search?: string }) {
    const isAdmin = role === "adminRole";
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    const skip = (page - 1) * limit;
    const where: any = (isAdmin && !params?.forSelf) ? {} : { userId };
    if (params?.status) {
      const statuses = params.status.split(",").map((s) => s.trim()).filter(Boolean);
      where.status = statuses.length === 1 ? statuses[0] : { in: statuses };
    }
    if (params?.roomId) where.roomId = params.roomId;
    if (isAdmin && params?.userId) where.userId = params.userId;
    if (params?.date) {
      const { start, end } = bangkokDayBounds(params.date);
      where.startTime = { gte: start, lt: end };
    }
    if (params?.search) {
      const q = params.search;
      where.OR = [
        { room: { name: { contains: q, mode: "insensitive" } } },
        { user: { name: { contains: q, mode: "insensitive" } } },
        { user: { email: { contains: q, mode: "insensitive" } } },
        { purpose: { contains: q, mode: "insensitive" } },
      ];
    }

    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        include: {
          room: { select: { name: true, floor: true } },
          user: { select: { name: true, email: true, image: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.booking.count({ where }),
    ]);
    return {
      bookings: bookings.map((booking) => ({
        ...withoutQrTokenHash(booking),
        checkInWindow: this.checkInPolicy.getWindow(booking.startTime),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getBookingById(id: string, userId: string, role: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        room: true,
        user: { select: { name: true, email: true, image: true } },
        events: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!booking) throw new Error("Booking not found");
    if (role !== "adminRole" && booking.userId !== userId) throw new Error("Unauthorized");
    return { ...withoutQrTokenHash(booking), checkInWindow: this.checkInPolicy.getWindow(booking.startTime) };
  }

  async cancelBooking(id: string, userId: string, role: string, cancelReason?: string, correlationId?: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id } });
    if (!booking) throw new Error("Booking not found");
    if (role !== "adminRole" && booking.userId !== userId) throw new Error("Unauthorized");

    const updated = await this.transitionBooking(
      id,
      "CANCELLED",
      this.userActor(userId, role, correlationId),
      { cancelledAt: new Date(), cancelReason },
      cancelReason ? { reason: cancelReason } : undefined,
    );
    await this.promoteWaitlist(booking.roomId, booking.startTime, booking.endTime);
    return updated;
  }

  async approveBooking(id: string, adminId: string, correlationId?: string) {
    const updated = await this.transitionBooking(
      id,
      "CONFIRMED",
      { type: "ADMIN", id: adminId, correlationId },
      { approvedAt: new Date(), approvedBy: adminId },
    );
    await this.notifications.safelyEnqueueConfirmedBooking(updated.id);
    return updated;
  }

  async rejectBooking(id: string, adminId: string, reason: string, correlationId?: string) {
    const updated = await this.transitionBooking(
      id,
      "REJECTED",
      { type: "ADMIN", id: adminId, correlationId },
      { rejectedReason: reason },
      { reason },
    );
    await this.notifications.safelyEnqueueBooking("BOOKING_REJECTED", updated.id);
    await this.promoteWaitlist(updated.roomId, updated.startTime, updated.endTime);
    return updated;
  }

  async forceDeleteBooking(id: string, adminId: string, correlationId?: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id } });
    if (!booking) throw new Error("Booking not found");
    if (!TRANSITIONS[booking.status as BookingStatus].includes("CANCELLED")) {
      throw new BookingPolicyError("INVALID_STATE_TRANSITION", "Permanent deletion is disabled for audited bookings");
    }
    await this.cancelBooking(id, adminId, "adminRole", "Cancelled by administrator", correlationId);
    return { success: true };
  }

  async generateQr(id: string, userId: string, role: string, now = new Date()) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { room: { select: { name: true } } },
    });
    if (!booking) throw new Error("Booking not found");
    if (role !== "adminRole" && booking.userId !== userId) throw new Error("Unauthorized");
    this.checkInPolicy.assertCanGenerateQr(booking, now);

    const qrToken = generateOpaqueToken("qr_");
    const qrTokenHash = hashOpaqueToken(qrToken);
    const qrExpiresAt = this.checkInPolicy.qrExpiry(booking.startTime, now);
    const updated = await this.prisma.booking.updateMany({
      where: { id, status: "CONFIRMED" },
      data: { qrTokenHash, qrExpiresAt },
    });
    if (updated.count !== 1) {
      throw new CheckInPolicyError("BOOKING_NOT_CONFIRMED", "Booking status changed before QR generation");
    }
    return { qrToken, expiresAt: qrExpiresAt, roomName: booking.room.name };
  }

  async checkInByDevice(
    qrToken: string,
    device: { id: string; roomId: string | null; isActive: boolean; revokedAt: Date | null; credentialVersion: number },
    correlationId?: string,
    now = new Date(),
  ) {
    const qrTokenHash = hashOpaqueToken(qrToken);
    return withSerializableRetry(this.prisma, async (tx) => {
      const currentDevice = await tx.device.findUnique({
        where: { id: device.id },
        select: { id: true, roomId: true, isActive: true, revokedAt: true, credentialVersion: true },
      });
      if (!currentDevice || currentDevice.credentialVersion !== device.credentialVersion) {
        throw new CheckInPolicyError("DEVICE_CREDENTIAL_STALE", "Device credential is no longer current");
      }
      const booking = await tx.booking.findUnique({ where: { qrTokenHash } });
      if (!booking) throw new CheckInPolicyError("INVALID_QR", "Invalid or already-used QR token");

      this.checkInPolicy.assertCanCheckIn(booking, currentDevice, now);

      const updated = await tx.booking.updateMany({
        where: { id: booking.id, status: "CONFIRMED", qrTokenHash },
        data: {
          status: "CHECKED_IN",
          checkedInAt: now,
          qrTokenHash: null,
          qrExpiresAt: null,
        },
      });
      if (updated.count !== 1) {
        throw new CheckInPolicyError("INVALID_QR", "Invalid or already-used QR token");
      }

      await this.recordEvent(tx, {
        bookingId: booking.id,
        roomId: booking.roomId,
        actor: { type: "DEVICE", id: device.id, correlationId },
        eventType: "CHECKED_IN",
        previousStatus: "CONFIRMED",
        newStatus: "CHECKED_IN",
      });
      const checkedIn = await tx.booking.findUniqueOrThrow({
        where: { id: booking.id },
        include: {
          room: { select: { name: true, floor: true } },
          user: { select: { name: true, email: true } },
        },
      });
      return withoutQrTokenHash(checkedIn);
    });
  }

  async createWalkIn(data: {
    device: {
      id: string;
      roomId: string;
      walkInPrincipalId: string;
      isActive: boolean;
      revokedAt: Date | null;
      credentialVersion: number;
    };
    durationMinutes: number;
    attendees: number;
    purpose?: string;
    requesterName: string;
    requesterReference?: string;
    correlationId?: string;
    now?: Date;
  }) {
    const now = data.now ?? new Date();
    const startTime = new Date(now.getTime() + 1_000);
    const endTime = new Date(startTime.getTime() + data.durationMinutes * 60_000);
    return withSerializableRetry(this.prisma, async (tx) => {
      const currentDevice = await tx.device.findUnique({
        where: { id: data.device.id },
        select: {
          id: true,
          roomId: true,
          walkInPrincipalId: true,
          isActive: true,
          revokedAt: true,
          credentialVersion: true,
        },
      });
      if (!currentDevice || currentDevice.credentialVersion !== data.device.credentialVersion) {
        throw new CheckInPolicyError("DEVICE_CREDENTIAL_STALE", "Device credential is no longer current");
      }
      this.checkInPolicy.assertTrustedDevice(currentDevice, data.device.roomId);
      if (!currentDevice.roomId) {
        throw new CheckInPolicyError("DEVICE_NOT_ASSIGNED", "Device is not assigned to a room");
      }
      await this.policy.validateCreate(tx, {
        userId: currentDevice.walkInPrincipalId,
        roomId: currentDevice.roomId,
        startTime,
        endTime,
        attendees: data.attendees,
        userRole: "userRole",
      });

      const actor: BookingActor = {
        type: "DEVICE",
        id: data.device.id,
        correlationId: data.correlationId,
        metadata: {
          source: "walk-in",
          requesterName: data.requesterName,
          requesterReference: data.requesterReference ?? null,
        },
      };
      const booking = await tx.booking.create({
        data: {
          userId: currentDevice.walkInPrincipalId,
          roomId: currentDevice.roomId,
          startTime,
          endTime,
          attendees: data.attendees,
          purpose: data.purpose ?? "Walk-in Booking",
          status: "CONFIRMED",
          approvedAt: now,
          walkInRequesterName: data.requesterName,
          walkInRequesterReference: data.requesterReference,
        },
      });
      await this.recordEvent(tx, {
        bookingId: booking.id,
        roomId: booking.roomId,
        actor,
        eventType: "CREATED",
        previousStatus: null,
        newStatus: "CONFIRMED",
        metadata: { autoConfirmed: true },
      });

      await tx.booking.update({
        where: { id: booking.id },
        data: { status: "CHECKED_IN", checkedInAt: now },
      });
      await this.recordEvent(tx, {
        bookingId: booking.id,
        roomId: booking.roomId,
        actor,
        eventType: "CHECKED_IN",
        previousStatus: "CONFIRMED",
        newStatus: "CHECKED_IN",
      });

      const checkedIn = await tx.booking.findUniqueOrThrow({
        where: { id: booking.id },
        include: {
          room: { select: { name: true, floor: true } },
          user: { select: { name: true } },
        },
      });
      return withoutQrTokenHash(checkedIn);
    });
  }

  async checkOut(id: string, actor: BookingActor = { type: "SYSTEM" }) {
    return this.transitionBooking(id, "COMPLETED", actor, { checkedOutAt: new Date() });
  }

  async expireDueBookings(now = new Date()) {
    const due = await this.prisma.booking.findMany({
      where: { status: "CONFIRMED", startTime: { lt: new Date(now.getTime() - CHECK_IN_LATE_MINUTES * 60_000) } },
      select: { id: true },
      take: 200,
    });
    let count = 0;
    for (const booking of due) {
      try {
        await this.transitionBooking(booking.id, "EXPIRED", { type: "SYSTEM" });
        count++;
      } catch (error) {
        if (!(error instanceof BookingPolicyError && error.code === "INVALID_STATE_TRANSITION")) throw error;
      }
    }
    return count;
  }

  async completeDueBookings(now = new Date()) {
    const due = await this.prisma.booking.findMany({
      where: { status: "CHECKED_IN", endTime: { lt: now } },
      select: { id: true },
      take: 200,
    });
    let count = 0;
    for (const booking of due) {
      try {
        await this.checkOut(booking.id, { type: "SYSTEM" });
        count++;
      } catch (error) {
        if (!(error instanceof BookingPolicyError && error.code === "INVALID_STATE_TRANSITION")) throw error;
      }
    }
    return count;
  }

  async getStats() {
    const today = bangkokDayBounds(getBangkokDateTime(new Date()).date);
    const [totalRooms, pendingBookings, totalUsers, confirmedToday] = await Promise.all([
      this.prisma.room.count({ where: { isActive: true } }),
      this.prisma.booking.count({ where: { status: "PENDING" } }),
      this.prisma.user.count(),
      this.prisma.booking.count({ where: { status: "CONFIRMED", startTime: { gte: today.start, lt: today.end } } }),
    ]);
    return { totalRooms, pendingBookings, totalUsers, confirmedToday };
  }

  async joinWaitlist(data: {
    userId: string;
    roomId: string;
    startTime: Date;
    endTime: Date;
    attendees: number;
    purpose?: string;
    userRole?: string;
  }) {
    return withSerializableRetry(this.prisma, async (tx) => {
      const context = await this.policy.validateCreate(tx, { ...data, allowRoomConflict: true });
      if (context.user.plan !== "PRO") throw new Error("Waitlist requires PRO plan");
      if (!context.roomConflict) throw new Error("Waitlist is only available for an occupied room");

      const existing = await tx.waitlistEntry.findFirst({
        where: { userId: data.userId, roomId: data.roomId, startTime: data.startTime, endTime: data.endTime, status: "WAITING" },
      });
      if (existing) throw new Error("Already on waitlist for this slot");

      return tx.waitlistEntry.create({
        data: {
          userId: data.userId,
          roomId: data.roomId,
          startTime: data.startTime,
          endTime: data.endTime,
          attendees: data.attendees,
          purpose: data.purpose,
        },
        include: { room: { select: { name: true, floor: true } } },
      });
    });
  }

  async leaveWaitlist(id: string, userId: string) {
    const entry = await this.prisma.waitlistEntry.findUnique({ where: { id } });
    if (!entry) throw new Error("Waitlist entry not found");
    if (entry.userId !== userId) throw new Error("Unauthorized");
    if (entry.status !== "WAITING") throw new Error("Cannot cancel a non-waiting entry");
    return this.prisma.waitlistEntry.update({ where: { id }, data: { status: "CANCELLED" } });
  }

  async getUserWaitlist(userId: string) {
    return this.prisma.waitlistEntry.findMany({
      where: { userId, status: "WAITING" },
      include: { room: { select: { name: true, floor: true } } },
      orderBy: { createdAt: "asc" },
    });
  }

  private async promoteWaitlist(roomId: string, startTime: Date, endTime: Date) {
    let promoted: any;
    try {
      promoted = await withSerializableRetry(this.prisma, async (tx) => {
        const entry = await tx.waitlistEntry.findFirst({
          where: { roomId, startTime, endTime, status: "WAITING" },
          orderBy: { createdAt: "asc" },
          include: {
            user: { select: { name: true, email: true, plan: true, role: true } },
            room: { select: { name: true, floor: true } },
          },
        });
        if (!entry) return null;

        const claimed = await tx.waitlistEntry.updateMany({
          where: { id: entry.id, status: "WAITING" },
          data: { status: "PROMOTED", notifiedAt: new Date() },
        });
        if (claimed.count !== 1) return null;

        await this.policy.validateCreate(tx, {
          userId: entry.userId,
          roomId,
          startTime,
          endTime,
          attendees: entry.attendees,
          userRole: entry.user.role ?? "userRole",
        });

        const booking = await tx.booking.create({
          data: {
            userId: entry.userId,
            roomId,
            startTime,
            endTime,
            attendees: entry.attendees,
            purpose: entry.purpose,
            status: "CONFIRMED",
            approvedAt: new Date(),
          },
        });
        await this.recordEvent(tx, {
          bookingId: booking.id,
          roomId,
          actor: { type: "SYSTEM", metadata: { source: "waitlist" } },
          eventType: "CREATED",
          previousStatus: null,
          newStatus: "CONFIRMED",
          metadata: { waitlistEntryId: entry.id, autoConfirmed: true },
        });
        return { entry, bookingId: booking.id };
      });
    } catch (error) {
      if (error instanceof BookingPolicyError || isExclusionConstraintError(error)) return;
      throw error;
    }
    if (!promoted) return;

    await this.notifications.safelyEnqueueBooking("WAITLIST_PROMOTED", promoted.bookingId);
  }

  private async transitionBooking(
    id: string,
    newStatus: Exclude<BookingStatus, "PENDING">,
    actor: BookingActor,
    data: Record<string, unknown> = {},
    metadata?: Record<string, string | number | boolean | null>,
  ) {
    return withSerializableRetry(this.prisma, async (tx) => {
      const booking = await tx.booking.findUnique({ where: { id } });
      if (!booking) throw new Error("Booking not found");
      const previousStatus = booking.status as BookingStatus;
      if (!TRANSITIONS[previousStatus].includes(newStatus)) {
        throw new BookingPolicyError(
          "INVALID_STATE_TRANSITION",
          `Cannot transition booking from ${previousStatus} to ${newStatus}`,
        );
      }

      const updated = await tx.booking.updateMany({
        where: { id, status: previousStatus },
        data: { ...data, status: newStatus } as any,
      });
      if (updated.count !== 1) {
        throw new BookingPolicyError("INVALID_STATE_TRANSITION", "Booking status changed concurrently");
      }

      await this.recordEvent(tx, {
        bookingId: id,
        roomId: booking.roomId,
        actor,
        eventType: EVENT_FOR_STATUS[newStatus],
        previousStatus,
        newStatus,
        metadata,
      });
      const result = await tx.booking.findUniqueOrThrow({
        where: { id },
        include: {
          room: { select: { name: true, floor: true } },
          user: { select: { name: true, email: true, plan: true } },
        },
      });
      return withoutQrTokenHash(result);
    });
  }

  private async recordEvent(
    tx: Prisma.TransactionClient,
    event: {
      bookingId: string;
      roomId: string;
      actor: BookingActor;
      eventType: BookingEventType;
      previousStatus: BookingStatus | null;
      newStatus: BookingStatus;
      metadata?: Record<string, string | number | boolean | null>;
    },
  ) {
    const metadata = { ...(event.actor.metadata ?? {}), ...(event.metadata ?? {}) };
    await tx.bookingEvent.create({
      data: {
        bookingId: event.bookingId,
        roomId: event.roomId,
        actorType: event.actor.type,
        actorId: event.actor.id,
        eventType: event.eventType,
        previousStatus: event.previousStatus,
        newStatus: event.newStatus,
        correlationId: event.actor.correlationId,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      },
    });
  }

  private userActor(userId: string, role?: string, correlationId?: string): BookingActor {
    return { type: role === "adminRole" ? "ADMIN" : "USER", id: userId, correlationId };
  }

}
