import { expect, test } from "bun:test";
import { sanitizeAuditMetadata } from "../../../src/audit/audit.service";

test("audit metadata removes credentials recursively while retaining safe context", () => {
  const metadata = sanitizeAuditMetadata({
    source: "device-rotation",
    credentialRotated: true,
    deviceKey: "plaintext-device-key",
    nested: {
      authorization: "Bearer secret",
      qr_token_hash: "hashed-qr-token",
      roomId: "room-123",
    },
  });

  expect(metadata).toEqual({
    source: "device-rotation",
    credentialRotated: true,
    nested: { roomId: "room-123" },
  });
});

test("audit metadata bounds untrusted string and collection sizes", () => {
  const metadata = sanitizeAuditMetadata({
    note: "x".repeat(1_000),
    values: Array.from({ length: 100 }, (_, index) => index),
  });

  expect(metadata?.note).toBe("x".repeat(500));
  expect(metadata?.values).toHaveLength(50);
});
