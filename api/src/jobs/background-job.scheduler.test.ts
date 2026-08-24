import { expect, test } from "bun:test";
import { BackgroundJobScheduler } from "./background-job.scheduler";

test("retention cleanup uses one hourly key when the scheduler interval is sub-minute", async () => {
  const previous = process.env.BACKGROUND_JOB_SCHEDULE_INTERVAL_MS;
  process.env.BACKGROUND_JOB_SCHEDULE_INTERVAL_MS = "10000";
  const batches: Array<Array<{ type: string; jobKey: string }>> = [];
  const prisma = {
    backgroundJob: {
      createMany: async ({ data }: { data: Array<{ type: string; jobKey: string }> }) => {
        batches.push(data);
        return { count: data.length };
      },
    },
  };

  try {
    const scheduler = new BackgroundJobScheduler(prisma as never);
    await scheduler.enqueueDueJobs(new Date("2099-01-02T03:00:25.000Z"));
    await scheduler.enqueueDueJobs(new Date("2099-01-02T03:00:35.000Z"));
  } finally {
    if (previous === undefined) delete process.env.BACKGROUND_JOB_SCHEDULE_INTERVAL_MS;
    else process.env.BACKGROUND_JOB_SCHEDULE_INTERVAL_MS = previous;
  }

  const cleanupKeys = batches
    .flat()
    .filter(({ type }) => type === "PURGE_JOB_HISTORY")
    .map(({ jobKey }) => jobKey);
  expect(cleanupKeys).toEqual([
    "roomflow:PURGE_JOB_HISTORY:2099-01-02T03:00:00.000Z",
    "roomflow:PURGE_JOB_HISTORY:2099-01-02T03:00:00.000Z",
  ]);
});
