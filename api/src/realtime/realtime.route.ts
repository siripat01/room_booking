import Elysia, { t } from "elysia";
import prisma from "../../libs/db";
import { DeviceService } from "../device/device.service";
import { betterAuth } from "../middleware/auth.middleware";
import { RealtimeEventService } from "./realtime-event.service";

const realtime = new RealtimeEventService(prisma);
const devices = new DeviceService(prisma);

export const realtimeRoutes = new Elysia()
  .use(betterAuth)
  .get("/realtime/events", ({ user, request, query }) =>
    realtime.stream(
      {
        userId: user.id,
        admin: user.role === "adminRole",
        roomId: query.roomId,
      },
      request,
      query.cursor,
    ), {
      auth: true,
      query: t.Object({
        roomId: t.Optional(t.String()),
        cursor: t.Optional(t.String()),
      }),
    })
  .get("/devices/:deviceId/events", async ({ params, headers, request, query, status }) => {
    const deviceKey = headers["x-device-key"];
    if (!deviceKey) return status(401);
    const device = await devices.authenticateDevice(params.deviceId, deviceKey);
    if (!device?.roomId) return status(403);
    return realtime.stream(
      { roomId: device.roomId, deviceId: device.id },
      request,
      query.cursor,
    );
  }, {
    auth: false,
    query: t.Object({ cursor: t.Optional(t.String()) }),
  });
