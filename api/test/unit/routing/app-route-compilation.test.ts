import { expect, test } from "bun:test";

test("the complete API route graph compiles without parameter conflicts", async () => {
  process.env.DATABASE_URL ??= "postgresql://route_test:route_test@127.0.0.1:5432/route_test";
  process.env.BETTER_AUTH_SECRET ??= "route-compilation-test-secret-at-least-32-characters";
  process.env.NOTIFICATIONS_DISABLED = "true";
  process.env.NODE_ENV = "test";

  const { createApp } = await import("../../../src/app");
  const app = await createApp();

  expect(() => app.compile()).not.toThrow();
  expect(app.routes.some(({ path }) => path === "/api/devices/:id/events")).toBe(true);
}, 15_000);
