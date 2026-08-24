import type { PrismaClient } from "../../generated/prisma/client";
import { startPollingLoop } from "../lib/polling-loop";
import { BackgroundJobScheduler, scheduleIntervalMs } from "./background-job.scheduler";
import { BackgroundJobWorker } from "./background-job.worker";

export function startBackgroundJobs(prisma: PrismaClient) {
  const scheduler = new BackgroundJobScheduler(prisma);
  const worker = new BackgroundJobWorker(prisma);
  const intervalMs = scheduleIntervalMs();
  return startPollingLoop(async () => {
    await scheduler.enqueueDueJobs();
    let claimed: number;
    do {
      claimed = await worker.runOnce();
    } while (claimed > 0);
  }, intervalMs, (error) => {
    console.error("[background-jobs] Run failed", error);
  });
}
