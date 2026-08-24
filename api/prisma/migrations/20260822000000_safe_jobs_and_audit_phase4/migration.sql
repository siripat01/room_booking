-- Phase 4 makes scheduled work durable across multiple API instances and adds
-- an append-only audit log for booking, room, device, waitlist, and job events.

CREATE TYPE "BackgroundJobType" AS ENUM (
  'EXPIRE_BOOKINGS',
  'AUTO_CHECKOUT',
  'ENQUEUE_REMINDERS',
  'PROMOTE_WAITLIST',
  'PURGE_JOB_HISTORY'
);

CREATE TYPE "BackgroundJobStatus" AS ENUM (
  'PENDING',
  'PROCESSING',
  'RETRY',
  'COMPLETED',
  'FAILED'
);

CREATE TYPE "AuditTargetType" AS ENUM (
  'BOOKING',
  'DEVICE',
  'ROOM',
  'JOB',
  'WAITLIST'
);

ALTER TYPE "WaitlistStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

CREATE TABLE "background_jobs" (
  "id" TEXT NOT NULL,
  "type" "BackgroundJobType" NOT NULL,
  "status" "BackgroundJobStatus" NOT NULL DEFAULT 'PENDING',
  "job_key" TEXT NOT NULL,
  "scheduled_for" TIMESTAMPTZ(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "max_attempts" INTEGER NOT NULL DEFAULT 5,
  "available_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "locked_at" TIMESTAMPTZ(3),
  "locked_by" TEXT,
  "started_at" TIMESTAMPTZ(3),
  "completed_at" TIMESTAMPTZ(3),
  "last_error" TEXT,
  "result" JSONB,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "background_jobs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "background_jobs_attempts_valid" CHECK (
    "attempts" >= 0 AND "max_attempts" > 0 AND "attempts" <= "max_attempts"
  ),
  CONSTRAINT "background_jobs_lock_consistent" CHECK (
    ("status" = 'PROCESSING' AND "locked_at" IS NOT NULL AND "locked_by" IS NOT NULL)
    OR
    ("status" <> 'PROCESSING' AND "locked_at" IS NULL AND "locked_by" IS NULL)
  ),
  CONSTRAINT "background_jobs_completion_consistent" CHECK (
    ("status" = 'COMPLETED' AND "completed_at" IS NOT NULL)
    OR
    ("status" <> 'COMPLETED' AND "completed_at" IS NULL)
  ),
  CONSTRAINT "background_jobs_result_object" CHECK (
    "result" IS NULL OR jsonb_typeof("result") = 'object'
  )
);

CREATE UNIQUE INDEX "background_jobs_job_key_key" ON "background_jobs"("job_key");
CREATE INDEX "background_jobs_status_available_at_created_at_idx"
  ON "background_jobs"("status", "available_at", "created_at");
CREATE INDEX "background_jobs_status_locked_at_idx"
  ON "background_jobs"("status", "locked_at");
CREATE INDEX "background_jobs_type_scheduled_for_idx"
  ON "background_jobs"("type", "scheduled_for");
CREATE INDEX "background_jobs_completed_at_idx" ON "background_jobs"("completed_at");

-- Terminal notification retention filters by both status and update time.
CREATE INDEX "notification_jobs_status_updated_at_idx"
  ON "notification_jobs"("status", "updated_at");

CREATE TABLE "audit_logs" (
  "id" TEXT NOT NULL,
  "source_event_id" TEXT,
  "actor_type" "BookingActorType" NOT NULL,
  "actor_id" TEXT,
  "target_type" "AuditTargetType" NOT NULL,
  "target_id" TEXT NOT NULL,
  "booking_id" TEXT,
  "device_id" TEXT,
  "room_id" TEXT,
  "event_type" TEXT NOT NULL,
  "previous_status" TEXT,
  "new_status" TEXT,
  "metadata" JSONB,
  "correlation_id" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "audit_logs_metadata_object" CHECK (
    "metadata" IS NULL OR jsonb_typeof("metadata") = 'object'
  ),
  CONSTRAINT "audit_logs_target_id_present" CHECK (length("target_id") > 0),
  CONSTRAINT "audit_logs_event_type_present" CHECK (length("event_type") > 0)
);

CREATE UNIQUE INDEX "audit_logs_source_event_id_key" ON "audit_logs"("source_event_id");
CREATE INDEX "audit_logs_target_type_target_id_created_at_idx"
  ON "audit_logs"("target_type", "target_id", "created_at");
CREATE INDEX "audit_logs_booking_id_created_at_idx"
  ON "audit_logs"("booking_id", "created_at");
CREATE INDEX "audit_logs_device_id_created_at_idx"
  ON "audit_logs"("device_id", "created_at");
CREATE INDEX "audit_logs_room_id_created_at_idx"
  ON "audit_logs"("room_id", "created_at");
CREATE INDEX "audit_logs_actor_type_actor_id_created_at_idx"
  ON "audit_logs"("actor_type", "actor_id", "created_at");

INSERT INTO "audit_logs" (
  "id",
  "source_event_id",
  "actor_type",
  "actor_id",
  "target_type",
  "target_id",
  "booking_id",
  "room_id",
  "event_type",
  "previous_status",
  "new_status",
  "metadata",
  "correlation_id",
  "created_at"
)
SELECT
  gen_random_uuid()::text,
  event."id",
  event."actor_type",
  event."actor_id",
  'BOOKING'::"AuditTargetType",
  event."booking_id",
  event."booking_id",
  event."room_id",
  event."event_type"::text,
  event."previous_status"::text,
  event."new_status"::text,
  event."metadata",
  event."correlation_id",
  event."created_at"
FROM "booking_events" AS event
ON CONFLICT ("source_event_id") DO NOTHING;
