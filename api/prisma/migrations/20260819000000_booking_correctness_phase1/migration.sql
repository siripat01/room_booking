-- Phase 1 preflight: fail without changing data when existing rows violate
-- the invariants required by the new constraints. Resolve reported rows
-- explicitly before re-running the migration; this migration never deletes data.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "bookings"
    WHERE "start_time" >= "end_time" OR "attendees" <= 0
  ) THEN
    RAISE EXCEPTION 'Phase 1 migration blocked: bookings contain invalid time ranges or attendee counts';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "bookings" a
    JOIN "bookings" b ON a.id < b.id
      AND a.room_id = b.room_id
      AND a.start_time < b.end_time
      AND a.end_time > b.start_time
    WHERE a.status IN ('PENDING', 'CONFIRMED', 'CHECKED_IN')
      AND b.status IN ('PENDING', 'CONFIRMED', 'CHECKED_IN')
  ) THEN
    RAISE EXCEPTION 'Phase 1 migration blocked: active room bookings overlap';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "bookings" a
    JOIN "bookings" b ON a.id < b.id
      AND a.user_id = b.user_id
      AND a.start_time < b.end_time
      AND a.end_time > b.start_time
    WHERE a.status IN ('PENDING', 'CONFIRMED', 'CHECKED_IN')
      AND b.status IN ('PENDING', 'CONFIRMED', 'CHECKED_IN')
  ) THEN
    RAISE EXCEPTION 'Phase 1 migration blocked: users have overlapping active bookings';
  END IF;
END $$;

-- Existing Prisma DateTime values were written as UTC instants into timestamp
-- columns. Interpret those values as UTC while converting to timestamptz.
ALTER TABLE "user"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "banExpires" TYPE TIMESTAMPTZ(3) USING "banExpires" AT TIME ZONE 'UTC',
  ALTER COLUMN "plan_expires_at" TYPE TIMESTAMPTZ(3) USING "plan_expires_at" AT TIME ZONE 'UTC';

ALTER TABLE "session"
  ALTER COLUMN "expiresAt" TYPE TIMESTAMPTZ(3) USING "expiresAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

ALTER TABLE "account"
  ALTER COLUMN "accessTokenExpiresAt" TYPE TIMESTAMPTZ(3) USING "accessTokenExpiresAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "refreshTokenExpiresAt" TYPE TIMESTAMPTZ(3) USING "refreshTokenExpiresAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

ALTER TABLE "verification"
  ALTER COLUMN "expiresAt" TYPE TIMESTAMPTZ(3) USING "expiresAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

ALTER TABLE "rooms"
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

ALTER TABLE "bookings"
  ALTER COLUMN "start_time" TYPE TIMESTAMPTZ(3) USING "start_time" AT TIME ZONE 'UTC',
  ALTER COLUMN "end_time" TYPE TIMESTAMPTZ(3) USING "end_time" AT TIME ZONE 'UTC',
  ALTER COLUMN "approved_at" TYPE TIMESTAMPTZ(3) USING "approved_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "qr_expires_at" TYPE TIMESTAMPTZ(3) USING "qr_expires_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "checked_in_at" TYPE TIMESTAMPTZ(3) USING "checked_in_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "checked_out_at" TYPE TIMESTAMPTZ(3) USING "checked_out_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "cancelled_at" TYPE TIMESTAMPTZ(3) USING "cancelled_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "reminder_30_sent_at" TYPE TIMESTAMPTZ(3) USING "reminder_30_sent_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "reminder_checkin_sent_at" TYPE TIMESTAMPTZ(3) USING "reminder_checkin_sent_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

ALTER TABLE "devices"
  ALTER COLUMN "last_seen_at" TYPE TIMESTAMPTZ(3) USING "last_seen_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

ALTER TABLE "room_closures"
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';

ALTER TABLE "waitlist_entries"
  ALTER COLUMN "start_time" TYPE TIMESTAMPTZ(3) USING "start_time" AT TIME ZONE 'UTC',
  ALTER COLUMN "end_time" TYPE TIMESTAMPTZ(3) USING "end_time" AT TIME ZONE 'UTC',
  ALTER COLUMN "notified_at" TYPE TIMESTAMPTZ(3) USING "notified_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';

-- Booking history is part of the audit record. Prevent user deletion from
-- cascading through bookings and their events.
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_user_id_fkey";
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "rooms"
  ADD CONSTRAINT "rooms_capacity_positive" CHECK ("capacity" > 0);

ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_valid_time_range" CHECK ("start_time" < "end_time"),
  ADD CONSTRAINT "bookings_attendees_positive" CHECK ("attendees" > 0);

ALTER TABLE "waitlist_entries"
  ADD CONSTRAINT "waitlist_entries_valid_time_range" CHECK ("start_time" < "end_time"),
  ADD CONSTRAINT "waitlist_entries_attendees_positive" CHECK ("attendees" > 0);

ALTER TABLE "time_slots"
  ADD CONSTRAINT "time_slots_valid_clock_range" CHECK (
    "open_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    AND "close_time" ~ '^(([01][0-9]|2[0-3]):[0-5][0-9]|24:00)$'
    AND "open_time" < "close_time"
  );

ALTER TABLE "room_closures"
  ADD CONSTRAINT "room_closures_valid_partial_range" CHECK (
    "all_day"
    OR (
      "start_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      AND "end_time" ~ '^(([01][0-9]|2[0-3]):[0-5][0-9]|24:00)$'
      AND "start_time" < "end_time"
    )
  );

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_room_no_active_overlap"
  EXCLUDE USING gist (
    "room_id" WITH =,
    tstzrange("start_time", "end_time", '[)') WITH &&
  ) WHERE ("status" IN ('PENDING'::"BookingStatus", 'CONFIRMED'::"BookingStatus", 'CHECKED_IN'::"BookingStatus"));

ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_user_no_active_overlap"
  EXCLUDE USING gist (
    "user_id" WITH =,
    tstzrange("start_time", "end_time", '[)') WITH &&
  ) WHERE ("status" IN ('PENDING'::"BookingStatus", 'CONFIRMED'::"BookingStatus", 'CHECKED_IN'::"BookingStatus"));

CREATE TYPE "BookingActorType" AS ENUM ('USER', 'ADMIN', 'DEVICE', 'SYSTEM');
CREATE TYPE "BookingEventType" AS ENUM ('CREATED', 'APPROVED', 'REJECTED', 'CANCELLED', 'CHECKED_IN', 'COMPLETED', 'EXPIRED');

CREATE TABLE "booking_events" (
  "id" TEXT NOT NULL,
  "booking_id" TEXT NOT NULL,
  "room_id" TEXT NOT NULL,
  "actor_type" "BookingActorType" NOT NULL,
  "actor_id" TEXT,
  "event_type" "BookingEventType" NOT NULL,
  "previous_status" "BookingStatus",
  "new_status" "BookingStatus" NOT NULL,
  "metadata" JSONB,
  "correlation_id" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "booking_events_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "booking_events"
  ADD CONSTRAINT "booking_events_booking_id_fkey"
  FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "booking_events_booking_id_created_at_idx" ON "booking_events"("booking_id", "created_at");
CREATE INDEX "booking_events_room_id_created_at_idx" ON "booking_events"("room_id", "created_at");

INSERT INTO "booking_events" (
  "id", "booking_id", "room_id", "actor_type", "event_type",
  "previous_status", "new_status", "metadata", "created_at"
)
SELECT
  gen_random_uuid()::text,
  "id",
  "room_id",
  'SYSTEM'::"BookingActorType",
  'CREATED'::"BookingEventType",
  NULL,
  "status",
  '{"backfilled":true}'::jsonb,
  "created_at"
FROM "bookings";
