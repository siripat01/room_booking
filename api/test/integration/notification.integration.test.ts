import { afterAll, beforeAll, expect, test } from "bun:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";
import { LineLinkService } from "../../src/notification/line-link.service";
import { NotificationScheduler } from "../../src/notification/notification.scheduler";
import { NotificationService } from "../../src/notification/notification.service";
import {
  NotificationDeliveryError,
  type NotificationMessage,
  type NotificationProvider,
} from "../../src/notification/notification.types";
import { NotificationWorker } from "../../src/notification/notification.worker";

const connectionString = process.env.TEST_DATABASE_URL;
const integrationTest = connectionString ? test : test.skip;
const prisma = connectionString
  ? new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
  : null;

const suffix = crypto.randomUUID();
const userId = `notification-user-${suffix}`;
const roomId = `notification-room-${suffix}`;
const bookingId = `notification-booking-${suffix}`;
const lineUserId = `U${"a".repeat(32)}`;
let startTime = new Date(0);

class FakeProvider implements NotificationProvider {
  readonly deliveries: NotificationMessage[] = [];
  failNext = false;

  constructor(readonly channel: "EMAIL" | "LINE") {}

  async send(message: NotificationMessage) {
    if (this.failNext) {
      this.failNext = false;
      throw new NotificationDeliveryError("Temporary test provider failure", true);
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
    this.deliveries.push(message);
    return { providerMessageId: `${this.channel.toLowerCase()}-${this.deliveries.length}` };
  }
}

beforeAll(async () => {
  if (!prisma) return;
  startTime = new Date(Date.now() + 30 * 60_000);
  await prisma.user.create({
    data: {
      id: userId,
      name: "Notification Integration User",
      email: `${userId}@example.com`,
      role: "userRole",
      plan: "PRO",
      lineUserId,
      notificationPreference: { create: {} },
    },
  });
  await prisma.room.create({
    data: { id: roomId, name: "Notification Room", floor: "TEST", capacity: 10, isActive: true },
  });
  await prisma.booking.create({
    data: {
      id: bookingId,
      userId,
      roomId,
      startTime,
      endTime: new Date(startTime.getTime() + 60 * 60_000),
      attendees: 2,
      purpose: "Notification integration",
      status: "CONFIRMED",
    },
  });
});

afterAll(async () => {
  if (!prisma) return;
  await prisma.notificationJob.deleteMany({ where: { userId } });
  await prisma.lineLinkCode.deleteMany({ where: { userId } });
  await prisma.notificationPreference.deleteMany({ where: { userId } });
  await prisma.booking.deleteMany({ where: { id: bookingId } });
  await prisma.room.deleteMany({ where: { id: roomId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

integrationTest("outbox idempotency and SKIP LOCKED prevent duplicate delivery", async () => {
  if (!prisma) throw new Error("TEST_DATABASE_URL is required");
  const service = new NotificationService(prisma);
  await Promise.all([
    service.enqueueBooking("BOOKING_APPROVED", bookingId),
    service.enqueueBooking("BOOKING_APPROVED", bookingId),
  ]);
  expect(await prisma.notificationJob.count({
    where: { bookingId, type: "BOOKING_APPROVED" },
  })).toBe(2);

  const email = new FakeProvider("EMAIL");
  const line = new FakeProvider("LINE");
  const workers = [
    new NotificationWorker(prisma, [email, line], `worker-a-${suffix}`),
    new NotificationWorker(prisma, [email, line], `worker-b-${suffix}`),
  ];
  await Promise.all(workers.map((worker) => worker.runOnce(10)));

  expect(email.deliveries).toHaveLength(1);
  expect(line.deliveries).toHaveLength(1);
  expect(await prisma.notificationJob.count({
    where: { bookingId, type: "BOOKING_APPROVED", status: "SENT" },
  })).toBe(2);
});

integrationTest("retryable failures are persisted and retried without calling real providers", async () => {
  if (!prisma) throw new Error("TEST_DATABASE_URL is required");
  const service = new NotificationService(prisma);
  await service.enqueueTest(userId);
  const email = new FakeProvider("EMAIL");
  const line = new FakeProvider("LINE");
  email.failNext = true;
  const worker = new NotificationWorker(prisma, [email, line], `retry-worker-${suffix}`);
  await worker.runOnce(10);

  const retry = await prisma.notificationJob.findFirstOrThrow({
    where: { userId, type: "TEST", channel: "EMAIL" },
  });
  expect(retry.status).toBe("RETRY");
  expect(retry.attempts).toBe(1);
  expect(retry.lastError).toContain("Temporary test provider failure");

  await worker.runOnce(10, new Date(Date.now() + 2 * 60_000));
  const sent = await prisma.notificationJob.findUniqueOrThrow({ where: { id: retry.id } });
  expect(sent.status).toBe("SENT");
  expect(sent.attempts).toBe(2);
  expect(email.deliveries).toHaveLength(1);
});

integrationTest("concurrent reminder schedulers create one job per channel", async () => {
  if (!prisma) throw new Error("TEST_DATABASE_URL is required");
  await prisma.booking.update({
    where: { id: bookingId },
    data: { reminder30SentAt: null, startTime: new Date(Date.now() + 30 * 60_000) },
  });
  const schedulers = [new NotificationScheduler(prisma), new NotificationScheduler(prisma)];
  await Promise.all(schedulers.map((scheduler) => scheduler.enqueueDueReminders(new Date())));

  expect(await prisma.notificationJob.count({
    where: { bookingId, type: "REMINDER_30" },
  })).toBe(2);
  expect((await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } })).reminder30SentAt).not.toBeNull();
});

integrationTest("LINE link codes are expiring, single-use, and store only a LINE user ID", async () => {
  if (!prisma) throw new Error("TEST_DATABASE_URL is required");
  await prisma.user.update({ where: { id: userId }, data: { lineUserId: null } });
  const links = new LineLinkService(prisma, "integration-line-link-secret-32-bytes-long");
  const link = await links.createCode(userId);
  const newLineUserId = `U${"b".repeat(32)}`;
  await links.consumeCode(link.code, newLineUserId);
  expect((await links.getStatus(userId)).connected).toBe(true);
  await expect(links.consumeCode(link.code, newLineUserId)).rejects.toThrow(/Invalid or expired/);
  await links.disconnect(userId);
  expect((await links.getStatus(userId)).connected).toBe(false);
});
