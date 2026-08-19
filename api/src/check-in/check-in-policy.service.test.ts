import { describe, expect, test } from "bun:test";
import { CheckInPolicyService, QR_TOKEN_TTL_MS } from "./check-in-policy.service";

const policy = new CheckInPolicyService();
const startTime = new Date("2026-08-20T03:00:00.000Z");
const booking = {
  status: "CONFIRMED",
  roomId: "room-a",
  startTime,
  qrExpiresAt: new Date("2026-08-20T03:12:00.000Z"),
};
const device = {
  id: "device-a",
  roomId: "room-a",
  isActive: true,
  revokedAt: null,
};

describe("CheckInPolicyService", () => {
  test("uses the shared -10/+12 minute check-in window", () => {
    expect(policy.getWindow(startTime)).toEqual({
      opensAt: new Date("2026-08-20T02:50:00.000Z"),
      closesAt: new Date("2026-08-20T03:12:00.000Z"),
    });
  });

  test("rejects a QR scan before the window", () => {
    expect(() => policy.assertCanCheckIn(
      booking,
      device,
      new Date("2026-08-20T02:49:59.999Z"),
    )).toThrow(/opens 10 minutes before/);
  });

  test("accepts both inclusive window boundaries", () => {
    expect(() => policy.assertCanCheckIn(booking, device, new Date("2026-08-20T02:50:00.000Z"))).not.toThrow();
    expect(() => policy.assertCanCheckIn(booking, device, new Date("2026-08-20T03:12:00.000Z"))).not.toThrow();
  });

  test("accepts a scan inside the post-start grace period", () => {
    expect(() => policy.assertCanCheckIn(
      booking,
      device,
      new Date("2026-08-20T03:11:00.000Z"),
    )).not.toThrow();
  });

  test("rejects a scan after the grace period", () => {
    expect(() => policy.assertCanCheckIn(
      booking,
      device,
      new Date("2026-08-20T03:12:00.001Z"),
    )).toThrow(/closed 12 minutes after/);
  });

  test("rejects the wrong room", () => {
    expect(() => policy.assertCanCheckIn(
      booking,
      { ...device, roomId: "room-b" },
      startTime,
    )).toThrow(/different room/);
  });

  test("rejects expired QR tokens", () => {
    expect(() => policy.assertCanCheckIn(
      { ...booking, qrExpiresAt: new Date("2026-08-20T02:59:59.999Z") },
      device,
      startTime,
    )).toThrow(/expired/);
  });

  test("rejects inactive and revoked devices", () => {
    expect(() => policy.assertCanCheckIn(booking, { ...device, isActive: false }, startTime)).toThrow(/inactive/);
    expect(() => policy.assertCanCheckIn(booking, { ...device, revokedAt: startTime }, startTime)).toThrow(/revoked/);
  });

  test("caps QR expiry at the end of the shared check-in window", () => {
    expect(policy.qrExpiry(startTime, new Date("2026-08-20T03:11:00.000Z"))).toEqual(
      new Date("2026-08-20T03:12:00.000Z"),
    );
    expect(policy.qrExpiry(startTime, startTime).getTime() - startTime.getTime()).toBe(QR_TOKEN_TTL_MS);
  });
});
