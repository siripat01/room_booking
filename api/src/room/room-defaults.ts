import type { DayOfWeek } from "../../generated/prisma/client";

export type RoomTimeSlotInput = {
  dayOfWeek: DayOfWeek;
  openTime: string;
  closeTime: string;
  isActive: boolean;
};

// Preserve RoomFlow's legacy weekday behavior until an administrator replaces
// the schedule through the room time-slot API. Missing days remain closed.
export const DEFAULT_ROOM_TIME_SLOTS: readonly RoomTimeSlotInput[] = [
  { dayOfWeek: "MONDAY", openTime: "00:00", closeTime: "24:00", isActive: true },
  { dayOfWeek: "TUESDAY", openTime: "00:00", closeTime: "24:00", isActive: true },
  { dayOfWeek: "WEDNESDAY", openTime: "00:00", closeTime: "24:00", isActive: true },
  { dayOfWeek: "THURSDAY", openTime: "00:00", closeTime: "24:00", isActive: true },
  { dayOfWeek: "FRIDAY", openTime: "00:00", closeTime: "24:00", isActive: true },
];
