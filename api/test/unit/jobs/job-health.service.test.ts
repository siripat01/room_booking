import { expect, test } from "bun:test";
import { JobHealthService } from "../../../src/jobs/job-health.service";

function fakePrisma(overrides?: { backgroundFailed?: number; notificationDueAt?: Date }) {
  const backgroundFailed = overrides?.backgroundFailed ?? 0;
  return {
    backgroundJob: {
      groupBy: async () =>
        backgroundFailed > 0 ? [{ status: "FAILED", _count: { _all: backgroundFailed } }] : [],
      findFirst: async () => null,
      count: async () => 0,
    },
    notificationJob: {
      groupBy: async () => [],
      findFirst: async () =>
        overrides?.notificationDueAt ? { availableAt: overrides.notificationDueAt } : null,
      count: async () => 0,
    },
  };
}

test("job health is healthy when queues have no failures, delay, or stale locks", async () => {
  const snapshot = await new JobHealthService(fakePrisma() as never).getSnapshot(
    new Date("2099-01-01T00:10:00.000Z"),
  );
  expect(snapshot.status).toBe("healthy");
  expect(snapshot.reasons).toEqual([]);
});

test("job health reports durable failures and delayed notification work", async () => {
  const snapshot = await new JobHealthService(
    fakePrisma({
      backgroundFailed: 1,
      notificationDueAt: new Date("2099-01-01T00:00:00.000Z"),
    }) as never,
  ).getSnapshot(new Date("2099-01-01T00:10:00.000Z"));
  expect(snapshot.status).toBe("degraded");
  expect(snapshot.reasons).toContain("background-failures");
  expect(snapshot.reasons).toContain("notification-queue-delayed");
});
