CREATE INDEX "bookings_status_start_time_idx" ON "bookings"("status", "start_time");
CREATE INDEX "bookings_status_end_time_idx" ON "bookings"("status", "end_time");
