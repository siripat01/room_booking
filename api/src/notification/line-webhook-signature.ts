import { createHmac, timingSafeEqual } from "crypto";

export function verifyLineWebhookSignature(rawBody: string, signature: string, secret: string) {
  if (!signature || !secret) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(rawBody).digest("base64"));
  const provided = Buffer.from(signature);
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}
