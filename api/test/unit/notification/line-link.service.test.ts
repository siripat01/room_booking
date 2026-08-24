import { describe, expect, test } from "bun:test";
import { hashLineLinkCode } from "../../../src/notification/line-link.service";

describe("LINE link code hashing", () => {
  test("normalizes the code and separates it from plaintext storage", () => {
    const secret = "test-secret-that-is-at-least-32-bytes-long";
    const first = hashLineLinkCode("abcd2345", secret);
    const second = hashLineLinkCode(" ABCD2345 ", secret);
    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(first).not.toContain("ABCD2345");
  });
});
