import { CheckInPolicyError } from "./check-in.errors";

export const CHECK_IN_EARLY_MINUTES = 10;
export const CHECK_IN_LATE_MINUTES = 12;
export const QR_TOKEN_TTL_MS = 2 * 60_000;

type CheckInBooking = {
  status: string;
  roomId: string;
  startTime: Date;
  qrExpiresAt?: Date | null;
};

type CheckInDevice = {
  id: string;
  roomId: string | null;
  isActive: boolean;
  revokedAt: Date | null;
};

export class CheckInPolicyService {
  getWindow(startTime: Date) {
    return {
      opensAt: new Date(startTime.getTime() - CHECK_IN_EARLY_MINUTES * 60_000),
      closesAt: new Date(startTime.getTime() + CHECK_IN_LATE_MINUTES * 60_000),
    };
  }

  assertTimeWindow(startTime: Date, now: Date): void {
    const { opensAt, closesAt } = this.getWindow(startTime);
    if (now < opensAt) {
      throw new CheckInPolicyError(
        "CHECK_IN_TOO_EARLY",
        `Check-in opens ${CHECK_IN_EARLY_MINUTES} minutes before the booking starts`,
      );
    }
    if (now > closesAt) {
      throw new CheckInPolicyError(
        "CHECK_IN_TOO_LATE",
        `Check-in closed ${CHECK_IN_LATE_MINUTES} minutes after the booking started`,
      );
    }
  }

  assertCanGenerateQr(booking: CheckInBooking, now: Date): void {
    if (booking.status !== "CONFIRMED") {
      throw new CheckInPolicyError("BOOKING_NOT_CONFIRMED", "Only confirmed bookings can generate a QR code");
    }
    this.assertTimeWindow(booking.startTime, now);
  }

  assertCanCheckIn(
    booking: CheckInBooking,
    device: CheckInDevice,
    now: Date,
  ): asserts device is CheckInDevice & { roomId: string } {
    this.assertTrustedDevice(device, booking.roomId);
    if (booking.status !== "CONFIRMED") {
      throw new CheckInPolicyError("BOOKING_NOT_CONFIRMED", "Booking is not confirmed");
    }
    this.assertTimeWindow(booking.startTime, now);
    if (!booking.qrExpiresAt || booking.qrExpiresAt < now) {
      throw new CheckInPolicyError("QR_EXPIRED", "QR token has expired");
    }
  }

  assertTrustedDevice(
    device: CheckInDevice,
    roomId: string,
  ): asserts device is CheckInDevice & { roomId: string } {
    if (!device.isActive) {
      throw new CheckInPolicyError("DEVICE_INACTIVE", "Device is inactive");
    }
    if (device.revokedAt) {
      throw new CheckInPolicyError("DEVICE_REVOKED", "Device credential has been revoked");
    }
    if (!device.roomId) {
      throw new CheckInPolicyError("DEVICE_NOT_ASSIGNED", "Device is not assigned to a room");
    }
    if (roomId !== device.roomId) {
      throw new CheckInPolicyError("WRONG_ROOM", "QR code is for a different room");
    }
  }

  qrExpiry(startTime: Date, now: Date): Date {
    const { closesAt } = this.getWindow(startTime);
    return new Date(Math.min(now.getTime() + QR_TOKEN_TTL_MS, closesAt.getTime()));
  }
}
