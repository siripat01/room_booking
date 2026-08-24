import type { Prisma, PrismaClient } from "../../generated/prisma/client";
import { AuditService } from "../audit/audit.service";
import { withSerializableRetry } from "../lib/transaction-retry";

export class RecurringEntitlementService {
  private readonly audit = new AuditService();

  constructor(private readonly prisma: PrismaClient) {}

  async expireDueProAccess(now = new Date()) {
    const candidates = await this.prisma.user.findMany({
      where: { plan: "PRO", planExpiresAt: { lte: now } },
      orderBy: { planExpiresAt: "asc" },
      select: { id: true },
      take: 100,
    });
    let usersExpired = 0;
    let seriesCancelled = 0;
    let bookingsCancelled = 0;

    for (const candidate of candidates) {
      const result = await withSerializableRetry(this.prisma, async (tx) => {
        const updated = await tx.user.updateMany({
          where: { id: candidate.id, plan: "PRO", planExpiresAt: { lte: now } },
          data: { plan: "FREE", planExpiresAt: null },
        });
        if (updated.count !== 1) return { users: 0, series: 0, bookings: 0 };
        const cancelled = await this.cancelForUsers(tx, [candidate.id], now, "pro-expired");
        return { users: 1, ...cancelled };
      });
      usersExpired += result.users;
      seriesCancelled += result.series;
      bookingsCancelled += result.bookings;
    }
    return { usersExpired, seriesCancelled, bookingsCancelled };
  }

  async cancelForStripeCustomer(
    tx: Prisma.TransactionClient,
    stripeCustomerId: string,
    now: Date,
    source: "stripe-subscription-inactive" | "stripe-subscription-deleted",
  ) {
    const users = await tx.user.findMany({
      where: { stripeCustomerId },
      select: { id: true },
    });
    return this.cancelForUsers(
      tx,
      users.map(({ id }) => id),
      now,
      source,
    );
  }

  private async cancelForUsers(
    tx: Prisma.TransactionClient,
    userIds: string[],
    now: Date,
    source: string,
  ) {
    if (userIds.length === 0) return { series: 0, bookings: 0 };
    const series = await tx.bookingSeries.findMany({
      where: { userId: { in: userIds }, status: "ACTIVE" },
      select: { id: true, roomId: true, status: true },
    });
    if (series.length === 0) return { series: 0, bookings: 0 };
    const seriesIds = series.map(({ id }) => id);
    const bookings = await tx.booking.findMany({
      where: {
        seriesId: { in: seriesIds },
        status: { in: ["PENDING", "CONFIRMED"] },
        startTime: { gte: now },
      },
      select: { id: true, roomId: true, seriesId: true, status: true },
      orderBy: [{ startTime: "asc" }, { id: "asc" }],
    });

    for (const booking of bookings) {
      await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: "CANCELLED",
          cancelledAt: now,
          cancelReason: "Recurring booking cancelled because Pro access expired",
          qrTokenHash: null,
          qrExpiresAt: null,
        },
      });
      const event = await tx.bookingEvent.create({
        data: {
          bookingId: booking.id,
          roomId: booking.roomId,
          actorType: "SYSTEM",
          eventType: "CANCELLED",
          previousStatus: booking.status,
          newStatus: "CANCELLED",
          metadata: { source, seriesId: booking.seriesId },
        },
      });
      await this.audit.record(tx, {
        actor: { type: "SYSTEM" },
        targetType: "BOOKING",
        targetId: booking.id,
        sourceEventId: event.id,
        bookingId: booking.id,
        roomId: booking.roomId,
        eventType: "CANCELLED",
        previousStatus: booking.status,
        newStatus: "CANCELLED",
        metadata: { source, seriesId: booking.seriesId },
        createdAt: event.createdAt,
      });
    }

    await tx.bookingSeries.updateMany({
      where: { id: { in: seriesIds }, status: "ACTIVE" },
      data: { status: "CANCELLED", cancelledAt: now },
    });
    for (const item of series) {
      await this.audit.record(tx, {
        actor: { type: "SYSTEM" },
        targetType: "BOOKING_SERIES",
        targetId: item.id,
        roomId: item.roomId,
        eventType: "BOOKING_SERIES_CANCELLED_PRO_EXPIRED",
        previousStatus: item.status,
        newStatus: "CANCELLED",
        metadata: { source },
        createdAt: now,
      });
    }
    return { series: series.length, bookings: bookings.length };
  }
}
