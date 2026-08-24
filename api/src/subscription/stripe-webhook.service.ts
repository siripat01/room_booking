import Stripe from "stripe";
import { Prisma, type PrismaClient } from "../../generated/prisma/client";
import { RecurringEntitlementService } from "./recurring-entitlement.service";

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
  private readonly recurringEntitlements: RecurringEntitlementService;

  constructor(private readonly prisma: PrismaClient) {
    this.recurringEntitlements = new RecurringEntitlementService(prisma);
  }

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
            if (active && subscription.cancel_at_period_end && !expiresAt) {
              throw new Error("Stripe subscription cancellation is missing current_period_end");
            }
            await tx.user.updateMany({
              where: { stripeCustomerId: customerId },
              data: {
                plan: active ? "PRO" : "FREE",
                planExpiresAt: active && !subscription.cancel_at_period_end ? null : expiresAt,
              },
            });
            if (!active) {
              await this.recurringEntitlements.cancelForStripeCustomer(
                tx,
                customerId,
                new Date(event.created * 1000),
                "stripe-subscription-inactive",
              );
            }
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
            await this.recurringEntitlements.cancelForStripeCustomer(
              tx,
              customerId,
              new Date(event.created * 1000),
              "stripe-subscription-deleted",
            );
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
