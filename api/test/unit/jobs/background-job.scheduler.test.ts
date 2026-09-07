import { expect, test } from "bun:test";
import { BackgroundJobScheduler } from "../../../src/jobs/background-job.scheduler";

function fakePrisma(due: Partial<Record<string, boolean>> = {}) {
  const batches: Array<Array<{ type: string; jobKey: string }>> = [];
  const first = (name: string) => async () => due[name] ? { id: name } : null;
  return {
    batches,
    prisma: {
      backgroundJob: {
        createMany: async ({ data }: { data: Array<{ type: string; jobKey: string }> }) => {
          batches.push(data);
          return { count: data.length };
        },
      },
      booking: { findFirst: first("booking") },
      user: { findFirst: first("user") },
      waitlistEntry: { findFirst: first("waitlist") },
    },
  };
}

test("does not persist no-op jobs when no booking work is due", async () => {
  const { prisma, batches } = fakePrisma();
  const scheduler = new BackgroundJobScheduler(prisma as never);

  const result = await scheduler.enqueueDueJobs(new Date("2099-01-02T03:00:25.000Z"));

  expect(result).toMatchObject({ requested: 0, created: 0 });
  expect(batches).toEqual([]);
});

test("persists only durable job types with due work", async () => {
  const { prisma, batches } = fakePrisma({ booking: true, user: true, waitlist: true });
  const scheduler = new BackgroundJobScheduler(prisma as never);

  await scheduler.enqueueDueJobs(new Date("2099-01-02T03:07:10.000Z"));

  expect(batches).toHaveLength(1);
  expect(batches[0].map(({ type }) => type)).toEqual([
    "EXPIRE_BOOKINGS",
    "EXPIRE_PRO_ACCESS",
    "AUTO_CHECKOUT",
    "ENQUEUE_REMINDERS",
    "PROMOTE_WAITLIST",
  ]);
});

test("retention cleanup is scheduled once daily", async () => {
  const { prisma, batches } = fakePrisma();
  const scheduler = new BackgroundJobScheduler(prisma as never);

  await scheduler.enqueueDueJobs(new Date("2099-01-02T00:00:25.000Z"));
  await scheduler.enqueueDueJobs(new Date("2099-01-02T01:00:25.000Z"));

  expect(batches).toHaveLength(1);
  expect(batches[0]).toEqual([
    expect.objectContaining({ type: "PURGE_JOB_HISTORY", jobKey: "roomflow:PURGE_JOB_HISTORY:2099-01-02T00:00:00.000Z" }),
  ]);
});
