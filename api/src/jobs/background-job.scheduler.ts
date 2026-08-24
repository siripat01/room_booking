import type { BackgroundJobType, PrismaClient } from "../../generated/prisma/client";

const DEFAULT_SCHEDULE_INTERVAL_MS = 60_000;
const DEFAULT_MAX_ATTEMPTS = 5;
const FREQUENT_JOB_TYPES: BackgroundJobType[] = [
  "EXPIRE_BOOKINGS",
  "AUTO_CHECKOUT",
  "ENQUEUE_REMINDERS",
  "PROMOTE_WAITLIST",
];

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
    const jobs = FREQUENT_JOB_TYPES.map((type) => ({
      type,
      jobKey: `roomflow:${type}:${scheduledFor.toISOString()}`,
      scheduledFor,
      availableAt: now,
      maxAttempts: configuredMaxAttempts(),
    }));
    if (scheduledFor.getUTCMinutes() === 0) {
      const hourlyBucket = new Date(scheduledFor);
      hourlyBucket.setUTCMinutes(0, 0, 0);
      jobs.push({
        type: "PURGE_JOB_HISTORY",
        jobKey: `roomflow:PURGE_JOB_HISTORY:${hourlyBucket.toISOString()}`,
        scheduledFor: hourlyBucket,
        availableAt: now,
        maxAttempts: configuredMaxAttempts(),
      });
    }
    const created = await this.prisma.backgroundJob.createMany({ data: jobs, skipDuplicates: true });
    return { scheduledFor, requested: jobs.length, created: created.count };
  }
}

export { scheduleIntervalMs };
