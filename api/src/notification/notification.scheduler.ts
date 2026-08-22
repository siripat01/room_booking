import type { PrismaClient } from "../../generated/prisma/client";
import { NotificationService } from "./notification.service";

export class NotificationScheduler {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly notifications = new NotificationService(prisma),
  ) {}

  async enqueueDueReminders(now = new Date()) {
    const from30 = new Date(now.getTime() + 25 * 60_000);
    const to30 = new Date(now.getTime() + 35 * 60_000);
    const fromCheckIn = new Date(now.getTime() - 5 * 60_000);
    const toCheckIn = new Date(now.getTime() + 5 * 60_000);

    const [reminder30, checkIn] = await Promise.all([
      this.prisma.booking.findMany({
        where: {
          status: "CONFIRMED",
          startTime: { gte: from30, lte: to30 },
          reminder30SentAt: null,
          user: { plan: "PRO" },
        },
        select: { id: true },
        take: 200,
      }),
      this.prisma.booking.findMany({
        where: {
          status: "CONFIRMED",
          startTime: { gte: fromCheckIn, lte: toCheckIn },
          reminderCheckinSentAt: null,
          user: { plan: "PRO" },
        },
        select: { id: true },
        take: 200,
      }),
    ]);

    let queued = 0;
    for (const booking of reminder30) {
      queued += await this.notifications.enqueueReminderAndMark(booking.id, "REMINDER_30", now);
    }
    for (const booking of checkIn) {
      queued += await this.notifications.enqueueReminderAndMark(booking.id, "CHECKIN_REMINDER", now);
    }
    return { reminder30: reminder30.length, checkIn: checkIn.length, queued };
  }
}
