-- Add reminder sent-at tracking columns to bookings
ALTER TABLE "bookings" ADD COLUMN "reminder_30_sent_at" TIMESTAMP(3);
ALTER TABLE "bookings" ADD COLUMN "reminder_checkin_sent_at" TIMESTAMP(3);

-- Create WaitlistStatus enum
CREATE TYPE "WaitlistStatus" AS ENUM ('WAITING', 'PROMOTED', 'CANCELLED');

-- Create waitlist_entries table
CREATE TABLE "waitlist_entries" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "attendees" INTEGER NOT NULL,
    "purpose" TEXT,
    "status" "WaitlistStatus" NOT NULL DEFAULT 'WAITING',
    "notified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "waitlist_entries_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "waitlist_entries"
    ADD CONSTRAINT "waitlist_entries_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "waitlist_entries"
    ADD CONSTRAINT "waitlist_entries_room_id_fkey"
    FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "waitlist_entries_user_id_idx" ON "waitlist_entries"("user_id");
CREATE INDEX "waitlist_entries_room_id_start_end_status_idx"
    ON "waitlist_entries"("room_id", "start_time", "end_time", "status");
