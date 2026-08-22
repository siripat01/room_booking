-- Phase 3 replaces the discontinued LINE Notify integration with LINE Messaging
-- and introduces a PostgreSQL-backed notification outbox. Existing LINE Notify
-- access tokens cannot be converted to LINE Messaging user IDs and are scrubbed.
-- The constrained empty legacy column remains for one rolling deployment so an
-- old API machine can still prepare its SELECT statements safely.

CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'LINE');
CREATE TYPE "NotificationType" AS ENUM (
  'BOOKING_APPROVED',
  'BOOKING_REJECTED',
  'REMINDER_30',
  'CHECKIN_REMINDER',
  'WAITLIST_PROMOTED',
  'TEST'
);
CREATE TYPE "NotificationJobStatus" AS ENUM (
  'PENDING',
  'PROCESSING',
  'RETRY',
  'SENT',
  'FAILED',
  'CANCELLED'
);

ALTER TABLE "user" ADD COLUMN "line_user_id" TEXT;

UPDATE "user" SET "line_notify_token" = NULL;
ALTER TABLE "user"
  ADD CONSTRAINT "user_legacy_line_notify_token_empty"
  CHECK ("line_notify_token" IS NULL),
  ADD CONSTRAINT "user_line_user_id_format"
  CHECK ("line_user_id" IS NULL OR "line_user_id" ~ '^U[0-9a-f]{32}$');

CREATE UNIQUE INDEX "user_line_user_id_key" ON "user"("line_user_id");

CREATE TABLE "notification_preferences" (
  "user_id" TEXT NOT NULL,
  "email_enabled" BOOLEAN NOT NULL DEFAULT true,
  "line_enabled" BOOLEAN NOT NULL DEFAULT true,
  "booking_updates_enabled" BOOLEAN NOT NULL DEFAULT true,
  "reminder_30_enabled" BOOLEAN NOT NULL DEFAULT true,
  "check_in_reminder_enabled" BOOLEAN NOT NULL DEFAULT true,
  "waitlist_enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("user_id"),
  CONSTRAINT "notification_preferences_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "notification_preferences" ("user_id", "created_at", "updated_at")
SELECT "id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "user";

CREATE TABLE "notification_jobs" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "booking_id" TEXT,
  "channel" "NotificationChannel" NOT NULL,
  "type" "NotificationType" NOT NULL,
  "status" "NotificationJobStatus" NOT NULL DEFAULT 'PENDING',
  "idempotency_key" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "max_attempts" INTEGER NOT NULL DEFAULT 5,
  "available_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "locked_at" TIMESTAMPTZ(3),
  "locked_by" TEXT,
  "last_error" TEXT,
  "provider_message_id" TEXT,
  "sent_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "notification_jobs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notification_jobs_attempts_valid" CHECK (
    "attempts" >= 0 AND "max_attempts" > 0 AND "attempts" <= "max_attempts"
  ),
  CONSTRAINT "notification_jobs_payload_object" CHECK (jsonb_typeof("payload") = 'object'),
  CONSTRAINT "notification_jobs_lock_consistent" CHECK (
    ("status" = 'PROCESSING' AND "locked_at" IS NOT NULL AND "locked_by" IS NOT NULL)
    OR
    ("status" <> 'PROCESSING' AND "locked_at" IS NULL AND "locked_by" IS NULL)
  ),
  CONSTRAINT "notification_jobs_sent_consistent" CHECK (
    ("status" = 'SENT' AND "sent_at" IS NOT NULL)
    OR
    ("status" <> 'SENT' AND "sent_at" IS NULL)
  ),
  CONSTRAINT "notification_jobs_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "notification_jobs_booking_id_fkey"
    FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "notification_jobs_idempotency_key_key"
  ON "notification_jobs"("idempotency_key");
CREATE INDEX "notification_jobs_status_available_at_created_at_idx"
  ON "notification_jobs"("status", "available_at", "created_at");
CREATE INDEX "notification_jobs_status_locked_at_idx"
  ON "notification_jobs"("status", "locked_at");
CREATE INDEX "notification_jobs_user_id_created_at_idx"
  ON "notification_jobs"("user_id", "created_at");
CREATE INDEX "notification_jobs_booking_id_type_idx"
  ON "notification_jobs"("booking_id", "type");

CREATE TABLE "line_link_codes" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "code_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "consumed_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "line_link_codes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "line_link_codes_hash_format" CHECK ("code_hash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "line_link_codes_time_order" CHECK (
    "expires_at" > "created_at"
    AND ("consumed_at" IS NULL OR "consumed_at" >= "created_at")
  ),
  CONSTRAINT "line_link_codes_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "line_link_codes_code_hash_key" ON "line_link_codes"("code_hash");
CREATE INDEX "line_link_codes_user_id_expires_at_idx"
  ON "line_link_codes"("user_id", "expires_at");
CREATE INDEX "line_link_codes_expires_at_consumed_at_idx"
  ON "line_link_codes"("expires_at", "consumed_at");
