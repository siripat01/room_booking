import { Prisma, type PrismaClient } from "../../generated/prisma/client";
import { hashOpaqueToken } from "./opaque-token";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export class DatabaseRateLimiter {
  constructor(private readonly prisma: PrismaClient) {}

  async consume(
    scope: string,
    subject: string,
    limit: number,
    windowSeconds: number,
  ): Promise<RateLimitResult> {
    if (!Number.isInteger(limit) || limit < 1 || !Number.isInteger(windowSeconds) || windowSeconds < 1) {
      throw new Error("Rate-limit configuration must use positive integers");
    }

    const subjectHash = hashOpaqueToken(`${scope}:${subject}`);
    const rows = await this.prisma.$queryRaw<Array<{ count: number; window_started_at: Date }>>(Prisma.sql`
      INSERT INTO "rate_limit_buckets" AS bucket (
        "scope", "subject_hash", "window_started_at", "count", "updated_at"
      )
      VALUES (${scope}, ${subjectHash}, CURRENT_TIMESTAMP, 1, CURRENT_TIMESTAMP)
      ON CONFLICT ("scope", "subject_hash") DO UPDATE
      SET
        "count" = CASE
          WHEN bucket."window_started_at" <= CURRENT_TIMESTAMP - (${windowSeconds} * INTERVAL '1 second') THEN 1
          ELSE bucket."count" + 1
        END,
        "window_started_at" = CASE
          WHEN bucket."window_started_at" <= CURRENT_TIMESTAMP - (${windowSeconds} * INTERVAL '1 second') THEN CURRENT_TIMESTAMP
          ELSE bucket."window_started_at"
        END,
        "updated_at" = CURRENT_TIMESTAMP
      RETURNING "count", "window_started_at"
    `);

    const bucket = rows[0];
    if (!bucket) throw new Error("Rate-limit bucket update returned no row");

    const elapsedSeconds = Math.max(0, (Date.now() - bucket.window_started_at.getTime()) / 1000);
    return {
      allowed: bucket.count <= limit,
      remaining: Math.max(0, limit - bucket.count),
      retryAfterSeconds: Math.max(1, Math.ceil(windowSeconds - elapsedSeconds)),
    };
  }
}
