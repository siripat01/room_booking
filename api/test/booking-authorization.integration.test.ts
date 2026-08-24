import { afterAll, beforeAll, expect, test } from "bun:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { BookingService } from "../src/booking/booking.service";

const connectionString = process.env.TEST_DATABASE_URL;
const integrationTest = connectionString ? test : test.skip;
const prisma = connectionString
  ? new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
  : null;

const suffix = crypto.randomUUID();
const ownerId = `authorization-owner-${suffix}`;
const outsiderId = `authorization-outsider-${suffix}`;
const adminId = `authorization-admin-${suffix}`;
const roomId = `authorization-room-${suffix}`;
const bookingId = `authorization-booking-${suffix}`;

beforeAll(async () => {
  if (!prisma) return;
  await prisma.user.createMany({
    data: [
      { id: ownerId, name: "Booking Owner", email: `${ownerId}@example.com`, role: "userRole" },
      { id: outsiderId, name: "Booking Outsider", email: `${outsiderId}@example.com`, role: "userRole" },
      { id: adminId, name: "Booking Admin", email: `${adminId}@example.com`, role: "adminRole" },
    ],
  });
  await prisma.room.create({
    data: { id: roomId, name: "Authorization Room", floor: "TEST", capacity: 10 },
  });
  await prisma.booking.create({
    data: {
      id: bookingId,
      userId: ownerId,
      roomId,
      startTime: new Date("2099-08-01T03:00:00.000Z"),
      endTime: new Date("2099-08-01T04:00:00.000Z"),
      attendees: 2,
      status: "PENDING",
      qrTokenHash: "a".repeat(64),
    },
  });
  await prisma.auditLog.create({
    data: {
      actorType: "USER",
      actorId: ownerId,
      targetType: "BOOKING",
      targetId: bookingId,
      bookingId,
      roomId,
      eventType: "CREATED",
      newStatus: "PENDING",
    },
  });
});

afterAll(async () => {
  if (!prisma) return;
  await prisma.auditLog.deleteMany({ where: { bookingId } });
  await prisma.booking.deleteMany({ where: { id: bookingId } });
  await prisma.room.deleteMany({ where: { id: roomId } });
  await prisma.user.deleteMany({ where: { id: { in: [ownerId, outsiderId, adminId] } } });
  await prisma.$disconnect();
});

integrationTest("booking ownership prevents users from reading another user's booking", async () => {
  if (!prisma) throw new Error("TEST_DATABASE_URL is required");
  const service = new BookingService(prisma);

  await expect(service.getBookingById(bookingId, outsiderId, "userRole")).rejects.toThrow("Unauthorized");
  const ownerBooking = await service.getBookingById(bookingId, ownerId, "userRole");
  expect(ownerBooking.id).toBe(bookingId);
  expect("qrTokenHash" in ownerBooking).toBe(false);
  expect("events" in ownerBooking).toBe(false);
});

integrationTest("non-admin list filters cannot be used to enumerate another user's bookings", async () => {
  if (!prisma) throw new Error("TEST_DATABASE_URL is required");
  const service = new BookingService(prisma);

  const outsiderView = await service.getBookings(outsiderId, "userRole", { userId: ownerId });
  expect(outsiderView.bookings).toHaveLength(0);

  const adminView = await service.getBookings(adminId, "adminRole", { userId: ownerId });
  expect(adminView.bookings.map(({ id }) => id)).toContain(bookingId);
});

integrationTest("booking timeline rejects non-admin callers at the service boundary", async () => {
  if (!prisma) throw new Error("TEST_DATABASE_URL is required");
  const service = new BookingService(prisma);

  await expect(service.getBookingTimeline(bookingId, "userRole")).rejects.toThrow("Unauthorized");
  const timeline = await service.getBookingTimeline(bookingId, "adminRole");
  expect(timeline.map(({ eventType }) => eventType)).toContain("CREATED");
});
