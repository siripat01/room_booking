import type { PrismaClient } from "../../generated/prisma/client";
import { startPollingLoop } from "../lib/polling-loop";
import { BackgroundJobScheduler, scheduleIntervalMs } from "./background-job.scheduler";
import { BackgroundJobWorker } from "./background-job.worker";
import { JobHealthService } from "./job-health.service";

function healthLogIntervalMs() {
  const configured = Number(process.env.JOB_HEALTH_LOG_INTERVAL_MS ?? 5 * 60_000);
  return Number.isInteger(configured) && configured >= 60_000 && configured <= 60 * 60_000
    ? configured
    : 5 * 60_000;
}

export function startBackgroundJobs(prisma: PrismaClient) {
  const scheduler = new BackgroundJobScheduler(prisma);
  const worker = new BackgroundJobWorker(prisma);
  const health = new JobHealthService(prisma);
  const intervalMs = scheduleIntervalMs();
  let nextHealthLogAt = 0;
  return startPollingLoop(async () => {
    await scheduler.enqueueDueJobs();
    let claimed: number;
    do {
      claimed = await worker.runOnce();
    } while (claimed > 0);
    const now = Date.now();
    if (now >= nextHealthLogAt) {
      const snapshot = await health.getSnapshot(new Date(now));
      if (snapshot.status === "degraded") {
        console.warn("[job-health] Queue health degraded", snapshot);
      }
      nextHealthLogAt = now + healthLogIntervalMs();
    }
  }, intervalMs, (error) => {
    console.error("[background-jobs] Run failed", error);
  });
}
