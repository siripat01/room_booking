import Stripe from "stripe";
import { Prisma, type PrismaClient } from "../../generated/prisma/client";

type StripeSubscription = Stripe.Subscription & { current_period_end?: number };

function stripeCustomerId(value: string | Stripe.Customer | Stripe.DeletedCustomer | null) {
  if (typeof value === "string") return value;
  return value?.id;
}

function periodEnd(subscription: StripeSubscription) {
  return typeof subscription.current_period_end === "number"
    ? new Date(subscription.current_period_end * 1000)
    : null;
}

function isDuplicateEvent(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export class StripeWebhookService {
  constructor(private readonly prisma: PrismaClient) {}

  async process(event: Stripe.Event) {
    try {
      const handled = await this.prisma.$transaction(async (tx) => {
        await tx.stripeWebhookEvent.create({
          data: { id: event.id, type: event.type },
        });

        switch (event.type) {
          case "checkout.session.completed": {
            const session = event.data.object as Stripe.Checkout.Session;
            const customerId = stripeCustomerId(session.customer);
            if (session.mode !== "subscription" || !customerId) return false;
            await tx.user.updateMany({
              where: { stripeCustomerId: customerId },
              data: { plan: "PRO", planExpiresAt: null },
            });
            return true;
          }
          case "customer.subscription.updated": {
            const subscription = event.data.object as StripeSubscription;
            const customerId = stripeCustomerId(subscription.customer);
            if (!customerId) return false;
            const active = subscription.status === "active" || subscription.status === "trialing";
            const expiresAt = periodEnd(subscription);
            await tx.user.updateMany({
              where: { stripeCustomerId: customerId },
              data: {
                plan: active ? "PRO" : "FREE",
                planExpiresAt: active && !subscription.cancel_at_period_end ? null : expiresAt,
              },
            });
            return true;
          }
          case "customer.subscription.deleted": {
            const subscription = event.data.object as Stripe.Subscription;
            const customerId = stripeCustomerId(subscription.customer);
            if (!customerId) return false;
            await tx.user.updateMany({
              where: { stripeCustomerId: customerId },
              data: { plan: "FREE", planExpiresAt: null },
            });
            return true;
          }
          default:
            return false;
        }
      });
      return { duplicate: false, handled };
    } catch (error) {
      if (isDuplicateEvent(error)) return { duplicate: true, handled: false };
      throw error;
    }
  }
}
