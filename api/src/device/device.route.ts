import Elysia, { t } from "elysia";
import { DeviceService } from "./device.service";
import { betterAuth } from "../middleware/auth.middleware";
import prisma from "../../libs/db";

const deviceService = new DeviceService(prisma);

export const deviceRoutes = new Elysia()
    .use(betterAuth)

    // ── Admin-only routes ─────────────────────────────────────────────────────
    .guard({ auth: true }, (app) =>
        app
            .onBeforeHandle(({ user, status }) => {
                if (user.role !== "adminRole") return status(403);
            })
            .get("/devices", () => deviceService.getAllDevices())
            .get("/devices/:id", ({ params: { id } }) => deviceService.getDeviceById(id))
            .post("/devices", ({ body }) => deviceService.createDevice(body), {
                body: t.Object({
                    name: t.String(),
                    roomId: t.Optional(t.Nullable(t.String())),
                    isActive: t.Optional(t.Boolean()),
                }),
            })
            .put("/devices/:id", ({ params: { id }, body }) => deviceService.updateDevice(id, body), {
                body: t.Object({
                    name: t.Optional(t.String()),
                    roomId: t.Optional(t.Nullable(t.String())),
                    isActive: t.Optional(t.Boolean()),
                }),
            })
            .post("/devices/:id/rotate-key", ({ params: { id } }) => deviceService.rotateDeviceKey(id))
            .delete("/devices/:id", ({ params: { id } }) => deviceService.deleteDevice(id))
            .post("/devices/:id/generate-pairing", ({ params: { id } }) => deviceService.generatePairingCode(id))
    )

    // ── Pairing (public) ──────────────────────────────────────────────────────
    .post("/devices/pair", async ({ body, status }) => {
        try {
            return await deviceService.pairDevice(body.code);
        } catch (e: any) {
            return status(400, { error: e.message });
        }
    }, {
        auth: false,
        body: t.Object({ code: t.String() }),
    })

    // ── Kiosk self-service (deviceKey auth) ───────────────────────────────────
    .get("/devices/:id/status", async ({ params: { id }, headers, status }) => {
        const deviceKey = headers["x-device-key"];
        if (!deviceKey) return status(401);
        const device = await prisma.device.findFirst({ where: { id, deviceKey } });
        if (!device) return status(403);
        return await deviceService.getDeviceStatus(id);
    }, { auth: false })
    .get("/devices/:id/schedule", async ({ params: { id }, headers, status }) => {
        const deviceKey = headers["x-device-key"];
        if (!deviceKey) return status(401);
        const device = await prisma.device.findFirst({ where: { id, deviceKey } });
        if (!device) return status(403);
        return await deviceService.getDeviceSchedule(id);
    }, { auth: false })
    .post("/devices/:id/scan", async ({ params: { id }, headers, body, status }) => {
        const deviceKey = headers["x-device-key"];
        if (!deviceKey) return status(401);
        const device = await prisma.device.findFirst({ where: { id, deviceKey } });
        if (!device) return status(403);
        try {
            return await deviceService.scanQr(id, body.qrToken);
        } catch (e: any) {
            return status(400, { message: e.message });
        }
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
    }, { auth: false })
