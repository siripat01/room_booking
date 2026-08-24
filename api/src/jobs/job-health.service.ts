import type {
  BackgroundJobStatus,
  NotificationJobStatus,
  PrismaClient,
} from "../../generated/prisma/client";

const DEFAULT_MAX_DUE_AGE_MS = 5 * 60_000;
const DEFAULT_BACKGROUND_FAILED_THRESHOLD = 0;
const DEFAULT_NOTIFICATION_FAILED_THRESHOLD = 10;
const DEFAULT_LOCK_TIMEOUT_MS = 5 * 60_000;

function boundedInteger(name: string, fallback: number, minimum: number, maximum: number) {
  const configured = Number(process.env[name] ?? fallback);
  return Number.isInteger(configured) && configured >= minimum && configured <= maximum
    ? configured
    : fallback;
}

function countByStatus<T extends string>(rows: { status: T; _count: { _all: number } }[]) {
  return Object.fromEntries(rows.map(({ status, _count }) => [status, _count._all])) as Partial<
    Record<T, number>
  >;
}

function dueAgeMs(availableAt: Date | undefined, now: Date) {
  return availableAt ? Math.max(0, now.getTime() - availableAt.getTime()) : 0;
}

export type JobHealthSnapshot = Awaited<ReturnType<JobHealthService["getSnapshot"]>>;

export class JobHealthService {
  constructor(private readonly prisma: PrismaClient) {}

  async readiness() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: "healthy" as const, database: "up" as const };
    } catch {
      return { status: "unhealthy" as const, database: "down" as const };
    }
  }

  async getSnapshot(now = new Date()) {
    const maxDueAgeMs = boundedInteger(
      "JOB_HEALTH_MAX_DUE_AGE_MS",
      DEFAULT_MAX_DUE_AGE_MS,
      10_000,
      24 * 60 * 60_000,
    );
    const backgroundFailedThreshold = boundedInteger(
      "JOB_HEALTH_BACKGROUND_FAILED_THRESHOLD",
      DEFAULT_BACKGROUND_FAILED_THRESHOLD,
      0,
      100_000,
    );
    const notificationFailedThreshold = boundedInteger(
      "JOB_HEALTH_NOTIFICATION_FAILED_THRESHOLD",
      DEFAULT_NOTIFICATION_FAILED_THRESHOLD,
      0,
      100_000,
    );
    const staleBefore = new Date(
      now.getTime() -
        boundedInteger(
          "BACKGROUND_JOB_LOCK_TIMEOUT_MS",
          DEFAULT_LOCK_TIMEOUT_MS,
          60_000,
          60 * 60_000,
        ),
    );

    const [
      backgroundRows,
      notificationRows,
      oldestBackground,
      oldestNotification,
      staleBackground,
      staleNotification,
    ] = await Promise.all([
      this.prisma.backgroundJob.groupBy({ by: ["status"], _count: { _all: true } }),
      this.prisma.notificationJob.groupBy({ by: ["status"], _count: { _all: true } }),
      this.prisma.backgroundJob.findFirst({
        where: { status: { in: ["PENDING", "RETRY"] }, availableAt: { lte: now } },
        orderBy: { availableAt: "asc" },
        select: { availableAt: true },
      }),
      this.prisma.notificationJob.findFirst({
        where: { status: { in: ["PENDING", "RETRY"] }, availableAt: { lte: now } },
        orderBy: { availableAt: "asc" },
        select: { availableAt: true },
      }),
      this.prisma.backgroundJob.count({
        where: { status: "PROCESSING", lockedAt: { lt: staleBefore } },
      }),
      this.prisma.notificationJob.count({
        where: { status: "PROCESSING", lockedAt: { lt: staleBefore } },
      }),
    ]);

    const background = countByStatus<BackgroundJobStatus>(backgroundRows);
    const notifications = countByStatus<NotificationJobStatus>(notificationRows);
    const backgroundDueAgeMs = dueAgeMs(oldestBackground?.availableAt, now);
    const notificationDueAgeMs = dueAgeMs(oldestNotification?.availableAt, now);
    const reasons: string[] = [];
    if ((background.FAILED ?? 0) > backgroundFailedThreshold) reasons.push("background-failures");
    if ((notifications.FAILED ?? 0) > notificationFailedThreshold)
      reasons.push("notification-failures");
    if (backgroundDueAgeMs > maxDueAgeMs) reasons.push("background-queue-delayed");
    if (notificationDueAgeMs > maxDueAgeMs) reasons.push("notification-queue-delayed");
    if (staleBackground > 0) reasons.push("background-locks-stale");
    if (staleNotification > 0) reasons.push("notification-locks-stale");

    return {
      status: reasons.length === 0 ? ("healthy" as const) : ("degraded" as const),
      generatedAt: now.toISOString(),
      reasons,
      background: {
        counts: background,
        oldestDueAgeMs: backgroundDueAgeMs,
        staleProcessing: staleBackground,
      },
      notifications: {
        counts: notifications,
        oldestDueAgeMs: notificationDueAgeMs,
        staleProcessing: staleNotification,
      },
    };
  }
}
