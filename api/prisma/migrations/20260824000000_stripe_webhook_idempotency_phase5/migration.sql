-- Stripe retries webhook deliveries and may deliver the same event concurrently.
-- Recording the provider event ID in the same transaction as the user-plan
-- mutation makes database side effects idempotent without expanding billing.

CREATE TABLE "stripe_webhook_events" (
  "event_id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "processed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stripe_webhook_events_pkey" PRIMARY KEY ("event_id"),
  CONSTRAINT "stripe_webhook_events_event_id_present" CHECK (length("event_id") > 0),
  CONSTRAINT "stripe_webhook_events_type_present" CHECK (length("type") > 0)
);

CREATE INDEX "stripe_webhook_events_created_at_idx"
  ON "stripe_webhook_events"("created_at");
