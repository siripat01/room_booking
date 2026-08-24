-- Phase 6 Feature A adds auditable weekly booking series. Each generated
-- occurrence remains a normal booking, so the Phase 1 overlap constraints and
-- state machine continue to be the database-level source of truth.

ALTER TYPE "AuditTargetType" ADD VALUE IF NOT EXISTS 'BOOKING_SERIES';
ALTER TYPE "BackgroundJobType" ADD VALUE IF NOT EXISTS 'EXPIRE_PRO_ACCESS';

CREATE TYPE "BookingSeriesStatus" AS ENUM ('ACTIVE', 'CANCELLED');

CREATE TABLE "booking_series" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "room_id" TEXT NOT NULL,
  "start_date" DATE NOT NULL,
  "end_date" DATE NOT NULL,
  "weekdays" "DayOfWeek"[] NOT NULL,
  "start_time" TEXT NOT NULL,
  "end_time" TEXT NOT NULL,
  "attendees" INTEGER NOT NULL,
  "purpose" TEXT,
  "status" "BookingSeriesStatus" NOT NULL DEFAULT 'ACTIVE',
  "cancelled_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "booking_series_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "booking_series_date_range_valid" CHECK ("start_date" <= "end_date"),
  CONSTRAINT "booking_series_weekdays_present" CHECK (cardinality("weekdays") BETWEEN 1 AND 7),
  CONSTRAINT "booking_series_attendees_valid" CHECK ("attendees" BETWEEN 1 AND 500),
  CONSTRAINT "booking_series_purpose_length" CHECK ("purpose" IS NULL OR char_length("purpose") <= 500),
  CONSTRAINT "booking_series_clock_range_valid" CHECK (
    "start_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    AND "end_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    AND "start_time" < "end_time"
  ),
  CONSTRAINT "booking_series_cancellation_consistent" CHECK (
    ("status" = 'CANCELLED' AND "cancelled_at" IS NOT NULL)
    OR ("status" = 'ACTIVE' AND "cancelled_at" IS NULL)
  )
);

ALTER TABLE "booking_series"
  ADD CONSTRAINT "booking_series_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "booking_series_room_id_fkey"
  FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "booking_series_user_id_status_start_date_idx"
  ON "booking_series"("user_id", "status", "start_date");
CREATE INDEX "booking_series_user_id_created_at_idx"
  ON "booking_series"("user_id", "created_at");
CREATE INDEX "booking_series_room_id_status_start_date_idx"
  ON "booking_series"("room_id", "status", "start_date");

-- Supports recurring entitlement expiry scans and Stripe webhook lookups.
CREATE INDEX "user_plan_plan_expires_at_idx"
  ON "user"("plan", "plan_expires_at");
CREATE INDEX "user_stripe_customer_id_idx"
  ON "user"("stripe_customer_id");

-- `hasEvery` alternatives use PostgreSQL array containment (`@>`).
CREATE INDEX "rooms_amenities_idx" ON "rooms" USING GIN ("amenities");

-- Global/admin SSE streams scan the append-only audit cursor by time and UUID.
CREATE INDEX "audit_logs_created_at_id_idx"
  ON "audit_logs"("created_at", "id");

ALTER TABLE "bookings"
  ADD COLUMN "series_id" TEXT,
  ADD COLUMN "occurrence_date" DATE,
  ADD COLUMN "is_series_exception" BOOLEAN NOT NULL DEFAULT false,
  ADD CONSTRAINT "bookings_series_id_fkey"
    FOREIGN KEY ("series_id") REFERENCES "booking_series"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "bookings_series_fields_consistent" CHECK (
    ("series_id" IS NULL AND "occurrence_date" IS NULL AND NOT "is_series_exception")
    OR ("series_id" IS NOT NULL AND "occurrence_date" IS NOT NULL)
  );

CREATE UNIQUE INDEX "bookings_series_id_occurrence_date_key"
  ON "bookings"("series_id", "occurrence_date");
CREATE INDEX "bookings_series_id_start_time_idx"
  ON "bookings"("series_id", "start_time");
