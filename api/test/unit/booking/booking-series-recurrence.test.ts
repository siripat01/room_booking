import { describe, expect, test } from "bun:test";
import { BookingSeriesError } from "../../../src/booking/booking-series.errors";
import { generateWeeklyOccurrences } from "../../../src/booking/booking-series-recurrence";

const template = {
  roomId: "room-1",
  startDate: "2026-08-24",
  endDate: "2026-09-06",
  weekdays: ["MONDAY", "WEDNESDAY"] as const,
  startTime: "10:00",
  endTime: "11:30",
  attendees: 4,
};

describe("weekly booking-series recurrence", () => {
  test("generates selected Bangkok weekdays as UTC instants", () => {
    const occurrences = generateWeeklyOccurrences(
      { ...template, weekdays: [...template.weekdays] },
      { maxOccurrences: 10, maxSpanDays: 30 },
    );

    expect(occurrences.map(({ date }) => date)).toEqual([
      "2026-08-24",
      "2026-08-26",
      "2026-08-31",
      "2026-09-02",
    ]);
    expect(occurrences[0].startTime.toISOString()).toBe("2026-08-24T03:00:00.000Z");
    expect(occurrences[0].endTime.toISOString()).toBe("2026-08-24T04:30:00.000Z");
  });

  test("rejects invalid dates, clock ranges, and oversized series", () => {
    expect(() =>
      generateWeeklyOccurrences({
        ...template,
        weekdays: [...template.weekdays],
        startDate: "2026-02-30",
      }),
    ).toThrow(BookingSeriesError);
    expect(() =>
      generateWeeklyOccurrences({
        ...template,
        weekdays: ["MONDAY", "MONDAY"],
      }),
    ).toThrow("must not contain duplicates");
    expect(() =>
      generateWeeklyOccurrences({
        ...template,
        weekdays: [...template.weekdays],
        startTime: "12:00",
        endTime: "11:00",
      }),
    ).toThrow("Series startTime must be before endTime");
    expect(() =>
      generateWeeklyOccurrences(
        { ...template, weekdays: [...template.weekdays] },
        { maxOccurrences: 2, maxSpanDays: 30 },
      ),
    ).toThrow("Series cannot contain more than 2 occurrences");
  });
});
