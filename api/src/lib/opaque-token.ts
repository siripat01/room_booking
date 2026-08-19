import { createHash, createHmac, randomBytes, randomInt } from "crypto";

export function generateOpaqueToken(prefix: string, byteLength = 32): string {
  return `${prefix}${randomBytes(byteLength).toString("base64url")}`;
}

export function hashOpaqueToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function generatePairingCode(): string {
  return randomInt(100_000, 1_000_000).toString();
}

export function hashPairingCode(code: string, secret: string): string {
  if (secret.length < 16) {
    throw new Error("BETTER_AUTH_SECRET must be at least 16 characters for pairing-code hashing");
  }
  return createHmac("sha256", secret)
    .update(`roomflow:device-pairing:${code}`, "utf8")
    .digest("hex");
}
