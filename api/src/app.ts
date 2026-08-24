import { cors } from "@elysiajs/cors";
import { openapi } from "@elysia/openapi";
import { Elysia } from "elysia";
import { OpenAPI } from "../libs/auth";
import prisma from "../libs/db";
import authRoutes from "./auth/auth.route";
import { bookingSeriesRoutes } from "./booking/booking-series.route";
import bookingRoutes from "./booking/booking.route";
import { deviceRoutes } from "./device/device.route";
import { JobHealthService } from "./jobs/job-health.service";
import { jobHealthRoutes } from "./jobs/job-health.route";
import { betterAuth } from "./middleware/auth.middleware";
import { lineRoutes } from "./notification/line.route";
import { realtimeRoutes } from "./realtime/realtime.route";
import reportRoutes from "./report/report.route";
import roomRoutes from "./room/room.route";
import { subscriptionRoutes } from "./subscription/subscription.route";
import userRoutes from "./user/user.route";

export async function createApp() {
  return new Elysia({ prefix: "/api" })
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
    .all("/version", () => process.env.APP_VERSION);
}

export type App = Awaited<ReturnType<typeof createApp>>;
