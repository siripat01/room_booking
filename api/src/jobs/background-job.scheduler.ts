import type { BackgroundJobType, PrismaClient } from "../../generated/prisma/client";

const DEFAULT_SCHEDULE_INTERVAL_MS = 60_000;
const DEFAULT_MAX_ATTEMPTS = 5;

function scheduleIntervalMs() {
  const configured = Number(process.env.BACKGROUND_JOB_SCHEDULE_INTERVAL_MS ?? DEFAULT_SCHEDULE_INTERVAL_MS);
  return Number.isInteger(configured) && configured >= 10_000 && configured <= 300_000
    ? configured
    : DEFAULT_SCHEDULE_INTERVAL_MS;
}

function configuredMaxAttempts() {
  const configured = Number(process.env.BACKGROUND_JOB_MAX_ATTEMPTS ?? DEFAULT_MAX_ATTEMPTS);
  return Number.isInteger(configured) && configured >= 1 && configured <= 20
    ? configured
    : DEFAULT_MAX_ATTEMPTS;
}

function bucketStart(now: Date, intervalMs: number) {
  return new Date(Math.floor(now.getTime() / intervalMs) * intervalMs);
}

export class BackgroundJobScheduler {
  constructor(private readonly prisma: PrismaClient) {}

  async enqueueDueJobs(now = new Date()) {
    const intervalMs = scheduleIntervalMs();
    const scheduledFor = bucketStart(now, intervalMs);
    const dueTypes = await this.findDueTypes(now);
    const jobs = dueTypes.map((type) => this.job(type, scheduledFor, now));

    // Retention is housekeeping, not latency-sensitive. A daily job prevents an
    // otherwise empty hourly history row and audit event.
    if (scheduledFor.getUTCHours() === 0 && scheduledFor.getUTCMinutes() === 0) {
      jobs.push(this.job("PURGE_JOB_HISTORY", scheduledFor, now));
    }
    if (jobs.length === 0) return { scheduledFor, requested: 0, created: 0 };
    const created = await this.prisma.backgroundJob.createMany({ data: jobs, skipDuplicates: true });
    return { scheduledFor, requested: jobs.length, created: created.count };
  }

  private job(type: BackgroundJobType, scheduledFor: Date, now: Date) {
    return {
      type,
      jobKey: `roomflow:${type}:${scheduledFor.toISOString()}`,
      scheduledFor,
      availableAt: now,
      maxAttempts: configuredMaxAttempts(),
    };
  }

  private async findDueTypes(now: Date): Promise<BackgroundJobType[]> {
    const checkInLate = new Date(now.getTime() - 12 * 60_000);
    const reminder30Start = new Date(now.getTime() + 25 * 60_000);
    const reminder30End = new Date(now.getTime() + 35 * 60_000);
    const checkInReminderStart = new Date(now.getTime() - 5 * 60_000);
    const checkInReminderEnd = new Date(now.getTime() + 5 * 60_000);

    const [expired, expiredPro, checkout, reminder30, checkInReminder, waitlist] = await Promise.all([
      this.prisma.booking.findFirst({
        where: { status: "CONFIRMED", startTime: { lt: checkInLate } },
        select: { id: true },
      }),
      this.prisma.user.findFirst({
        where: { plan: "PRO", planExpiresAt: { lte: now } },
        select: { id: true },
      }),
      this.prisma.booking.findFirst({
        where: { status: "CHECKED_IN", endTime: { lt: now } },
        select: { id: true },
      }),
      this.prisma.booking.findFirst({
        where: {
          status: "CONFIRMED",
          startTime: { gte: reminder30Start, lte: reminder30End },
          reminder30SentAt: null,
          user: { plan: "PRO" },
        },
        select: { id: true },
      }),
      this.prisma.booking.findFirst({
        where: {
          status: "CONFIRMED",
          startTime: { gte: checkInReminderStart, lte: checkInReminderEnd },
          reminderCheckinSentAt: null,
          user: { plan: "PRO" },
        },
        select: { id: true },
      }),
      this.prisma.waitlistEntry.findFirst({ where: { status: "WAITING" }, select: { id: true } }),
    ]);

    return [
      ...(expired ? ["EXPIRE_BOOKINGS" as const] : []),
      ...(expiredPro ? ["EXPIRE_PRO_ACCESS" as const] : []),
      ...(checkout ? ["AUTO_CHECKOUT" as const] : []),
      ...(reminder30 || checkInReminder ? ["ENQUEUE_REMINDERS" as const] : []),
      ...(waitlist ? ["PROMOTE_WAITLIST" as const] : []),
    ];
  }
}

export { scheduleIntervalMs };
