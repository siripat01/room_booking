import { afterAll, beforeAll, expect, test } from "bun:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type BackgroundJobType } from "../../generated/prisma/client";
import { getBangkokDateTime } from "../../src/lib/bangkok-time";
import { BackgroundJobScheduler } from "../../src/jobs/background-job.scheduler";
import { BackgroundJobWorker } from "../../src/jobs/background-job.worker";
import { BackgroundJobHandlers } from "../../src/jobs/background-job.handlers";
import { BookingService } from "../../src/booking/booking.service";

const connectionString = process.env.TEST_DATABASE_URL;
const integrationTest = connectionString ? test : test.skip;
const prisma = connectionString
  ? new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
  : null;

const suffix = crypto.randomUUID();
const userId = `jobs-user-${suffix}`;
const roomId = `jobs-room-${suffix}`;
const trackedJobIds: string[] = [];
let startTime = new Date(0);

beforeAll(async () => {
  if (!prisma) return;
  const candidate = new Date(Date.now() + 24 * 60 * 60_000);
  while (["SATURDAY", "SUNDAY"].includes(getBangkokDateTime(candidate).dayOfWeek)) {
    candidate.setUTCDate(candidate.getUTCDate() + 1);
  }
  const bangkok = getBangkokDateTime(candidate);
  startTime = new Date(`${bangkok.date}T10:00:00.000+07:00`);

  await prisma.user.create({
    data: {
      id: userId,
      name: "Background Job User",
      email: `${userId}@example.com`,
      role: "userRole",
      plan: "PRO",
    },
  });
  await prisma.room.create({
    data: {
      id: roomId,
      name: "Background Job Room",
      floor: "TEST",
      capacity: 12,
      timeSlots: {
        create: {
          dayOfWeek: getBangkokDateTime(startTime).dayOfWeek,
          openTime: "08:00",
          closeTime: "18:00",
        },
      },
    },
  });
});

afterAll(async () => {
  if (!prisma) return;
  await prisma.notificationJob.deleteMany({ where: { userId } });
  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { targetId: { in: trackedJobIds } },
        { bookingId: { not: null }, roomId },
        { targetType: "WAITLIST", roomId },
      ],
    },
  });
  await prisma.backgroundJob.deleteMany({ where: { id: { in: trackedJobIds } } });
  await prisma.booking.deleteMany({ where: { roomId } });
  await prisma.waitlistEntry.deleteMany({ where: { roomId } });
  await prisma.room.deleteMany({ where: { id: roomId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

integrationTest("concurrent schedulers and SKIP LOCKED workers execute each scheduled job once", async () => {
  if (!prisma) throw new Error("TEST_DATABASE_URL is required");
  const now = new Date("2099-01-02T03:07:10.000Z");
  await prisma.backgroundJob.deleteMany({
    where: { scheduledFor: new Date("2099-01-02T03:07:00.000Z") },
  });
  const schedulers = [new BackgroundJobScheduler(prisma), new BackgroundJobScheduler(prisma)];
  await Promise.all(schedulers.map((scheduler) => scheduler.enqueueDueJobs(now)));

  const jobs = await prisma.backgroundJob.findMany({
    where: { scheduledFor: new Date("2099-01-02T03:07:00.000Z") },
  });
  trackedJobIds.push(...jobs.map(({ id }) => id));
  expect(jobs).toHaveLength(4);

  const executions = new Map<BackgroundJobType, number>();
  const handler = (type: BackgroundJobType) => async () => {
    executions.set(type, (executions.get(type) ?? 0) + 1);
    await new Promise((resolve) => setTimeout(resolve, 5));
    return { handled: true };
  };
  const overrides = Object.fromEntries(
    jobs.map(({ type }) => [type, handler(type)]),
  ) as Partial<Record<BackgroundJobType, ReturnType<typeof handler>>>;
  const workers = [
    new BackgroundJobWorker(prisma, `jobs-worker-a-${suffix}`, overrides),
    new BackgroundJobWorker(prisma, `jobs-worker-b-${suffix}`, overrides),
  ];
  await Promise.all(workers.map((worker) => worker.runOnce(10, now)));

  expect([...executions.values()].reduce((total, count) => total + count, 0)).toBe(4);
  expect([...executions.values()].every((count) => count === 1)).toBe(true);
  expect(await prisma.backgroundJob.count({
    where: { id: { in: trackedJobIds }, status: "COMPLETED" },
  })).toBe(4);
});

integrationTest("failed jobs persist retry state and complete on a later attempt", async () => {
  if (!prisma) throw new Error("TEST_DATABASE_URL is required");
  const now = new Date("2099-01-02T04:00:00.000Z");
  const job = await prisma.backgroundJob.create({
    data: {
      type: "EXPIRE_BOOKINGS",
      jobKey: `integration-retry-${suffix}`,
      scheduledFor: now,
      availableAt: now,
      maxAttempts: 3,
    },
  });
  trackedJobIds.push(job.id);
  let attempts = 0;
  const worker = new BackgroundJobWorker(prisma, `jobs-retry-worker-${suffix}`, {
    EXPIRE_BOOKINGS: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("Temporary integration failure");
      return { recovered: true };
    },
  });

  await worker.runOnce(1, now);
  expect((await prisma.backgroundJob.findUniqueOrThrow({ where: { id: job.id } })).status).toBe("RETRY");
  await worker.runOnce(1, new Date(now.getTime() + 60_000));
  const completed = await prisma.backgroundJob.findUniqueOrThrow({ where: { id: job.id } });
  expect(completed.status).toBe("COMPLETED");
  expect(completed.attempts).toBe(2);
  expect(await prisma.auditLog.count({ where: { targetId: job.id } })).toBe(2);
});

integrationTest("retention removes old terminal jobs without deleting pending work or audit history", async () => {
  if (!prisma) throw new Error("TEST_DATABASE_URL is required");
  const now = new Date("2099-06-01T00:00:00.000Z");
  const oldCompleted = await prisma.backgroundJob.create({
    data: {
      type: "EXPIRE_BOOKINGS",
      status: "COMPLETED",
      jobKey: `retention-completed-${suffix}`,
      scheduledFor: new Date("2099-01-01T00:00:00.000Z"),
      completedAt: new Date("2099-01-01T00:00:00.000Z"),
      result: { expired: 0 },
    },
  });
  const purgeJob = await prisma.backgroundJob.create({
    data: {
      type: "PURGE_JOB_HISTORY",
      jobKey: `retention-purge-${suffix}`,
      scheduledFor: now,
      availableAt: now,
    },
  });
  trackedJobIds.push(oldCompleted.id, purgeJob.id);

  const oldSent = await prisma.notificationJob.create({
    data: {
      userId,
      channel: "EMAIL",
      type: "TEST",
      status: "SENT",
      idempotencyKey: `retention-sent-${suffix}`,
      payload: { purpose: "retention test" },
      sentAt: new Date("2099-01-01T00:00:00.000Z"),
      createdAt: new Date("2099-01-01T00:00:00.000Z"),
      updatedAt: new Date("2099-01-01T00:00:00.000Z"),
    },
  });
  const pending = await prisma.notificationJob.create({
    data: {
      userId,
      channel: "EMAIL",
      type: "TEST",
      status: "PENDING",
      idempotencyKey: `retention-pending-${suffix}`,
      payload: { purpose: "must survive retention" },
      createdAt: new Date("2099-01-01T00:00:00.000Z"),
      updatedAt: new Date("2099-01-01T00:00:00.000Z"),
    },
  });
  await prisma.auditLog.create({
    data: {
      actorType: "SYSTEM",
      targetType: "JOB",
      targetId: oldCompleted.id,
      eventType: "RETENTION_TEST_AUDIT",
      createdAt: new Date("2099-01-01T00:00:00.000Z"),
    },
  });

  const result = await new BackgroundJobHandlers(prisma).for("PURGE_JOB_HISTORY")(purgeJob.id, now);

  expect(result.backgroundJobsDeleted).toBeGreaterThanOrEqual(1);
  expect(result.terminalNotificationsDeleted).toBeGreaterThanOrEqual(1);
  expect(await prisma.backgroundJob.findUnique({ where: { id: oldCompleted.id } })).toBeNull();
  expect(await prisma.notificationJob.findUnique({ where: { id: oldSent.id } })).toBeNull();
  expect(await prisma.notificationJob.findUnique({ where: { id: pending.id } })).not.toBeNull();
  expect(await prisma.auditLog.count({ where: { targetId: oldCompleted.id } })).toBe(1);
});

integrationTest("scheduled waitlist promotion uses booking policy and records a correlated timeline", async () => {
  if (!prisma) throw new Error("TEST_DATABASE_URL is required");
  const entry = await prisma.waitlistEntry.create({
    data: {
      userId,
      roomId,
      startTime,
      endTime: new Date(startTime.getTime() + 60 * 60_000),
      attendees: 2,
      purpose: "Scheduled waitlist promotion",
    },
  });
  const now = new Date();
  const job = await prisma.backgroundJob.create({
    data: {
      type: "PROMOTE_WAITLIST",
      jobKey: `integration-waitlist-${suffix}`,
      scheduledFor: now,
      availableAt: now,
    },
  });
  trackedJobIds.push(job.id);

  await new BackgroundJobWorker(prisma, `jobs-waitlist-worker-${suffix}`).runOnce(1, now);

  expect((await prisma.waitlistEntry.findUniqueOrThrow({ where: { id: entry.id } })).status).toBe("PROMOTED");
  const booking = await prisma.booking.findFirstOrThrow({ where: { roomId, userId, startTime } });
  expect(booking.status).toBe("CONFIRMED");
  expect(await prisma.bookingEvent.count({ where: { bookingId: booking.id, eventType: "CREATED" } })).toBe(1);
  expect(await prisma.auditLog.count({
    where: { bookingId: booking.id, correlationId: job.id },
  })).toBeGreaterThanOrEqual(1);
  expect((await prisma.backgroundJob.findUniqueOrThrow({ where: { id: job.id } })).status).toBe("COMPLETED");

  const legacyEvent = await prisma.bookingEvent.create({
    data: {
      bookingId: booking.id,
      roomId,
      actorType: "SYSTEM",
      eventType: "APPROVED",
      previousStatus: "PENDING",
      newStatus: "CONFIRMED",
      correlationId: `legacy-instance-${suffix}`,
      metadata: { rollingDeploy: true },
    },
  });
  const timeline = await new BookingService(prisma).getBookingTimeline(booking.id, "adminRole");
  expect(timeline.some(({ id }) => id === `booking-event:${legacyEvent.id}`)).toBe(true);
});
