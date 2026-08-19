import Elysia, { t } from "elysia";
import { DeviceService } from "./device.service";
import { BookingService } from "../booking/booking.service";
import { betterAuth } from "../middleware/auth.middleware";
import prisma from "../../libs/db";

// In-memory rate limiter for /devices/pair: max 10 attempts per IP per 5 minutes
const pairAttempts = new Map<string, { count: number; resetAt: number }>();
function checkPairRateLimit(ip: string): boolean {
    const now = Date.now();
    const entry = pairAttempts.get(ip);
    if (!entry || entry.resetAt < now) {
        pairAttempts.set(ip, { count: 1, resetAt: now + 5 * 60 * 1000 });
        return true;
    }
    if (entry.count >= 10) return false;
    entry.count++;
    return true;
}

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
    .post("/devices/pair", async ({ body, status, request }) => {
        const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
        if (!checkPairRateLimit(ip)) return status(429, { error: "Too many attempts. Please wait 5 minutes." });
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
    .post("/devices/:id/scan", async ({ params: { id }, headers, body, status, request }) => {
        const deviceKey = headers["x-device-key"];
        if (!deviceKey) return status(401);
        const device = await prisma.device.findFirst({ where: { id, deviceKey } });
        if (!device) return status(403);
        try {
            return await deviceService.scanQr(id, body.qrToken, request.headers.get("x-request-id") ?? crypto.randomUUID());
        } catch (e: any) {
            return status(400, { message: e.message });
        }
    }, {
        auth: false,
        body: t.Object({ qrToken: t.String() }),
    })
    .post("/devices/:id/walkin", async ({ params: { id }, headers, body, status: setStatus, request }) => {
        const deviceKey = headers["x-device-key"];
        if (!deviceKey) return setStatus(401);
        const device = await prisma.device.findFirst({
            where: { id, deviceKey },
            include: { room: { select: { id: true, autoApprove: true } } },
        });
        if (!device || !device.room) return setStatus(403, { error: "Device not linked to a room" });

        // Use the first admin user as the walk-in actor
        const adminUser = await prisma.user.findFirst({ where: { role: "adminRole" }, select: { id: true } });
        if (!adminUser) return setStatus(500, { error: "No admin user found" });

        const bookingService = new BookingService(prisma);
        try {
            return await bookingService.createBooking({
                userId: adminUser.id,
                roomId: device.room.id,
                startTime: new Date(body.startTime),
                endTime: new Date(body.endTime),
                attendees: body.attendees,
                purpose: body.purpose ?? "Walk-in Booking",
                autoConfirm: device.room.autoApprove,
                userRole: "adminRole",
                actor: {
                    type: "DEVICE",
                    id: device.id,
                    correlationId: request.headers.get("x-request-id") ?? crypto.randomUUID(),
                    metadata: { source: "walk-in" },
                },
            });
        } catch (e: any) {
            return setStatus(400, { error: e.message });
        }
    }, {
        auth: false,
        body: t.Object({
            startTime: t.String(),
            endTime: t.String(),
            attendees: t.Number({ minimum: 1, maximum: 500 }),
            purpose: t.Optional(t.String()),
        }),
    })
    .patch("/devices/:id/heartbeat", async ({ params: { id }, headers, status }) => {
        const deviceKey = headers["x-device-key"];
        if (!deviceKey) return status(401);
        const device = await prisma.device.findFirst({ where: { id, deviceKey } });
        if (!device) return status(403);
        return await deviceService.heartbeat(id);
    }, { auth: false })
