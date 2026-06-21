import Elysia, { t } from "elysia";
import { DeviceService } from "./device.service";
import { betterAuth } from "../middleware/auth.middleware";
import prisma from "../../libs/db";

const deviceService = new DeviceService(prisma);

export const deviceRoutes = new Elysia()
    .use(betterAuth)
    .get("/devices", async ({ user }) => {
        if (user.role !== "admin") {
            throw new Error("Unauthorized");
        }
        return await deviceService.getAllDevices();
    }, { auth: true })
    .get("/devices/:id", async ({ params: { id } }) => {
        return await deviceService.getDeviceById(id);
    }, { auth: true })
    .post("/devices", async ({ body }) => {
        return await deviceService.createDevice(body);
    }, {
        body: t.Object({
            name: t.String(),
            roomId: t.Optional(t.Nullable(t.String())),
            isActive: t.Optional(t.Boolean()),
        }),
        auth: true,
    })
    .put("/devices/:id", async ({ params: { id }, body }) => {
        return await deviceService.updateDevice(id, body);
    }, {
        body: t.Object({
            name: t.Optional(t.String()),
            roomId: t.Optional(t.Nullable(t.String())),
            isActive: t.Optional(t.Boolean()),
        }),
        auth: true,
    })
    .patch("/devices/:id/rotate-key", async ({ params: { id } }) => {
        return await deviceService.rotateDeviceKey(id);
    }, { auth: true })
    .delete("/devices/:id", async ({ params: { id } }) => {
        return await deviceService.deleteDevice(id);
    }, { auth: true })
