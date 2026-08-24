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
});

afterAll(async () => {
  if (!prisma) return;
  await prisma.stripeWebhookEvent.deleteMany({ where: { id: { in: trackedEventIds } } });
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
  expect(
    await prisma.stripeWebhookEvent.count({ where: { id: { in: [updated.id, deleted.id] } } }),
  ).toBe(2);
});
