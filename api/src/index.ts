import { startBackgroundJobs } from "./jobs";
import { startNotificationWorker } from "./notification/notification.worker";
import prisma from "../libs/db";
import { createApp, type App } from "./app";

const app = await createApp();
app.listen(3000);

const backgroundJobs = startBackgroundJobs(prisma);
const notificationWorker = startNotificationWorker(prisma);

let shutdownPromise: Promise<void> | undefined;
function shutdown(signal: "SIGINT" | "SIGTERM") {
  shutdownPromise ??= (async () => {
    console.log(`[shutdown] ${signal} received; draining workers and closing the API`);
    app.stop();
    await Promise.all([backgroundJobs.stop(), notificationWorker.stop()]);
    await prisma.$disconnect();
    console.log("[shutdown] RoomFlow API stopped cleanly");
  })().catch((error) => {
    console.error("[shutdown] Graceful shutdown failed", error);
    process.exitCode = 1;
  });
  return shutdownPromise;
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));

export type { App };

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
