import { afterAll, beforeAll, expect, test } from "bun:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { BookingService } from "../src/booking/booking.service";
import { DeviceService } from "../src/device/device.service";
import { getBangkokDateTime } from "../src/lib/bangkok-time";
import { DatabaseRateLimiter } from "../src/lib/database-rate-limiter";

const connectionString = process.env.TEST_DATABASE_URL;
const integrationTest = connectionString ? test : test.skip;
const prisma = connectionString
  ? new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
  : null;
const suffix = crypto.randomUUID();
const userId = `device-security-user-${suffix}`;
const roomIds = [`device-security-room-a-${suffix}`, `device-security-room-b-${suffix}`];
const deviceIds: string[] = [];
const pairingSecret = "integration-test-pairing-secret-32-bytes";
let bookingService: BookingService;
let deviceService: DeviceService;
let firstDeviceKey = "";
let secondDeviceKey = "";
let startTime = new Date(0);
let bookingId = "";

beforeAll(async () => {
  if (!prisma) return;
  bookingService = new BookingService(prisma);
  deviceService = new DeviceService(prisma, pairingSecret);

  const candidate = new Date(Date.now() + 24 * 60 * 60_000);
  const bangkok = getBangkokDateTime(candidate);
  startTime = new Date(`${bangkok.date}T10:00:00.000+07:00`);
  const dayOfWeek = bangkok.dayOfWeek;
  await prisma.user.create({
    data: {
      id: userId,
      name: "Device Security User",
      email: `${userId}@example.com`,
      role: "userRole",
      plan: "PRO",
    },
  });
  for (const [index, roomId] of roomIds.entries()) {
    await prisma.room.create({
      data: {
        id: roomId,
        name: `Device Security Room ${index + 1}`,
        floor: "TEST",
        capacity: 10,
        isActive: true,
        timeSlots: { create: { dayOfWeek, openTime: "00:00", closeTime: "24:00", isActive: true } },
      },
    });
  }

  const first = await deviceService.createDevice({ name: "Security Kiosk A", roomId: roomIds[0] });
  const second = await deviceService.createDevice({ name: "Security Kiosk B", roomId: roomIds[1] });
  deviceIds.push(first.device.id, second.device.id);
  firstDeviceKey = first.deviceKey;
  secondDeviceKey = second.deviceKey;

  const booking = await bookingService.createBooking({
    userId,
    roomId: roomIds[0],
    startTime,
    endTime: new Date(startTime.getTime() + 30 * 60_000),
    attendees: 2,
    purpose: "Device security integration",
    autoConfirm: true,
    userRole: "userRole",
  });
  bookingId = booking.id;
});

afterAll(async () => {
  if (!prisma) return;
  await prisma.booking.deleteMany({ where: { OR: [{ id: bookingId }, { roomId: { in: roomIds } }] } });
  await prisma.auditLog.deleteMany({
    where: { OR: [{ deviceId: { in: deviceIds } }, { roomId: { in: roomIds } }] },
  });
  await prisma.rateLimitBucket.deleteMany({ where: { scope: "integration-rate-limit" } });
  const principals = await prisma.device.findMany({
    where: { id: { in: deviceIds } },
    select: { walkInPrincipalId: true },
  });
  await prisma.device.deleteMany({ where: { id: { in: deviceIds } } });
  await prisma.user.deleteMany({
    where: { id: { in: [userId, ...principals.map((principal) => principal.walkInPrincipalId)] } },
  });
  await prisma.room.deleteMany({ where: { id: { in: roomIds } } });
  await prisma.$disconnect();
});

integrationTest("QR is room-bound, expiring, accepted in grace, and single-use", async () => {
  if (!prisma) throw new Error("TEST_DATABASE_URL is required");
  const firstDevice = await deviceService.authenticateDevice(deviceIds[0], firstDeviceKey);
  const secondDevice = await deviceService.authenticateDevice(deviceIds[1], secondDeviceKey);
  if (!firstDevice || !secondDevice) throw new Error("Expected authenticated devices");

  const firstScanTime = new Date(startTime.getTime() - 5 * 60_000);
  const initialQr = await bookingService.generateQr(bookingId, userId, "userRole", firstScanTime);
  await expect(deviceService.scanQr(secondDevice, initialQr.qrToken, undefined, firstScanTime)).rejects.toMatchObject({ code: "WRONG_ROOM" });

  await prisma.booking.update({
    where: { id: bookingId },
    data: { qrExpiresAt: new Date(firstScanTime.getTime() - 1) },
  });
  await expect(deviceService.scanQr(firstDevice, initialQr.qrToken, undefined, firstScanTime)).rejects.toMatchObject({ code: "QR_EXPIRED" });

  const qr = await bookingService.generateQr(
    bookingId,
    userId,
    "userRole",
    new Date(startTime.getTime() + 10 * 60_000),
  );
  const checkedIn = await deviceService.scanQr(
    firstDevice,
    qr.qrToken,
    "device-security-test",
    new Date(startTime.getTime() + 11 * 60_000),
  );
  expect(checkedIn.status).toBe("CHECKED_IN");
  expect(checkedIn.roomId).toBe(roomIds[0]);
  await expect(deviceService.scanQr(
    firstDevice,
    qr.qrToken,
    undefined,
    new Date(startTime.getTime() + 11 * 60_000),
  )).rejects.toMatchObject({ code: "INVALID_QR" });
});

integrationTest("device rotation, revocation, reactivation, and pairing invalidate old credentials", async () => {
  if (!prisma) throw new Error("TEST_DATABASE_URL is required");
  expect(await deviceService.authenticateDevice(deviceIds[1], secondDeviceKey)).not.toBeNull();

  const rotated = await deviceService.rotateDeviceKey(deviceIds[1]);
  expect(await deviceService.authenticateDevice(deviceIds[1], secondDeviceKey)).toBeNull();
  expect(await deviceService.authenticateDevice(deviceIds[1], rotated.deviceKey)).not.toBeNull();

  await deviceService.revokeDevice(deviceIds[1]);
  expect(await deviceService.authenticateDevice(deviceIds[1], rotated.deviceKey)).toBeNull();
  const reactivated = await deviceService.reactivateDevice(deviceIds[1]);
  expect(await deviceService.authenticateDevice(deviceIds[1], reactivated.deviceKey)).not.toBeNull();

  const pairing = await deviceService.generatePairingCode(deviceIds[1]);
  const paired = await deviceService.pairDevice(pairing.code);
  expect(paired.deviceId).toBe(deviceIds[1]);
  expect(await deviceService.authenticateDevice(deviceIds[1], reactivated.deviceKey)).toBeNull();
  expect(await deviceService.authenticateDevice(deviceIds[1], paired.deviceKey)).not.toBeNull();
  await expect(deviceService.pairDevice(pairing.code)).rejects.toThrow(/Invalid or expired/);

  const auditPayload = JSON.stringify(await prisma.auditLog.findMany({
    where: { deviceId: deviceIds[1] },
    select: { eventType: true, metadata: true },
  }));
  expect(auditPayload).toContain("DEVICE_CREDENTIAL_ROTATED");
  expect(auditPayload).toContain("DEVICE_REVOKED");
  expect(auditPayload).toContain("DEVICE_REACTIVATED");
  expect(auditPayload).toContain("DEVICE_PAIRED");
  expect(auditPayload).not.toContain(rotated.deviceKey);
  expect(auditPayload).not.toContain(reactivated.deviceKey);
  expect(auditPayload).not.toContain(paired.deviceKey);
  expect(auditPayload).not.toContain(pairing.code);
});

integrationTest("walk-in uses the device system principal and records requester audit metadata", async () => {
  if (!prisma) throw new Error("TEST_DATABASE_URL is required");
  const device = await deviceService.authenticateDevice(deviceIds[0], firstDeviceKey);
  if (!device?.roomId) throw new Error("Expected an authenticated room device");

  const walkIn = await deviceService.createWalkIn(
    { ...device, roomId: device.roomId },
    {
      durationMinutes: 30,
      attendees: 3,
      purpose: "Walk-in integration",
      requesterName: "Integration Requester",
      requesterReference: "STUDENT-001",
      correlationId: "walk-in-integration",
      now: new Date(startTime.getTime() + 3 * 60 * 60_000),
    },
  );

  expect(walkIn.status).toBe("CHECKED_IN");
  expect(walkIn.userId).toBe(device.walkInPrincipalId);
  expect(walkIn.walkInRequesterName).toBe("Integration Requester");
  const events = await prisma.bookingEvent.findMany({
    where: { bookingId: walkIn.id },
    orderBy: { createdAt: "asc" },
  });
  expect(events.map((event) => event.eventType)).toEqual(["CREATED", "CHECKED_IN"]);
  expect(events[0]?.correlationId).toBe("walk-in-integration");
  expect(events[0]?.metadata).toMatchObject({ source: "walk-in", requesterReference: "STUDENT-001" });
});

integrationTest("database rate limiting is atomic across concurrent consumers", async () => {
  if (!prisma) throw new Error("TEST_DATABASE_URL is required");
  const limiter = new DatabaseRateLimiter(prisma);
  const results = await Promise.all(
    Array.from({ length: 10 }, () => limiter.consume("integration-rate-limit", suffix, 5, 300)),
  );
  expect(results.filter((result) => result.allowed)).toHaveLength(5);
  expect(results.filter((result) => !result.allowed)).toHaveLength(5);
  expect(results.every((result) => result.retryAfterSeconds > 0)).toBe(true);
});
