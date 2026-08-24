import Elysia from "elysia";
import { betterAuth } from "../middleware/auth.middleware";
import { stripe, PRICE_ID } from "../lib/stripe";
import prisma from "../../libs/db";
import { StripeWebhookService } from "./stripe-webhook.service";

const WEB_URL = process.env.WEB_URL ?? "http://localhost:5173";
const stripeWebhooks = new StripeWebhookService(prisma);

export const subscriptionRoutes = new Elysia()
    .use(betterAuth)

    .guard({ auth: true }, (app) =>
        app
            .post("/subscription/checkout", async ({ user, status }) => {
                const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { stripeCustomerId: true } });
                let customerId = dbUser?.stripeCustomerId ?? undefined;
                if (!customerId) {
                    const customer = await stripe.customers.create({ email: user.email, name: user.name });
                    customerId = customer.id;
                    await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } });
                }
                const session = await stripe.checkout.sessions.create({
                    customer: customerId,
                    payment_method_types: ["card"],
                    line_items: [{ price: PRICE_ID, quantity: 1 }],
                    mode: "subscription",
                    success_url: `${WEB_URL}/settings?plan=success`,
                    cancel_url: `${WEB_URL}/settings`,
                });
                if (!session.url) throw new Error("Stripe did not return a checkout URL");
                return { url: session.url };
            })
            .post("/subscription/portal", async ({ user, status }) => {
                const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { stripeCustomerId: true } });
                const customerId = dbUser?.stripeCustomerId ?? undefined;
                if (!customerId) return status(400, { error: "No Stripe customer found" });
                const session = await stripe.billingPortal.sessions.create({
                    customer: customerId,
                    return_url: `${WEB_URL}/settings`,
                });
                return { url: session.url };
            })
    )

    // Webhook — must use raw body for signature verification
    .post("/subscription/webhook", async ({ request, status }) => {
        const sig = request.headers.get("stripe-signature");
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!sig || !webhookSecret) return status(400, { error: "Missing signature" });

        const rawBody = await request.text();
        let event: Awaited<ReturnType<typeof stripe.webhooks.constructEventAsync>>;
        try {
            event = await stripe.webhooks.constructEventAsync(rawBody, sig, webhookSecret);
        } catch (e: any) {
            return status(400, { error: `Webhook Error: ${e.message}` });
        }

        const result = await stripeWebhooks.process(event);
        return { received: true, duplicate: result.duplicate };
    }, { auth: false })
