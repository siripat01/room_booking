import { afterAll, beforeAll, expect, test } from "bun:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { BookingService } from "../src/booking/booking.service";
import { getBangkokDateTime } from "../src/lib/bangkok-time";

const connectionString = process.env.TEST_DATABASE_URL;
const integrationTest = connectionString ? test : test.skip;
const prisma = connectionString
  ? new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
  : null;

const suffix = crypto.randomUUID();
const roomId = `concurrency-room-${suffix}`;
const userIds = [`concurrency-user-a-${suffix}`, `concurrency-user-b-${suffix}`];

let startTime = new Date(0);
let endTime = new Date(0);

beforeAll(async () => {
  if (!prisma) return;

  const candidate = new Date(Date.now() + 24 * 60 * 60_000);
  while (["SATURDAY", "SUNDAY"].includes(getBangkokDateTime(candidate).dayOfWeek)) {
    candidate.setUTCDate(candidate.getUTCDate() + 1);
  }
  const bangkok = getBangkokDateTime(candidate);
  startTime = new Date(`${bangkok.date}T10:00:00.000+07:00`);
  endTime = new Date(`${bangkok.date}T11:00:00.000+07:00`);

  await prisma.user.createMany({
    data: userIds.map((id, index) => ({
      id,
      name: `Concurrency User ${index + 1}`,
      email: `${id}@example.com`,
      role: "userRole",
      plan: "PRO",
    })),
  });
  await prisma.room.create({
    data: {
      id: roomId,
      name: "Concurrency Test Room",
      floor: "TEST",
      capacity: 10,
      isActive: true,
      timeSlots: {
        create: {
          dayOfWeek: getBangkokDateTime(startTime).dayOfWeek,
          openTime: "08:00",
          closeTime: "18:00",
          isActive: true,
        },
      },
    },
  });
});

afterAll(async () => {
  if (!prisma) return;
  await prisma.booking.deleteMany({ where: { roomId } });
  await prisma.room.deleteMany({ where: { id: roomId } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

integrationTest("two simultaneous requests cannot reserve the same room and time", async () => {
  if (!prisma) throw new Error("TEST_DATABASE_URL is required");
  const service = new BookingService(prisma);

  const results = await Promise.allSettled(userIds.map((userId) => service.createBooking({
    userId,
    roomId,
    startTime,
    endTime,
    attendees: 2,
    purpose: "Concurrency test",
    autoConfirm: false,
    userRole: "userRole",
  })));

  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  expect(await prisma.booking.count({
    where: { roomId, startTime, endTime, status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] } },
  })).toBe(1);
  expect(await prisma.bookingEvent.count({ where: { roomId, eventType: "CREATED" } })).toBe(1);

  const winner = await prisma.booking.findFirstOrThrow({ where: { roomId } });
  await service.cancelBooking(winner.id, winner.userId, "userRole", "Integration test cleanup");
  expect(await prisma.bookingEvent.findMany({
    where: { bookingId: winner.id },
    orderBy: { createdAt: "asc" },
    select: { previousStatus: true, newStatus: true, eventType: true },
  })).toEqual([
    { previousStatus: null, newStatus: "PENDING", eventType: "CREATED" },
    { previousStatus: "PENDING", newStatus: "CANCELLED", eventType: "CANCELLED" },
  ]);
});
