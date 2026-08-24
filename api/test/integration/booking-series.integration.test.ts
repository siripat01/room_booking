import { afterAll, beforeAll, expect, test } from "bun:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";
import { BookingSeriesError } from "../../src/booking/booking-series.errors";
import { BookingAlternativeService } from "../../src/booking/booking-alternative.service";
import { BookingSeriesService } from "../../src/booking/booking-series.service";
import { addCalendarDays, getBangkokDateTime } from "../../src/lib/bangkok-time";
import { RecurringEntitlementService } from "../../src/subscription/recurring-entitlement.service";

const connectionString = process.env.TEST_DATABASE_URL;
const integrationTest = connectionString ? test : test.skip;
const prisma = connectionString
  ? new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
  : null;

const suffix = crypto.randomUUID();
const proUserId = `series-pro-${suffix}`;
const freeUserId = `series-free-${suffix}`;
const blockerUserId = `series-blocker-${suffix}`;
const roomId = `series-room-${suffix}`;
const alternativeRoomId = `series-alternative-${suffix}`;
let monday = "2099-01-01";
while (getBangkokDateTime(new Date(`${monday}T05:00:00.000Z`)).dayOfWeek !== "MONDAY") {
  monday = addCalendarDays(monday, 1);
}
const template = {
  roomId,
  startDate: monday,
  endDate: addCalendarDays(monday, 14),
  weekdays: ["MONDAY" as const],
  startTime: "10:00",
  endTime: "11:00",
  attendees: 3,
  purpose: "Weekly planning",
};
const proActor = { userId: proUserId, role: "adminRole", correlationId: `series-${suffix}` };

beforeAll(async () => {
  if (!prisma) return;
  await prisma.user.createMany({
    data: [
      {
        id: proUserId,
        name: "Series Pro",
        email: `${proUserId}@example.com`,
        role: "adminRole",
        plan: "PRO",
      },
      {
        id: freeUserId,
        name: "Series Free",
        email: `${freeUserId}@example.com`,
        role: "userRole",
        plan: "FREE",
      },
      {
        id: blockerUserId,
        name: "Series Blocker",
        email: `${blockerUserId}@example.com`,
        role: "userRole",
        plan: "PRO",
      },
    ],
  });
  const timeSlots = [
    "SUNDAY",
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
  ].map((dayOfWeek) => ({ dayOfWeek: dayOfWeek as never, openTime: "00:00", closeTime: "24:00" }));
  await prisma.room.createMany({
    data: [
      { id: roomId, name: "Series Room", floor: "TEST", capacity: 10, amenities: ["projector"] },
      {
        id: alternativeRoomId,
        name: "Series Alternative",
        floor: "TEST",
        capacity: 10,
        amenities: ["projector"],
      },
    ],
  });
  await prisma.timeSlot.createMany({
    data: [roomId, alternativeRoomId].flatMap((id) =>
      timeSlots.map((slot) => ({ roomId: id, ...slot })),
    ),
  });
});

afterAll(async () => {
  if (!prisma) return;
  await prisma.notificationJob.deleteMany({
    where: { userId: { in: [proUserId, freeUserId, blockerUserId] } },
  });
  await prisma.auditLog.deleteMany({ where: { roomId: { in: [roomId, alternativeRoomId] } } });
  await prisma.booking.deleteMany({
    where: { OR: [{ roomId: { in: [roomId, alternativeRoomId] } }, { userId: proUserId }] },
  });
  await prisma.bookingSeries.deleteMany({ where: { userId: proUserId } });
  await prisma.room.deleteMany({ where: { id: { in: [roomId, alternativeRoomId] } } });
  await prisma.user.deleteMany({
    where: { id: { in: [proUserId, freeUserId, blockerUserId] } },
  });
  await prisma.$disconnect();
});

integrationTest("recurring preview and mutation require active Pro entitlement", async () => {
  if (!prisma) throw new Error("TEST_DATABASE_URL is required");
  const service = new BookingSeriesService(prisma);
  await expect(
    service.preview(template, { userId: freeUserId, role: "userRole" }),
  ).rejects.toMatchObject({ code: "PRO_REQUIRED" });
});

integrationTest("smart alternatives are deterministic and ordered by explainable rank", async () => {
  if (!prisma) throw new Error("TEST_DATABASE_URL is required");
  const service = new BookingAlternativeService();
  const input = {
    userId: proUserId,
    userRole: "adminRole",
    roomId,
    startTime: new Date(`${monday}T10:00:00.000+07:00`),
    endTime: new Date(`${monday}T11:00:00.000+07:00`),
    attendees: 3,
  };

  const first = await prisma.$transaction((tx) => service.suggest(tx, input, 20));
  const second = await prisma.$transaction((tx) => service.suggest(tx, input, 20));

  expect(second).toEqual(first);
  expect(new Set(first.map(({ rank }) => rank))).toEqual(new Set([1, 2, 3]));
  expect(first.map(({ rank }) => rank)).toEqual([...first.map(({ rank }) => rank)].sort());
  expect(first.find(({ rank }) => rank === 1)?.reason).toBe("SAME_ROOM_NEARBY_TIME");
  expect(first.find(({ rank }) => rank === 2)?.reason).toBe("ANOTHER_ROOM_SAME_TIME");
  expect(first.find(({ rank }) => rank === 3)?.reason).toBe("ROOM_AND_TIME_COMBINATION");
});

integrationTest("preview reports conflicts and atomic creation leaves no partial series", async () => {
  if (!prisma) throw new Error("TEST_DATABASE_URL is required");
  const service = new BookingSeriesService(prisma);
  const conflictStart = new Date(`${addCalendarDays(monday, 7)}T10:00:00.000+07:00`);
  const blocker = await prisma.booking.create({
    data: {
      userId: blockerUserId,
      roomId,
      startTime: conflictStart,
      endTime: new Date(conflictStart.getTime() + 60 * 60_000),
      attendees: 1,
      status: "CONFIRMED",
    },
  });

  const preview = await service.preview(template, proActor);
  expect(preview.canCreateAtomically).toBe(false);
  expect(preview.conflicts).toHaveLength(1);
  expect(preview.conflicts[0]).toMatchObject({
    date: addCalendarDays(monday, 7),
    code: "ROOM_OVERLAP",
  });
  expect(preview.conflicts[0].suggestedAlternatives.length).toBeGreaterThan(0);
  const before = await prisma.bookingSeries.count({ where: { userId: proUserId } });
  await expect(service.create(template, proActor)).rejects.toBeInstanceOf(BookingSeriesError);
  expect(await prisma.bookingSeries.count({ where: { userId: proUserId } })).toBe(before);
  expect(await prisma.booking.count({ where: { userId: proUserId } })).toBe(0);
  await prisma.booking.delete({ where: { id: blocker.id } });
});

integrationTest("series supports occurrence, whole, future edits and entitlement expiry cancellation", async () => {
  if (!prisma) throw new Error("TEST_DATABASE_URL is required");
  const service = new BookingSeriesService(prisma);
  const created = await service.create(template, proActor);
  expect(created.bookings).toHaveLength(3);

  const first = created.bookings[0];
  const editedOccurrence = await service.editOccurrence(
    created.id,
    first.id,
    { startTime: "12:00", endTime: "13:00" },
    proActor,
  );
  expect(editedOccurrence.isSeriesException).toBe(true);

  const whole = await service.editSeries(
    created.id,
    "WHOLE_SERIES",
    { attendees: 5 },
    proActor,
  );
  expect(whole.bookings.filter(({ status }) => status !== "CANCELLED")).toHaveLength(3);
  expect(whole.bookings.every(({ attendees }) => attendees === 5)).toBe(true);

  const pivot = whole.bookings[1];
  const replacement = await service.editSeries(
    created.id,
    "THIS_AND_FUTURE",
    { startTime: "14:00", endTime: "15:00" },
    proActor,
    pivot.id,
  );
  expect(replacement.id).not.toBe(created.id);
  expect(replacement.bookings).toHaveLength(2);
  await expect(service.cancelSeries(created.id, "ENTIRE", proActor)).resolves.toMatchObject({
    cancelledOccurrences: 1,
  });

  await prisma.user.update({
    where: { id: proUserId },
    data: { plan: "PRO", planExpiresAt: new Date("2026-08-24T00:00:00.000Z") },
  });
  const expired = await new RecurringEntitlementService(prisma).expireDueProAccess(
    new Date("2026-08-24T00:01:00.000Z"),
  );
  expect(expired).toMatchObject({ usersExpired: 1, seriesCancelled: 1, bookingsCancelled: 2 });
  expect((await prisma.user.findUniqueOrThrow({ where: { id: proUserId } })).plan).toBe("FREE");
  expect((await prisma.bookingSeries.findUniqueOrThrow({ where: { id: replacement.id } })).status).toBe(
    "CANCELLED",
  );

  await expect(
    service.editOccurrence(replacement.id, replacement.bookings[0].id, { attendees: 2 }, proActor),
  ).rejects.toMatchObject({ code: "PRO_REQUIRED" });
  await expect(
    service.cancelSeries(replacement.id, "ENTIRE", proActor),
  ).resolves.toMatchObject({ cancelledOccurrences: 0 });
});
