import { createHmac } from "crypto";
import { describe, expect, test } from "bun:test";
import { verifyLineWebhookSignature } from "./line-webhook-signature";

describe("LINE webhook signature", () => {
  const secret = "line-channel-secret";
  const body = JSON.stringify({ events: [] });

  test("accepts a valid HMAC-SHA256 signature", () => {
    const signature = createHmac("sha256", secret).update(body).digest("base64");
    expect(verifyLineWebhookSignature(body, signature, secret)).toBe(true);
  });

  test("rejects modified payloads and missing configuration", () => {
    const signature = createHmac("sha256", secret).update(body).digest("base64");
    expect(verifyLineWebhookSignature(`${body} `, signature, secret)).toBe(false);
    expect(verifyLineWebhookSignature(body, "", secret)).toBe(false);
    expect(verifyLineWebhookSignature(body, signature, "")).toBe(false);
  });
});
