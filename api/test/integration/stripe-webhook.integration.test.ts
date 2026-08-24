import { afterAll, beforeAll, expect, test } from "bun:test";
import { PrismaPg } from "@prisma/adapter-pg";
import type Stripe from "stripe";
import { PrismaClient } from "../../generated/prisma/client";
import { StripeWebhookService } from "../../src/subscription/stripe-webhook.service";

const connectionString = process.env.TEST_DATABASE_URL;
const integrationTest = connectionString ? test : test.skip;
const prisma = connectionString
  ? new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
  : null;

const suffix = crypto.randomUUID();
const userId = `stripe-user-${suffix}`;
const customerId = `cus_${suffix.replaceAll("-", "")}`;
const roomId = `stripe-room-${suffix}`;
const trackedEventIds: string[] = [];

function stripeEvent(id: string, type: Stripe.Event.Type, object: object): Stripe.Event {
  trackedEventIds.push(id);
  return {
    id,
    object: "event",
    api_version: "2026-06-30.basil",
    created: Math.floor(Date.now() / 1000),
    data: { object } as Stripe.Event.Data,
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type,
  } as Stripe.Event;
}

beforeAll(async () => {
  if (!prisma) return;
  await prisma.user.create({
    data: {
      id: userId,
      name: "Stripe Webhook User",
      email: `${userId}@example.com`,
      role: "userRole",
      plan: "FREE",
      stripeCustomerId: customerId,
    },
  });
  await prisma.room.create({
    data: {
      id: roomId,
      name: "Stripe Entitlement Room",
      floor: "TEST",
      capacity: 4,
    },
  });
});

afterAll(async () => {
  if (!prisma) return;
  await prisma.stripeWebhookEvent.deleteMany({ where: { id: { in: trackedEventIds } } });
  await prisma.auditLog.deleteMany({ where: { roomId } });
  await prisma.booking.deleteMany({ where: { roomId } });
  await prisma.bookingSeries.deleteMany({ where: { roomId } });
  await prisma.room.deleteMany({ where: { id: roomId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

integrationTest("concurrent duplicate Stripe events mutate the plan once", async () => {
  if (!prisma) throw new Error("TEST_DATABASE_URL is required");
  const service = new StripeWebhookService(prisma);
  const event = stripeEvent(`evt_checkout_${suffix}`, "checkout.session.completed", {
    id: `cs_${suffix}`,
    object: "checkout.session",
    mode: "subscription",
    customer: customerId,
  });

  const results = await Promise.all([service.process(event), service.process(event)]);

  expect(results.filter(({ duplicate }) => !duplicate)).toHaveLength(1);
  expect(results.filter(({ duplicate }) => duplicate)).toHaveLength(1);
  expect(await prisma.stripeWebhookEvent.count({ where: { id: event.id } })).toBe(1);
  expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).plan).toBe("PRO");
});

integrationTest("subscription cancellation and deletion are idempotent", async () => {
  if (!prisma) throw new Error("TEST_DATABASE_URL is required");
  const service = new StripeWebhookService(prisma);
  const periodEnd = Math.floor(Date.now() / 1000) + 3_600;
  const updated = stripeEvent(`evt_updated_${suffix}`, "customer.subscription.updated", {
    id: `sub_${suffix}`,
    object: "subscription",
    customer: customerId,
    status: "active",
    cancel_at_period_end: true,
    current_period_end: periodEnd,
  });
  await service.process(updated);
  await service.process(updated);
  const cancellingUser = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  expect(cancellingUser.plan).toBe("PRO");
  expect(cancellingUser.planExpiresAt?.getTime()).toBe(periodEnd * 1000);

  const series = await prisma.bookingSeries.create({
    data: {
      userId,
      roomId,
      startDate: new Date("2099-01-05T00:00:00.000Z"),
      endDate: new Date("2099-01-12T00:00:00.000Z"),
      weekdays: ["MONDAY"],
      startTime: "10:00",
      endTime: "11:00",
      attendees: 2,
      bookings: {
        create: {
          userId,
          roomId,
          occurrenceDate: new Date("2099-01-05T00:00:00.000Z"),
          startTime: new Date("2099-01-05T03:00:00.000Z"),
          endTime: new Date("2099-01-05T04:00:00.000Z"),
          attendees: 2,
          status: "CONFIRMED",
        },
      },
    },
  });
  expect(series.status).toBe("ACTIVE");
  expect((await prisma.bookingSeries.findUniqueOrThrow({ where: { id: series.id } })).status).toBe(
    "ACTIVE",
  );

  const deleted = stripeEvent(`evt_deleted_${suffix}`, "customer.subscription.deleted", {
    id: `sub_${suffix}`,
    object: "subscription",
    customer: customerId,
  });
  await service.process(deleted);
  await service.process(deleted);
  const freeUser = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  expect(freeUser.plan).toBe("FREE");
  expect(freeUser.planExpiresAt).toBeNull();
  expect((await prisma.bookingSeries.findUniqueOrThrow({ where: { id: series.id } })).status).toBe(
    "CANCELLED",
  );
  expect(
    (await prisma.booking.findFirstOrThrow({ where: { seriesId: series.id } })).status,
  ).toBe("CANCELLED");
  expect(
    await prisma.stripeWebhookEvent.count({ where: { id: { in: [updated.id, deleted.id] } } }),
  ).toBe(2);
});

integrationTest("scheduled cancellation without a period end is rejected atomically", async () => {
  if (!prisma) throw new Error("TEST_DATABASE_URL is required");
  const service = new StripeWebhookService(prisma);
  const event = stripeEvent(`evt_invalid_period_${suffix}`, "customer.subscription.updated", {
    id: `sub_${suffix}`,
    object: "subscription",
    customer: customerId,
    status: "active",
    cancel_at_period_end: true,
  });

  await expect(service.process(event)).rejects.toThrow("missing current_period_end");
  expect(await prisma.stripeWebhookEvent.findUnique({ where: { id: event.id } })).toBeNull();
});
