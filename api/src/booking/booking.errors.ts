export type BookingPolicyErrorCode =
  | "INVALID_TIME_RANGE"
  | "START_TIME_IN_PAST"
  | "DURATION_LIMIT_EXCEEDED"
  | "ROOM_NOT_FOUND"
  | "ROOM_INACTIVE"
  | "CAPACITY_EXCEEDED"
  | "ROLE_NOT_ALLOWED"
  | "OUTSIDE_OPENING_HOURS"
  | "ROOM_CLOSED"
  | "USER_OVERLAP"
  | "ROOM_OVERLAP"
  | "ADVANCE_LIMIT_EXCEEDED"
  | "ACTIVE_LIMIT_EXCEEDED"
  | "USER_NOT_FOUND"
  | "INVALID_STATE_TRANSITION"
  | "CONCURRENT_BOOKING_CONFLICT";

export class BookingPolicyError extends Error {
  constructor(
    public readonly code: BookingPolicyErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "BookingPolicyError";
  }
}

export function isBookingPolicyError(error: unknown): error is BookingPolicyError {
  return error instanceof BookingPolicyError;
}
