import type { DayOfWeek } from "../../generated/prisma/client";
import {
  addCalendarDays,
  bangkokDateAsUtcDate,
  bangkokLocalDateTimeToInstant,
  getBangkokDateTime,
  parseClockMinutes,
} from "../lib/bangkok-time";
import { BookingSeriesError } from "./booking-series.errors";
import type { BookingSeriesTemplateInput } from "./booking-series.types";

const VALID_WEEKDAYS = new Set<DayOfWeek>([
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
]);

function boundedPositiveInteger(value: string | undefined, fallback: number, maximum: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= maximum ? parsed : fallback;
}

export function bookingSeriesLimitsFromEnv() {
  return {
    maxOccurrences: boundedPositiveInteger(process.env.BOOKING_SERIES_MAX_OCCURRENCES, 26, 104),
    maxSpanDays: boundedPositiveInteger(process.env.BOOKING_SERIES_MAX_SPAN_DAYS, 366, 730),
  };
}

function assertCalendarDate(value: string) {
  const date = bangkokDateAsUtcDate(value);
  if (date.toISOString().slice(0, 10) !== value) {
    throw new BookingSeriesError("INVALID_RECURRENCE", `Invalid calendar date: ${value}`);
  }
  return date;
}

export type BookingSeriesOccurrence = {
  date: string;
  occurrenceDate: Date;
  startTime: Date;
  endTime: Date;
};

export function generateWeeklyOccurrences(
  input: BookingSeriesTemplateInput,
  limits = bookingSeriesLimitsFromEnv(),
): BookingSeriesOccurrence[] {
  const startDate = assertCalendarDate(input.startDate);
  const endDate = assertCalendarDate(input.endDate);
  if (startDate > endDate) {
    throw new BookingSeriesError("INVALID_RECURRENCE", "Series startDate must be on or before endDate");
  }
  if (!Number.isInteger(input.attendees) || input.attendees < 1) {
    throw new BookingSeriesError("INVALID_RECURRENCE", "Series attendees must be a positive integer");
  }

  const weekdays = [...new Set(input.weekdays)];
  if (weekdays.length === 0 || weekdays.some((day) => !VALID_WEEKDAYS.has(day))) {
    throw new BookingSeriesError("INVALID_RECURRENCE", "Select at least one valid weekday");
  }
  if (weekdays.length !== input.weekdays.length) {
    throw new BookingSeriesError("INVALID_RECURRENCE", "Recurring weekdays must not contain duplicates");
  }

  let opensAt: number;
  let closesAt: number;
  try {
    opensAt = parseClockMinutes(input.startTime);
    closesAt = parseClockMinutes(input.endTime);
  } catch (error) {
    throw new BookingSeriesError(
      "INVALID_RECURRENCE",
      error instanceof Error ? error.message : "Invalid series time",
    );
  }
  if (opensAt >= closesAt) {
    throw new BookingSeriesError("INVALID_RECURRENCE", "Series startTime must be before endTime");
  }

  const spanDays = Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;
  if (spanDays > limits.maxSpanDays) {
    throw new BookingSeriesError(
      "SERIES_TOO_LARGE",
      `Series date range cannot exceed ${limits.maxSpanDays} days`,
    );
  }

  const selected = new Set(weekdays);
  const occurrences: BookingSeriesOccurrence[] = [];
  for (let offset = 0; offset < spanDays; offset++) {
    const date = addCalendarDays(input.startDate, offset);
    const midday = bangkokLocalDateTimeToInstant(date, "12:00");
    if (!selected.has(getBangkokDateTime(midday).dayOfWeek)) continue;
    occurrences.push({
      date,
      occurrenceDate: bangkokDateAsUtcDate(date),
      startTime: bangkokLocalDateTimeToInstant(date, input.startTime),
      endTime: bangkokLocalDateTimeToInstant(date, input.endTime),
    });
    if (occurrences.length > limits.maxOccurrences) {
      throw new BookingSeriesError(
        "SERIES_TOO_LARGE",
        `Series cannot contain more than ${limits.maxOccurrences} occurrences`,
      );
    }
  }

  if (occurrences.length === 0) {
    throw new BookingSeriesError("INVALID_RECURRENCE", "The selected date range has no matching weekdays");
  }
  return occurrences;
}
