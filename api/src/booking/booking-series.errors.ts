import type { BookingSeriesConflict } from "./booking-series.types";

export type BookingSeriesErrorCode =
  | "INVALID_RECURRENCE"
  | "SERIES_TOO_LARGE"
  | "SERIES_NOT_FOUND"
  | "OCCURRENCE_NOT_FOUND"
  | "SERIES_CANCELLED"
  | "SERIES_CONFLICT"
  | "INVALID_SERIES_SCOPE"
  | "PRO_REQUIRED"
  | "UNAUTHORIZED";

export class BookingSeriesError extends Error {
  constructor(
    public readonly code: BookingSeriesErrorCode,
    message: string,
    public readonly conflicts: BookingSeriesConflict[] = [],
  ) {
    super(message);
    this.name = "BookingSeriesError";
  }
}

export function isBookingSeriesError(error: unknown): error is BookingSeriesError {
  return error instanceof BookingSeriesError;
}
