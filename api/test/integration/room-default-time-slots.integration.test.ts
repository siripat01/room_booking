import { afterAll, expect, test } from "bun:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";
import { BookingPolicyService } from "../../src/booking/booking-policy.service";
import { getBangkokDateTime } from "../../src/lib/bangkok-time";
import { RoomService } from "../../src/room/room.service";

const connectionString = process.env.TEST_DATABASE_URL;
const integrationTest = connectionString ? test : test.skip;
const prisma = connectionString
  ? new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
  : null;

const suffix = crypto.randomUUID();
const userId = `default-schedule-user-${suffix}`;
let roomId: string | undefined;

afterAll(async () => {
  if (!prisma) return;
  if (roomId) {
    await prisma.auditLog.deleteMany({ where: { roomId } });
    await prisma.room.deleteMany({ where: { id: roomId } });
  }
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

integrationTest("new rooms receive default weekday opening hours", async () => {
  if (!prisma) throw new Error("TEST_DATABASE_URL is required");

  const room = await new RoomService(prisma).createRoom({
    name: `Default Schedule Room ${suffix}`,
    floor: "TEST",
    capacity: 10,
    amenities: [],
  });
  roomId = room.id;

  const slots = await prisma.timeSlot.findMany({
    where: { roomId },
    orderBy: { dayOfWeek: "asc" },
    select: { dayOfWeek: true, openTime: true, closeTime: true, isActive: true },
  });

  expect(slots).toHaveLength(5);
  expect(slots).toEqual(
    expect.arrayContaining([
      { dayOfWeek: "MONDAY", openTime: "00:00", closeTime: "24:00", isActive: true },
      { dayOfWeek: "TUESDAY", openTime: "00:00", closeTime: "24:00", isActive: true },
      { dayOfWeek: "WEDNESDAY", openTime: "00:00", closeTime: "24:00", isActive: true },
      { dayOfWeek: "THURSDAY", openTime: "00:00", closeTime: "24:00", isActive: true },
      { dayOfWeek: "FRIDAY", openTime: "00:00", closeTime: "24:00", isActive: true },
    ]),
  );

  await prisma.user.create({
    data: {
      id: userId,
      name: "Default Schedule User",
      email: `${userId}@example.com`,
      role: "adminRole",
    },
  });

  const candidate = new Date(Date.now() + 24 * 60 * 60_000);
  while (["SATURDAY", "SUNDAY"].includes(getBangkokDateTime(candidate).dayOfWeek)) {
    candidate.setUTCDate(candidate.getUTCDate() + 1);
  }
  const bangkok = getBangkokDateTime(candidate);
  const startTime = new Date(`${bangkok.date}T10:00:00.000+07:00`);

  await expect(
    new BookingPolicyService().validateCreate(prisma, {
      userId,
      roomId,
      startTime,
      endTime: new Date(startTime.getTime() + 60 * 60_000),
      attendees: 2,
    }),
  ).resolves.toMatchObject({ room: { id: roomId } });
});
