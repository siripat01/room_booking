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
        body: t.Object({
            name: t.String(),
            roomId: t.Optional(t.Nullable(t.String())),
            isActive: t.Optional(t.Boolean()),
        }),
        auth: true,
    })
    .put("/devices/:id", async ({ user, params: { id }, body, status }) => {
        if (user.role !== "adminRole") return status(403);
        return await deviceService.updateDevice(id, body);
    }, {
        body: t.Object({
            name: t.Optional(t.String()),
            roomId: t.Optional(t.Nullable(t.String())),
            isActive: t.Optional(t.Boolean()),
        }),
        auth: true,
    })
    .post("/devices/:id/rotate-key", async ({ user, params: { id }, status }) => {
        if (user.role !== "adminRole") return status(403);
        return await deviceService.rotateDeviceKey(id);
    }, { auth: true })
    .delete("/devices/:id", async ({ user, params: { id }, status }) => {
        if (user.role !== "adminRole") return status(403);
        return await deviceService.deleteDevice(id);
    }, { auth: true })
