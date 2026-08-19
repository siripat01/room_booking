export const BUSINESS_TIME_ZONE = "Asia/Bangkok";
const BANGKOK_UTC_OFFSET = "+07:00";

const bangkokFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIME_ZONE,
  calendar: "gregory",
  numberingSystem: "latn",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  weekday: "long",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const DAY_OF_WEEK = {
  Sunday: "SUNDAY",
  Monday: "MONDAY",
  Tuesday: "TUESDAY",
  Wednesday: "WEDNESDAY",
  Thursday: "THURSDAY",
  Friday: "FRIDAY",
  Saturday: "SATURDAY",
} as const;

export type BangkokDayOfWeek = (typeof DAY_OF_WEEK)[keyof typeof DAY_OF_WEEK];

export type BangkokDateTime = {
  date: string;
  dayOfWeek: BangkokDayOfWeek;
  hour: number;
  minute: number;
  second: number;
  minutesSinceMidnight: number;
};

export function getBangkokDateTime(value: Date): BangkokDateTime {
  if (!Number.isFinite(value.getTime())) throw new Error("Invalid date");

  const parts = Object.fromEntries(
    bangkokFormatter
      .formatToParts(value)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  const weekday = DAY_OF_WEEK[parts.weekday as keyof typeof DAY_OF_WEEK];
  if (!weekday) throw new Error("Unable to resolve Bangkok weekday");

  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  const second = Number(parts.second);

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    dayOfWeek: weekday,
    hour,
    minute,
    second,
    minutesSinceMidnight: hour * 60 + minute,
  };
}

export function parseClockMinutes(value: string, options?: { allowEndOfDay?: boolean }): number {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error(`Invalid clock time: ${value}`);

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (options?.allowEndOfDay && hour === 24 && minute === 0) return 24 * 60;
  if (hour > 23 || minute > 59) throw new Error(`Invalid clock time: ${value}`);
  return hour * 60 + minute;
}

export function bangkokDateAsUtcDate(date: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`Invalid calendar date: ${date}`);
  return new Date(`${date}T00:00:00.000Z`);
}

export function bangkokLocalDateTimeToInstant(date: string, time: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`Invalid calendar date: ${date}`);
  parseClockMinutes(time);
  const instant = new Date(`${date}T${time}:00.000${BANGKOK_UTC_OFFSET}`);
  if (!Number.isFinite(instant.getTime())) throw new Error("Invalid Bangkok date-time");
  return instant;
}

export function bangkokDayBounds(date: string): { start: Date; end: Date } {
  const start = bangkokLocalDateTimeToInstant(date, "00:00");
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

export function addCalendarDays(date: string, days: number): string {
  const value = bangkokDateAsUtcDate(date);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
