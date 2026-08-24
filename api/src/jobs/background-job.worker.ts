import { Prisma, type BackgroundJob, type BackgroundJobType, type PrismaClient } from "../../generated/prisma/client";
import { AuditService } from "../audit/audit.service";
import { BackgroundJobHandlers, type BackgroundJobHandler, type BackgroundJobResult } from "./background-job.handlers";

const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_LOCK_TIMEOUT_MS = 5 * 60_000;
const MAX_BACKOFF_MS = 60 * 60_000;

function safeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown background job error";
  return message.replace(/[\r\n\t]+/g, " ").slice(0, 500);
}

function retryAt(now: Date, attempts: number) {
  const delay = Math.min(30_000 * 2 ** Math.max(0, attempts - 1), MAX_BACKOFF_MS);
  return new Date(now.getTime() + delay);
}

function lockTimeoutMs() {
  const configured = Number(process.env.BACKGROUND_JOB_LOCK_TIMEOUT_MS ?? DEFAULT_LOCK_TIMEOUT_MS);
  return Number.isInteger(configured) && configured >= 60_000 && configured <= 60 * 60_000
    ? configured
    : DEFAULT_LOCK_TIMEOUT_MS;
}

export class BackgroundJobWorker {
  private readonly handlers: BackgroundJobHandlers;
  private readonly audit = new AuditService();

  constructor(
    private readonly prisma: PrismaClient,
    private readonly workerId = `background-worker:${crypto.randomUUID()}`,
    private readonly handlerOverrides: Partial<Record<BackgroundJobType, BackgroundJobHandler>> = {},
  ) {
    this.handlers = new BackgroundJobHandlers(prisma);
  }

  async runOnce(batchSize = DEFAULT_BATCH_SIZE, now = new Date()) {
    const jobs = await this.claim(batchSize, now);
    const executions = await Promise.allSettled(jobs.map((job) => this.execute(job, now)));
    const failures = executions
      .filter((execution): execution is PromiseRejectedResult => execution.status === "rejected")
      .map((execution) => execution.reason);
    if (failures.length > 0) throw new AggregateError(failures, "Background job state update failed");
    return jobs.length;
  }

  private async claim(batchSize: number, now: Date) {
    const limit = Math.max(1, Math.min(Math.trunc(batchSize), 100));
    const staleBefore = new Date(now.getTime() - lockTimeoutMs());
    const ids = await this.prisma.$transaction(async (tx) => {
      const abandoned = await tx.$queryRaw<{ id: string; type: BackgroundJobType }[]>(Prisma.sql`
        UPDATE "background_jobs"
        SET
          "status" = 'FAILED'::"BackgroundJobStatus",
          "locked_at" = NULL,
          "locked_by" = NULL,
          "last_error" = 'Worker lock expired after maximum attempts',
          "updated_at" = ${now}
        WHERE "status" = 'PROCESSING'::"BackgroundJobStatus"
          AND "locked_at" < ${staleBefore}
          AND "attempts" >= "max_attempts"
        RETURNING "id", "type"
      `);
      for (const job of abandoned) {
        await this.audit.record(tx, {
          actor: { type: "SYSTEM", correlationId: job.id },
          targetType: "JOB",
          targetId: job.id,
          eventType: "BACKGROUND_JOB_FAILED",
          previousStatus: "PROCESSING",
          newStatus: "FAILED",
          metadata: { jobType: job.type, reason: "lock-expired" },
          createdAt: now,
        });
      }

      return tx.$queryRaw<{ id: string }[]>(Prisma.sql`
        WITH candidates AS (
          SELECT "id"
          FROM "background_jobs"
          WHERE "attempts" < "max_attempts"
            AND (
              (
                "status" IN (
                  'PENDING'::"BackgroundJobStatus",
                  'RETRY'::"BackgroundJobStatus"
                )
                AND "available_at" <= ${now}
              )
              OR (
                "status" = 'PROCESSING'::"BackgroundJobStatus"
                AND "locked_at" < ${staleBefore}
              )
            )
          ORDER BY "available_at" ASC, "created_at" ASC
          FOR UPDATE SKIP LOCKED
          LIMIT ${limit}
        )
        UPDATE "background_jobs" AS jobs
        SET
          "status" = 'PROCESSING'::"BackgroundJobStatus",
          "attempts" = jobs."attempts" + 1,
          "locked_at" = ${now},
          "locked_by" = ${this.workerId},
          "started_at" = COALESCE(jobs."started_at", ${now}),
          "last_error" = NULL,
          "updated_at" = ${now}
        FROM candidates
        WHERE jobs."id" = candidates."id"
        RETURNING jobs."id"
      `);
    });
    if (ids.length === 0) return [];
    return this.prisma.backgroundJob.findMany({ where: { id: { in: ids.map(({ id }) => id) } } });
  }

  private async execute(job: BackgroundJob, now: Date) {
    const handler = this.handlerOverrides[job.type] ?? this.handlers.for(job.type);
    try {
      const result = await handler(job.id, now);
      await this.complete(job, result, now);
    } catch (error) {
      await this.fail(job, error, now);
    }
  }

  private async complete(job: BackgroundJob, result: BackgroundJobResult, now: Date) {
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.backgroundJob.updateMany({
        where: { id: job.id, status: "PROCESSING", lockedBy: this.workerId },
        data: {
          status: "COMPLETED",
          completedAt: now,
          lockedAt: null,
          lockedBy: null,
          lastError: null,
          result: result as Prisma.InputJsonObject,
        },
      });
      if (updated.count !== 1) return;
      await this.audit.record(tx, {
        actor: { type: "SYSTEM", correlationId: job.id },
        targetType: "JOB",
        targetId: job.id,
        eventType: "BACKGROUND_JOB_COMPLETED",
        previousStatus: "PROCESSING",
        newStatus: "COMPLETED",
        metadata: { jobType: job.type, attempts: job.attempts, ...result },
        createdAt: now,
      });
    });
  }

  private async fail(job: BackgroundJob, error: unknown, now: Date) {
    const exhausted = job.attempts >= job.maxAttempts;
    const status = exhausted ? "FAILED" as const : "RETRY" as const;
    const message = safeError(error);
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.backgroundJob.updateMany({
        where: { id: job.id, status: "PROCESSING", lockedBy: this.workerId },
        data: {
          status,
          availableAt: exhausted ? job.availableAt : retryAt(now, job.attempts),
          lockedAt: null,
          lockedBy: null,
          lastError: message,
        },
      });
      if (updated.count !== 1) return;
      await this.audit.record(tx, {
        actor: { type: "SYSTEM", correlationId: job.id },
        targetType: "JOB",
        targetId: job.id,
        eventType: exhausted ? "BACKGROUND_JOB_FAILED" : "BACKGROUND_JOB_RETRY_SCHEDULED",
        previousStatus: "PROCESSING",
        newStatus: status,
        metadata: { jobType: job.type, attempts: job.attempts, error: message },
        createdAt: now,
      });
    });
  }
}
