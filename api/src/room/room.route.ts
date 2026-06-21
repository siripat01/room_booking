import Elysia, { t } from "elysia";
import { RoomService } from "./room.service";
import prisma from "../../libs/db";
import { betterAuth } from "../middleware/auth.middleware";

const roomService = new RoomService(prisma);

const DAY_OF_WEEK = t.Union([
    t.Literal("SUNDAY"), t.Literal("MONDAY"), t.Literal("TUESDAY"),
    t.Literal("WEDNESDAY"), t.Literal("THURSDAY"), t.Literal("FRIDAY"), t.Literal("SATURDAY"),
]);

const roomRoutes = new Elysia()
    .use(betterAuth)
    .get("/rooms", async ({ query }) => {
        return await roomService.getRooms({
            date: query.date,
            startTime: query.startTime,
            endTime: query.endTime,
            capacity: query.capacity ? Number(query.capacity) : undefined,
            amenities: query.amenities ? query.amenities.split(",") : undefined,
            floor: query.floor,
        });
    }, {
        auth: true,
        query: t.Object({
            date: t.Optional(t.String()),
            startTime: t.Optional(t.String()),
            endTime: t.Optional(t.String()),
            capacity: t.Optional(t.String()),
            amenities: t.Optional(t.String()),
            floor: t.Optional(t.String()),
        }),
    })
    .get("/rooms/:id", async ({ params: { id } }) => {
        return await roomService.getRoomById(id);
    }, { auth: true })
    .get("/rooms/:id/availability", async ({ params: { id }, query }) => {
        const date = query.date ?? new Date().toISOString().split("T")[0];
        return await roomService.getRoomAvailability(id, date);
    }, {
        auth: true,
        query: t.Object({ date: t.Optional(t.String()) }),
    })
    .get("/rooms/:id/schedule", async ({ params: { id } }) => {
        return await roomService.getRoomSchedule(id);
    }, { auth: true })
    .post("/rooms", async ({ user, body, status }) => {
        if (user.role !== "adminRole") return status(403);
        return await roomService.createRoom(body);
    }, {
        auth: true,
        body: t.Object({
            name: t.String(),
            description: t.Optional(t.String()),
            capacity: t.Number(),
            floor: t.String(),
            amenities: t.Optional(t.Array(t.String())),
        }),
    })
    .put("/rooms/:id", async ({ user, params: { id }, body, status }) => {
        if (user.role !== "adminRole") return status(403);
        return await roomService.updateRoom(id, body);
    }, {
        auth: true,
        body: t.Object({
            name: t.Optional(t.String()),
            description: t.Optional(t.String()),
            capacity: t.Optional(t.Number()),
            floor: t.Optional(t.String()),
            amenities: t.Optional(t.Array(t.String())),
            isActive: t.Optional(t.Boolean()),
        }),
    })
    .delete("/rooms/:id", async ({ user, params: { id }, status }) => {
        if (user.role !== "adminRole") return status(403);
        return await roomService.deleteRoom(id);
    }, { auth: true })

    // ── Time Slots ────────────────────────────────────────────────────────────
    .get("/rooms/:id/time-slots", async ({ params: { id } }) => {
        return await roomService.getTimeSlots(id);
    }, { auth: true })
    .put("/rooms/:id/time-slots", async ({ user, params: { id }, body, status }) => {
        if (user.role !== "adminRole") return status(403);
        return await roomService.replaceTimeSlots(id, body.slots);
    }, {
        auth: true,
        body: t.Object({
            slots: t.Array(t.Object({
                dayOfWeek: t.String(),
                openTime: t.String(),
                closeTime: t.String(),
                isActive: t.Optional(t.Boolean()),
            })),
        }),
    })

    // ── Closures ──────────────────────────────────────────────────────────────
    .get("/rooms/:id/closures", async ({ params: { id } }) => {
        return await roomService.getClosures(id);
    }, { auth: true })
    .post("/rooms/:id/closures", async ({ user, params: { id }, body, status }) => {
        if (user.role !== "adminRole") return status(403);
        return await roomService.createClosure(id, body);
    }, {
        auth: true,
        body: t.Object({
            date: t.String(),
            reason: t.Optional(t.String()),
            allDay: t.Optional(t.Boolean()),
            startTime: t.Optional(t.String()),
            endTime: t.Optional(t.String()),
        }),
    })
    .delete("/rooms/:id/closures/:cId", async ({ user, params: { id, cId }, status }) => {
        if (user.role !== "adminRole") return status(403);
        return await roomService.deleteClosure(cId);
    }, { auth: true })

export default roomRoutes;
