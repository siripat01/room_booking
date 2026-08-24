import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { openapi } from "@elysia/openapi";
import { OpenAPI } from "../libs/auth";
import { betterAuth } from "./middleware/auth.middleware";
import authRoutes from "./auth/auth.route";
import roomRoutes from "./room/room.route";
import bookingRoutes from "./booking/booking.route";
import { bookingSeriesRoutes } from "./booking/booking-series.route";
import userRoutes from "./user/user.route";
import { deviceRoutes } from "./device/device.route";
import reportRoutes from "./report/report.route";
import { subscriptionRoutes } from "./subscription/subscription.route";
import { startBackgroundJobs } from "./jobs";
import { jobHealthRoutes } from "./jobs/job-health.route";
import { JobHealthService } from "./jobs/job-health.service";
import { lineRoutes } from "./notification/line.route";
import { realtimeRoutes } from "./realtime/realtime.route";
import { startNotificationWorker } from "./notification/notification.worker";
import prisma from "../libs/db";

const app = new Elysia({ prefix: "/api" })
  .use(
    cors({
      origin: process.env.NODE_ENV === "production"
        ? (process.env.FRONTEND_URL || "http://localhost:3001")
        : true,
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization", "X-Device-Key", "X-Request-ID"],
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    }),
  )
  .use(
    openapi({
      documentation: {
        components: await OpenAPI.components,
        paths: await OpenAPI.getPaths(),
      },
    }),
  )
  .use(betterAuth)
  .use(roomRoutes)
  .use(bookingRoutes)
  .use(bookingSeriesRoutes)
  .use(userRoutes)
  .use(deviceRoutes)
  .use(reportRoutes)
  .use(subscriptionRoutes)
  .use(lineRoutes)
  .use(jobHealthRoutes)
  .use(realtimeRoutes)
  .use(authRoutes)
  .get("/health", async ({ status }) => {
    const health = await new JobHealthService(prisma).readiness();
    return status(health.status === "healthy" ? 200 : 503, {
      ...health,
      service: "roomflow-api",
      version: process.env.APP_VERSION ?? "development",
      timestamp: new Date().toISOString(),
    });
  })
  .all("/version", () => process.env.APP_VERSION)
  .listen(3000);

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

export type App = typeof app;

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
