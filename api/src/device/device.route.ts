import Elysia, { t } from "elysia";
import { DeviceService } from "./device.service";
import { betterAuth } from "../middleware/auth.middleware";
import prisma from "../../libs/db";

const deviceService = new DeviceService(prisma);

export const deviceRoutes = new Elysia()
    .use(betterAuth)
    .get("/devices", async ({ user, status }) => {
        if (user.role !== "adminRole") return status(403);
        return await deviceService.getAllDevices();
    }, { auth: true })
    .get("/devices/:id", async ({ user, params: { id }, status }) => {
        if (user.role !== "adminRole") return status(403);
        return await deviceService.getDeviceById(id);
    }, { auth: true })
    .post("/devices", async ({ user, body, status }) => {
        if (user.role !== "adminRole") return status(403);
        return await deviceService.createDevice(body);
    }, {
        auth: true,
        body: t.Object({
            name: t.String(),
            roomId: t.Optional(t.Nullable(t.String())),
            isActive: t.Optional(t.Boolean()),
        }),
    })
    .put("/devices/:id", async ({ user, params: { id }, body, status }) => {
        if (user.role !== "adminRole") return status(403);
        return await deviceService.updateDevice(id, body);
    }, {
        auth: true,
        body: t.Object({
            name: t.Optional(t.String()),
            roomId: t.Optional(t.Nullable(t.String())),
            isActive: t.Optional(t.Boolean()),
        }),
    })
    .post("/devices/:id/rotate-key", async ({ user, params: { id }, status }) => {
        if (user.role !== "adminRole") return status(403);
        return await deviceService.rotateDeviceKey(id);
    }, { auth: true })
    .delete("/devices/:id", async ({ user, params: { id }, status }) => {
        if (user.role !== "adminRole") return status(403);
        return await deviceService.deleteDevice(id);
    }, { auth: true })

    // ── Kiosk self-service (deviceKey auth) ───────────────────────────────────
    .get("/devices/:id/status", async ({ params: { id }, headers, status }) => {
        const deviceKey = headers["x-device-key"];
        if (!deviceKey) return status(401);
        const device = await prisma.device.findFirst({ where: { id, deviceKey } });
        if (!device) return status(403);
        return await deviceService.getDeviceStatus(id);
    }, {
        auth: false,
    })
    .get("/devices/:id/schedule", async ({ params: { id }, headers, status }) => {
        const deviceKey = headers["x-device-key"];
        if (!deviceKey) return status(401);
        const device = await prisma.device.findFirst({ where: { id, deviceKey } });
        if (!device) return status(403);
        return await deviceService.getDeviceSchedule(id);
    }, {
        auth: false,
    })
    .post("/devices/:id/scan", async ({ params: { id }, headers, body, status }) => {
        const deviceKey = headers["x-device-key"];
        if (!deviceKey) return status(401);
        const device = await prisma.device.findFirst({ where: { id, deviceKey } });
        if (!device) return status(403);
        return await deviceService.scanQr(id, body.qrToken);
    }, {
        auth: false,
        body: t.Object({ qrToken: t.String() }),
    })
    .patch("/devices/:id/heartbeat", async ({ params: { id }, headers, status }) => {
        const deviceKey = headers["x-device-key"];
        if (!deviceKey) return status(401);
        const device = await prisma.device.findFirst({ where: { id, deviceKey } });
        if (!device) return status(403);
        return await deviceService.heartbeat(id);
    }, {
        auth: false,
    })
