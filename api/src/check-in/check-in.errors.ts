export type CheckInPolicyErrorCode =
  | "BOOKING_NOT_CONFIRMED"
  | "CHECK_IN_TOO_EARLY"
  | "CHECK_IN_TOO_LATE"
  | "DEVICE_INACTIVE"
  | "DEVICE_REVOKED"
  | "DEVICE_CREDENTIAL_STALE"
  | "DEVICE_NOT_ASSIGNED"
  | "WRONG_ROOM"
  | "QR_EXPIRED"
  | "INVALID_QR";

export class CheckInPolicyError extends Error {
  constructor(
    public readonly code: CheckInPolicyErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CheckInPolicyError";
  }
}
