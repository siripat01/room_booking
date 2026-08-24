-- Rooms created through the admin UI historically had no TimeSlot rows. Since
-- booking policy now treats a missing active slot as closed, preserve the
-- legacy Monday-Friday behavior for rooms that have never been configured.
-- Rooms with any existing slot are intentionally left unchanged.
INSERT INTO "time_slots" (
  "id",
  "room_id",
  "day_of_week",
  "open_time",
  "close_time",
  "is_active"
)
SELECT
  gen_random_uuid()::text,
  room."id",
  defaults."day_of_week"::"DayOfWeek",
  '00:00',
  '24:00',
  true
FROM "rooms" AS room
CROSS JOIN (
  VALUES
    ('MONDAY'),
    ('TUESDAY'),
    ('WEDNESDAY'),
    ('THURSDAY'),
    ('FRIDAY')
) AS defaults("day_of_week")
WHERE NOT EXISTS (
  SELECT 1
  FROM "time_slots" AS existing
  WHERE existing."room_id" = room."id"
)
ON CONFLICT ("room_id", "day_of_week") DO NOTHING;
