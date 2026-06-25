import Elysia, { t } from "elysia";
import { RoomService } from "./room.service";
import prisma from "../../libs/db";
import { betterAuth } from "../middleware/auth.middleware";

const roomService = new RoomService(prisma);

const roomRoutes = new Elysia()
    .use(betterAuth)

    // ── Public (any authenticated user) ──────────────────────────────────────
    .get("/rooms", ({ query }) =>
        roomService.getRooms({
            date: query.date,
            startTime: query.startTime,
            endTime: query.endTime,
            capacity: query.capacity ? Number(query.capacity) : undefined,
            amenities: query.amenities ? query.amenities.split(",") : undefined,
            floor: query.floor,
        }), {
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
    .get("/rooms/:id", ({ params: { id } }) => roomService.getRoomById(id), { auth: true })
    .get("/rooms/:id/availability", ({ params: { id }, query }) => {
        const date = query.date ?? new Date().toISOString().split("T")[0];
        return roomService.getRoomAvailability(id, date);
    }, {
        auth: true,
        query: t.Object({ date: t.Optional(t.String()) }),
    })
    .get("/rooms/:id/schedule", ({ params: { id } }) => roomService.getRoomSchedule(id), { auth: true })
    .get("/rooms/:id/time-slots", ({ params: { id } }) => roomService.getTimeSlots(id), { auth: true })
    .get("/rooms/:id/closures", ({ params: { id } }) => roomService.getClosures(id), { auth: true })

    // ── Admin-only ────────────────────────────────────────────────────────────
    .guard({ auth: true }, (app) =>
        app
            .onBeforeHandle(({ user, status }) => {
                if (user.role !== "adminRole") return status(403);
            })
            .post("/rooms", ({ body }) =>
                roomService.createRoom({ ...body, amenities: body.amenities ?? [], allowedRoles: body.allowedRoles ?? [], autoApprove: body.autoApprove ?? false }), {
                body: t.Object({
                    name: t.String(),
                    description: t.Optional(t.String()),
                    capacity: t.Number(),
                    floor: t.String(),
                    amenities: t.Optional(t.Array(t.String())),
                    allowedRoles: t.Optional(t.Array(t.String())),
                    autoApprove: t.Optional(t.Boolean()),
                }),
            })
            .put("/rooms/:id", ({ params: { id }, body }) => roomService.updateRoom(id, body), {
                body: t.Object({
                    name: t.Optional(t.String()),
                    description: t.Optional(t.String()),
                    capacity: t.Optional(t.Number()),
                    floor: t.Optional(t.String()),
                    amenities: t.Optional(t.Array(t.String())),
                    allowedRoles: t.Optional(t.Array(t.String())),
                    isActive: t.Optional(t.Boolean()),
                    autoApprove: t.Optional(t.Boolean()),
                }),
            })
            .delete("/rooms/:id", ({ params: { id } }) => roomService.deleteRoom(id))
            .put("/rooms/:id/time-slots", ({ params: { id }, body }) =>
                roomService.replaceTimeSlots(id, body.slots), {
                body: t.Object({
                    slots: t.Array(t.Object({
                        dayOfWeek: t.String(),
                        openTime: t.String(),
                        closeTime: t.String(),
                        isActive: t.Optional(t.Boolean()),
                    })),
                }),
            })
            .post("/rooms/:id/closures", ({ params: { id }, body }) => roomService.createClosure(id, body), {
                body: t.Object({
                    date: t.String(),
                    reason: t.Optional(t.String()),
                    allDay: t.Optional(t.Boolean()),
                    startTime: t.Optional(t.String()),
                    endTime: t.Optional(t.String()),
                }),
            })
            .delete("/rooms/:id/closures/:cId", ({ params: { cId } }) => roomService.deleteClosure(cId))
    )

export default roomRoutes;
