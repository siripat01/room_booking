import { describe, expect, test } from "bun:test";
import { LineMessagingProvider } from "./line-messaging.provider";

const message = {
  recipient: `U${"a".repeat(32)}`,
  subject: "Test",
  html: "<p>Test</p>",
  text: "Test",
  idempotencyKey: "test-idempotency",
  retryKey: "123e4567-e89b-12d3-a456-426614174000",
};

describe("LineMessagingProvider", () => {
  test("treats a retry-key 409 as an already accepted delivery", async () => {
    const provider = new LineMessagingProvider("test-token", async () => new Response(
      JSON.stringify({ message: "The retry key is already accepted" }),
      { status: 409, headers: { "x-line-accepted-request-id": "accepted-request-id" } },
    ), false);
    await expect(provider.send(message)).resolves.toEqual({ providerMessageId: "accepted-request-id" });
  });

  test("marks server failures as retryable", async () => {
    const provider = new LineMessagingProvider("test-token", async () => new Response("{}", { status: 503 }), false);
    await expect(provider.send(message)).rejects.toMatchObject({ retryable: true });
  });
});
