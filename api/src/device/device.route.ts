import Elysia, { t } from "elysia";
import prisma from "../../libs/db";
import { CheckInPolicyError } from "../check-in/check-in.errors";
import { DatabaseRateLimiter } from "../lib/database-rate-limiter";
import { betterAuth } from "../middleware/auth.middleware";
import { DeviceService } from "./device.service";
import { requestCorrelationId } from "../lib/request-correlation";

const deviceService = new DeviceService(prisma);
const rateLimiter = new DatabaseRateLimiter(prisma);

function clientIp(request: Request): string {
  return request.headers.get("fly-client-ip")
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? "unknown";
}

async function isRateLimited(
  scope: string,
  subject: string,
  limit: number,
  windowSeconds: number,
) {
  const result = await rateLimiter.consume(scope, subject, limit, windowSeconds);
  return result.allowed ? null : result;
}

export const deviceRoutes = new Elysia()
  .use(betterAuth)
  .guard({ auth: true }, (app) =>
    app
      .onBeforeHandle(({ user, status }) => {
        if (user.role !== "adminRole") return status(403);
      })
      .get("/devices", () => deviceService.getAllDevices())
      .get("/devices/:id", ({ params: { id } }) => deviceService.getDeviceById(id))
      .post("/devices", ({ body, user, request }) => deviceService.createDevice(body, {
        type: "ADMIN", id: user.id, correlationId: requestCorrelationId(request),
      }), {
        body: t.Object({
          name: t.String({ minLength: 1, maxLength: 120 }),
          roomId: t.Optional(t.Nullable(t.String())),
          isActive: t.Optional(t.Boolean()),
        }),
      })
      .put("/devices/:id", ({ params: { id }, body, user, request }) => deviceService.updateDevice(id, body, {
        type: "ADMIN", id: user.id, correlationId: requestCorrelationId(request),
      }), {
        body: t.Object({
          name: t.Optional(t.String({ minLength: 1, maxLength: 120 })),
          roomId: t.Optional(t.Nullable(t.String())),
        }),
      })
      .post("/devices/:id/rotate-key", ({ params: { id }, user, request }) => deviceService.rotateDeviceKey(id, {
        type: "ADMIN", id: user.id, correlationId: requestCorrelationId(request),
      }))
      .post("/devices/:id/revoke", ({ params: { id }, user, request }) => deviceService.revokeDevice(id, {
        type: "ADMIN", id: user.id, correlationId: requestCorrelationId(request),
      }))
      .post("/devices/:id/reactivate", ({ params: { id }, user, request }) => deviceService.reactivateDevice(id, {
        type: "ADMIN", id: user.id, correlationId: requestCorrelationId(request),
      }))
      .delete("/devices/:id", ({ params: { id }, user, request }) => deviceService.deleteDevice(id, {
        type: "ADMIN", id: user.id, correlationId: requestCorrelationId(request),
      }))
      .post("/devices/:id/generate-pairing", ({ params: { id }, user, request }) =>
        deviceService.generatePairingCode(id, {
          type: "ADMIN", id: user.id, correlationId: requestCorrelationId(request),
        })),
  )
  .post("/devices/pair", async ({ body, status, request, set }) => {
    const ipLimit = await isRateLimited("device-pair-ip", clientIp(request), 10, 300);
    const globalLimit = await isRateLimited("device-pair-global", "all", 500, 300);
    const limited = ipLimit ?? globalLimit;
    if (limited) {
      set.headers["retry-after"] = limited.retryAfterSeconds.toString();
      return status(429, { error: "Too many pairing attempts. Please try again later." });
    }
    try {
      return await deviceService.pairDevice(body.code, requestCorrelationId(request));
    } catch (error) {
      return status(400, { error: error instanceof Error ? error.message : "Pairing failed" });
    }
  }, {
    auth: false,
    body: t.Object({ code: t.String({ pattern: "^[0-9]{6}$" }) }),
  })
  .get("/devices/:id/status", async ({ params: { id }, headers, status }) => {
    const deviceKey = headers["x-device-key"];
    if (!deviceKey) return status(401);
    const device = await deviceService.authenticateDevice(id, deviceKey);
    if (!device) return status(403);
    return deviceService.getDeviceStatus(id);
  }, { auth: false })
  .get("/devices/:id/schedule", async ({ params: { id }, headers, status }) => {
    const deviceKey = headers["x-device-key"];
    if (!deviceKey) return status(401);
    const device = await deviceService.authenticateDevice(id, deviceKey);
    if (!device) return status(403);
    return deviceService.getDeviceSchedule(id);
  }, { auth: false })
  .post("/devices/:id/scan", async ({ params: { id }, headers, body, status, request, set }) => {
    const ipLimit = await isRateLimited("device-scan-ip", clientIp(request), 60, 60);
    if (ipLimit) {
      set.headers["retry-after"] = ipLimit.retryAfterSeconds.toString();
      return status(429, { message: "Too many scan attempts" });
    }
    const deviceKey = headers["x-device-key"];
    if (!deviceKey) return status(401);
    const device = await deviceService.authenticateDevice(id, deviceKey);
    if (!device) return status(403);
    const deviceLimit = await isRateLimited("device-scan", device.id, 30, 60);
    if (deviceLimit) {
      set.headers["retry-after"] = deviceLimit.retryAfterSeconds.toString();
      return status(429, { message: "Too many scan attempts" });
    }
    try {
      return await deviceService.scanQr(device, body.qrToken, requestCorrelationId(request));
    } catch (error) {
      return status(400, {
        message: error instanceof Error ? error.message : "Check-in failed",
        code: error instanceof CheckInPolicyError ? error.code : "CHECK_IN_FAILED",
      });
    }
  }, {
    auth: false,
    body: t.Object({ qrToken: t.String({ minLength: 16, maxLength: 128 }) }),
  })
  .post("/devices/:id/walkin", async ({ params: { id }, headers, body, status, request, set }) => {
    const ipLimit = await isRateLimited("device-walkin-ip", clientIp(request), 10, 300);
    if (ipLimit) {
      set.headers["retry-after"] = ipLimit.retryAfterSeconds.toString();
      return status(429, { error: "Too many walk-in requests" });
    }
    const deviceKey = headers["x-device-key"];
    if (!deviceKey) return status(401);
    const device = await deviceService.authenticateDevice(id, deviceKey);
    if (!device?.roomId) return status(403, { error: "Device is not linked to a room" });
    const deviceLimit = await isRateLimited("device-walkin", device.id, 5, 300);
    if (deviceLimit) {
      set.headers["retry-after"] = deviceLimit.retryAfterSeconds.toString();
      return status(429, { error: "Too many walk-in requests" });
    }
    try {
      const booking = await deviceService.createWalkIn(
        { ...device, roomId: device.roomId },
        { ...body, correlationId: requestCorrelationId(request) },
      );
      return { booking, status: booking.status };
    } catch (error) {
      return status(400, { error: error instanceof Error ? error.message : "Walk-in booking failed" });
    }
  }, {
    auth: false,
    body: t.Object({
      durationMinutes: t.Number({ minimum: 15, maximum: 240 }),
      attendees: t.Number({ minimum: 1, maximum: 500 }),
      purpose: t.Optional(t.String({ maxLength: 300 })),
      requesterName: t.String({ minLength: 1, maxLength: 120 }),
      requesterReference: t.Optional(t.String({ maxLength: 120 })),
    }),
  })
  .patch("/devices/:id/heartbeat", async ({ params: { id }, headers, status, request, set }) => {
    const ipLimit = await isRateLimited("device-heartbeat-ip", clientIp(request), 60, 300);
    if (ipLimit) {
      set.headers["retry-after"] = ipLimit.retryAfterSeconds.toString();
      return status(429);
    }
    const deviceKey = headers["x-device-key"];
    if (!deviceKey) return status(401);
    const device = await deviceService.authenticateDevice(id, deviceKey);
    if (!device) return status(403);
    const deviceLimit = await isRateLimited("device-heartbeat", device.id, 20, 300);
    if (deviceLimit) {
      set.headers["retry-after"] = deviceLimit.retryAfterSeconds.toString();
      return status(429);
    }
    try {
      return await deviceService.heartbeat(device);
    } catch {
      return status(403);
    }
  }, { auth: false });
