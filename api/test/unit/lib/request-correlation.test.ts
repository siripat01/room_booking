import { describe, expect, test } from "bun:test";
import { requestCorrelationId } from "../../../src/lib/request-correlation";

describe("requestCorrelationId", () => {
  test("accepts a bounded safe request identifier", () => {
    const request = new Request("http://roomflow.test", {
      headers: { "x-request-id": "fly:request_123.test" },
    });
    expect(requestCorrelationId(request)).toBe("fly:request_123.test");
  });

  test("replaces unsafe or oversized identifiers", () => {
    const request = new Request("http://roomflow.test", {
      headers: { "x-request-id": `unsafe-${"x".repeat(200)}` },
    });
    expect(requestCorrelationId(request)).toMatch(/^[0-9a-f-]{36}$/);
  });
});
