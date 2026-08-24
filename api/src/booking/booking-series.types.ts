import type { DayOfWeek } from "../../generated/prisma/client";

export type BookingSeriesTemplateInput = {
  roomId: string;
  startDate: string;
  endDate: string;
  weekdays: DayOfWeek[];
  startTime: string;
  endTime: string;
  attendees: number;
  purpose?: string;
};

export type BookingSeriesTemplatePatch = Partial<
  Pick<
    BookingSeriesTemplateInput,
    "roomId" | "endDate" | "weekdays" | "startTime" | "endTime" | "attendees"
  >
> & { purpose?: string | null };

export type BookingOccurrencePatch = {
  roomId?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  attendees?: number;
  purpose?: string | null;
};

export type BookingSeriesActor = {
  userId: string;
  role: string;
  correlationId?: string;
};

export type BookingAlternative = {
  rank: 1 | 2 | 3;
  reason: "SAME_ROOM_NEARBY_TIME" | "ANOTHER_ROOM_SAME_TIME" | "ROOM_AND_TIME_COMBINATION";
  roomId: string;
  roomName: string;
  startTime: string;
  endTime: string;
};

export type BookingSeriesConflict = {
  date: string;
  startTime: string;
  endTime: string;
  code: string;
  message: string;
  suggestedAlternatives: BookingAlternative[];
};

export type BookingSeriesPreview = {
  occurrenceCount: number;
  validOccurrences: Array<{ date: string; startTime: string; endTime: string }>;
  conflicts: BookingSeriesConflict[];
  canCreateAtomically: boolean;
};
