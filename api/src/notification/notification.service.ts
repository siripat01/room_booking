import { Prisma, type PrismaClient } from "../../generated/prisma/client";
import type { NotificationPayload, NotificationTypeName } from "./notification.types";

export type NotificationPreferences = {
  emailEnabled: boolean;
  lineEnabled: boolean;
  bookingUpdatesEnabled: boolean;
  reminder30Enabled: boolean;
  checkInReminderEnabled: boolean;
  waitlistEnabled: boolean;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  emailEnabled: true,
  lineEnabled: true,
  bookingUpdatesEnabled: true,
  reminder30Enabled: true,
  checkInReminderEnabled: true,
  waitlistEnabled: true,
};

export type NotificationPreferenceUpdate = Partial<NotificationPreferences>;

const PREFERENCE_FOR_TYPE: Record<NotificationTypeName, keyof NotificationPreferences | null> = {
  BOOKING_APPROVED: "bookingUpdatesEnabled",
  BOOKING_REJECTED: "bookingUpdatesEnabled",
  REMINDER_30: "reminder30Enabled",
  CHECKIN_REMINDER: "checkInReminderEnabled",
  WAITLIST_PROMOTED: "waitlistEnabled",
  TEST: null,
};

function configuredMaxAttempts() {
  const parsed = Number(process.env.NOTIFICATION_MAX_ATTEMPTS ?? 5);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 20 ? parsed : 5;
}

export class NotificationService {
  constructor(private readonly prisma: PrismaClient) {}

  async getPreferences(userId: string) {
    const preference = await this.prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
    return {
      emailEnabled: preference.emailEnabled,
      lineEnabled: preference.lineEnabled,
      bookingUpdatesEnabled: preference.bookingUpdatesEnabled,
      reminder30Enabled: preference.reminder30Enabled,
      checkInReminderEnabled: preference.checkInReminderEnabled,
      waitlistEnabled: preference.waitlistEnabled,
    };
  }

  async updatePreferences(userId: string, data: NotificationPreferenceUpdate) {
    const allowed = Object.fromEntries(
      Object.entries(data).filter(([, value]) => typeof value === "boolean"),
    ) as NotificationPreferenceUpdate;
    const preference = await this.prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId, ...allowed },
      update: allowed,
    });
    return {
      emailEnabled: preference.emailEnabled,
      lineEnabled: preference.lineEnabled,
      bookingUpdatesEnabled: preference.bookingUpdatesEnabled,
      reminder30Enabled: preference.reminder30Enabled,
      checkInReminderEnabled: preference.checkInReminderEnabled,
      waitlistEnabled: preference.waitlistEnabled,
    };
  }

  async enqueueBooking(type: Exclude<NotificationTypeName, "TEST">, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        purpose: true,
        rejectedReason: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            plan: true,
            lineUserId: true,
            notificationPreference: true,
          },
        },
        room: { select: { name: true, floor: true } },
      },
    });
    if (!booking || !booking.user || booking.user.plan !== "PRO") return 0;

    const payload: NotificationPayload = {
      userName: booking.user.name,
      roomName: booking.room.name,
      roomFloor: booking.room.floor,
      startTime: booking.startTime.toISOString(),
      endTime: booking.endTime.toISOString(),
      purpose: booking.purpose,
      reason: booking.rejectedReason,
    };
    return this.enqueue({
      userId: booking.user.id,
      bookingId: booking.id,
      type,
      payload,
      email: booking.user.email,
      lineUserId: booking.user.lineUserId,
      preference: booking.user.notificationPreference,
      idempotencyScope: `booking:${booking.id}`,
    });
  }

  async enqueueTest(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        lineUserId: true,
        isSystem: true,
        notificationPreference: true,
      },
    });
    if (!user || user.isSystem) throw new Error("User not found");
    return this.enqueue({
      userId,
      bookingId: null,
      type: "TEST",
      payload: { userName: user.name },
      email: user.email,
      lineUserId: user.lineUserId,
      preference: user.notificationPreference,
      idempotencyScope: `test:${userId}:${crypto.randomUUID()}`,
    });
  }

  async enqueueConfirmedBooking(bookingId: string, now = new Date()) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: { status: true, startTime: true },
    });
    if (!booking || booking.status !== "CONFIRMED") return 0;

    let created = await this.enqueueBooking("BOOKING_APPROVED", bookingId);
    const minutesUntilStart = (booking.startTime.getTime() - now.getTime()) / 60_000;
    if (minutesUntilStart > 5 && minutesUntilStart <= 35) {
      created += await this.enqueueReminderAndMark(bookingId, "REMINDER_30", now);
    }
    if (minutesUntilStart <= 5 && minutesUntilStart >= -12) {
      created += await this.enqueueReminderAndMark(bookingId, "CHECKIN_REMINDER", now);
    }
    return created;
  }

  async enqueueReminderAndMark(
    bookingId: string,
    type: "REMINDER_30" | "CHECKIN_REMINDER",
    now = new Date(),
  ) {
    const created = await this.enqueueBooking(type, bookingId);
    if (type === "REMINDER_30") {
      await this.prisma.booking.updateMany({
        where: { id: bookingId, reminder30SentAt: null },
        data: { reminder30SentAt: now },
      });
    } else {
      await this.prisma.booking.updateMany({
        where: { id: bookingId, reminderCheckinSentAt: null },
        data: { reminderCheckinSentAt: now },
      });
    }
    return created;
  }

  async safelyEnqueueBooking(type: Exclude<NotificationTypeName, "TEST">, bookingId: string) {
    try {
      return await this.enqueueBooking(type, bookingId);
    } catch (error) {
      console.error(`[notification] Failed to enqueue ${type} for booking ${bookingId}`, error);
      return 0;
    }
  }

  async safelyEnqueueConfirmedBooking(bookingId: string, now = new Date()) {
    try {
      return await this.enqueueConfirmedBooking(bookingId, now);
    } catch (error) {
      console.error(`[notification] Failed to enqueue confirmation for booking ${bookingId}`, error);
      return 0;
    }
  }

  private async enqueue(input: {
    userId: string;
    bookingId: string | null;
    type: NotificationTypeName;
    payload: NotificationPayload;
    email: string;
    lineUserId: string | null;
    preference: null | (NotificationPreferences & { userId?: string });
    idempotencyScope: string;
  }) {
    const preference = input.preference ?? DEFAULT_NOTIFICATION_PREFERENCES;
    const typePreference = PREFERENCE_FOR_TYPE[input.type];
    if (typePreference && !preference[typePreference]) return 0;

    const jobs: Prisma.NotificationJobCreateManyInput[] = [];
    const common = {
      userId: input.userId,
      bookingId: input.bookingId,
      type: input.type,
      payload: input.payload as Prisma.InputJsonValue,
      maxAttempts: configuredMaxAttempts(),
    };
    if (preference.emailEnabled && input.email) {
      jobs.push({
        ...common,
        channel: "EMAIL",
        idempotencyKey: `roomflow:${input.type}:${input.idempotencyScope}:email`,
      });
    }
    if (preference.lineEnabled && input.lineUserId) {
      jobs.push({
        ...common,
        channel: "LINE",
        idempotencyKey: `roomflow:${input.type}:${input.idempotencyScope}:line`,
      });
    }
    if (jobs.length === 0) return 0;

    const created = await this.prisma.notificationJob.createMany({ data: jobs, skipDuplicates: true });
    return created.count;
  }
}
