import { Prisma, type PrismaClient } from "../../generated/prisma/client";
import { EmailNotificationProvider } from "./email-notification.provider";
import { LineMessagingProvider } from "./line-messaging.provider";
import { renderNotification } from "./notification-template";
import {
  NotificationDeliveryError,
  type NotificationPayload,
  type NotificationProvider,
  type NotificationTypeName,
} from "./notification.types";

const DEFAULT_BATCH_SIZE = 20;
const LOCK_TIMEOUT_MS = 5 * 60_000;
const MAX_BACKOFF_MS = 60 * 60_000;

type ClaimedNotificationJob = Prisma.NotificationJobGetPayload<{
  include: {
    user: {
      select: {
        email: true;
        lineUserId: true;
        notificationPreference: true;
      };
    };
  };
}>;

function safeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown notification delivery error";
  return message.replace(/[\r\n\t]+/g, " ").slice(0, 500);
}

function retryAt(now: Date, attempts: number) {
  const delay = Math.min(60_000 * 2 ** Math.max(0, attempts - 1), MAX_BACKOFF_MS);
  return new Date(now.getTime() + delay);
}

function workerIntervalMs() {
  const configured = Number(process.env.NOTIFICATION_WORKER_INTERVAL_MS ?? 10_000);
  return Number.isFinite(configured) && configured >= 1_000 && configured <= 300_000
    ? configured
    : 10_000;
}

export class NotificationWorker {
  private readonly providers: Map<string, NotificationProvider>;

  constructor(
    private readonly prisma: PrismaClient,
    providers: NotificationProvider[] = [new EmailNotificationProvider(), new LineMessagingProvider()],
    private readonly workerId = `notification-worker:${crypto.randomUUID()}`,
  ) {
    this.providers = new Map(providers.map((provider) => [provider.channel, provider]));
  }

  async runOnce(batchSize = DEFAULT_BATCH_SIZE, now = new Date()) {
    const jobs = await this.claim(batchSize, now);
    const deliveries = await Promise.allSettled(jobs.map((job) => this.deliver(job, now)));
    const failures = deliveries
      .filter((delivery): delivery is PromiseRejectedResult => delivery.status === "rejected")
      .map((delivery) => delivery.reason);
    if (failures.length > 0) throw new AggregateError(failures, "Notification worker database update failed");
    return jobs.length;
  }

  private async claim(batchSize: number, now: Date) {
    const limit = Math.max(1, Math.min(Math.trunc(batchSize), 100));
    const staleBefore = new Date(now.getTime() - LOCK_TIMEOUT_MS);
    const ids = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`
        UPDATE "notification_jobs"
        SET
          "status" = 'FAILED'::"NotificationJobStatus",
          "locked_at" = NULL,
          "locked_by" = NULL,
          "last_error" = 'Worker lock expired after maximum attempts',
          "updated_at" = ${now}
        WHERE "status" = 'PROCESSING'::"NotificationJobStatus"
          AND "locked_at" < ${staleBefore}
          AND "attempts" >= "max_attempts"
      `);

      return tx.$queryRaw<{ id: string }[]>(Prisma.sql`
        WITH candidates AS (
          SELECT "id"
          FROM "notification_jobs"
          WHERE "attempts" < "max_attempts"
            AND (
              (
                "status" IN (
                  'PENDING'::"NotificationJobStatus",
                  'RETRY'::"NotificationJobStatus"
                )
                AND "available_at" <= ${now}
              )
              OR (
                "status" = 'PROCESSING'::"NotificationJobStatus"
                AND "locked_at" < ${staleBefore}
              )
            )
          ORDER BY "available_at" ASC, "created_at" ASC
          FOR UPDATE SKIP LOCKED
          LIMIT ${limit}
        )
        UPDATE "notification_jobs" AS jobs
        SET
          "status" = 'PROCESSING'::"NotificationJobStatus",
          "attempts" = jobs."attempts" + 1,
          "locked_at" = ${now},
          "locked_by" = ${this.workerId},
          "last_error" = NULL,
          "updated_at" = ${now}
        FROM candidates
        WHERE jobs."id" = candidates."id"
        RETURNING jobs."id"
      `);
    });
    if (ids.length === 0) return [];
    return this.prisma.notificationJob.findMany({
      where: { id: { in: ids.map(({ id }) => id) } },
      include: {
        user: {
          select: {
            email: true,
            lineUserId: true,
            notificationPreference: true,
          },
        },
      },
    });
  }

  private async deliver(job: ClaimedNotificationJob, now: Date) {
    const preference = job.user.notificationPreference;
    const enabledForType = job.type === "TEST"
      || ((job.type === "BOOKING_APPROVED" || job.type === "BOOKING_REJECTED") && (preference?.bookingUpdatesEnabled ?? true))
      || (job.type === "REMINDER_30" && (preference?.reminder30Enabled ?? true))
      || (job.type === "CHECKIN_REMINDER" && (preference?.checkInReminderEnabled ?? true))
      || (job.type === "WAITLIST_PROMOTED" && (preference?.waitlistEnabled ?? true));
    const channelEnabled = job.channel === "EMAIL"
      ? (preference?.emailEnabled ?? true)
      : (preference?.lineEnabled ?? true);
    const recipient = job.channel === "EMAIL" ? job.user.email : job.user.lineUserId;
    if (!enabledForType || !channelEnabled || !recipient) {
      await this.prisma.notificationJob.updateMany({
        where: { id: job.id, status: "PROCESSING", lockedBy: this.workerId },
        data: {
          status: "CANCELLED",
          lockedAt: null,
          lockedBy: null,
          lastError: "Notification preference or recipient is no longer available",
        },
      });
      return;
    }

    const provider = this.providers.get(job.channel);
    if (!provider) {
      await this.fail(job, new NotificationDeliveryError(`No provider registered for ${job.channel}`, false), now);
      return;
    }

    try {
      const rendered = renderNotification(job.type as NotificationTypeName, job.payload as NotificationPayload);
      const result = await provider.send({
        recipient,
        ...rendered,
        idempotencyKey: job.idempotencyKey,
        retryKey: job.id,
      });
      await this.prisma.notificationJob.updateMany({
        where: { id: job.id, status: "PROCESSING", lockedBy: this.workerId },
        data: {
          status: "SENT",
          sentAt: now,
          providerMessageId: result.providerMessageId,
          lockedAt: null,
          lockedBy: null,
          lastError: null,
        },
      });
    } catch (error) {
      await this.fail(job, error, now);
    }
  }

  private async fail(
    job: ClaimedNotificationJob,
    error: unknown,
    now: Date,
  ) {
    const retryable = !(error instanceof NotificationDeliveryError) || error.retryable;
    const exhausted = job.attempts >= job.maxAttempts;
    await this.prisma.notificationJob.updateMany({
      where: { id: job.id, status: "PROCESSING", lockedBy: this.workerId },
      data: {
        status: !retryable || exhausted ? "FAILED" : "RETRY",
        availableAt: !retryable || exhausted ? job.availableAt : retryAt(now, job.attempts),
        lockedAt: null,
        lockedBy: null,
        lastError: safeError(error),
      },
    });
  }
}

export function startNotificationWorker(prisma: PrismaClient) {
  const worker = new NotificationWorker(prisma);
  const intervalMs = workerIntervalMs();
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await worker.runOnce();
    } catch (error) {
      console.error("[notification] Worker run failed", error);
    } finally {
      running = false;
    }
  };
  void run();
  const timer = setInterval(() => void run(), intervalMs);
  timer.unref?.();
  return timer;
}
