import Elysia, { t } from "elysia";
import { RoomService } from "./room.service";
import prisma from "../../libs/db";
import { betterAuth } from "../middleware/auth.middleware";
import type { CreateRoomInput } from "../../type/room";


const roomService = new RoomService(prisma)

const roomRoutes = new Elysia()
    .use(betterAuth)
    .get("/rooms", async () => {
        return await roomService.getRooms();
    }, {
        auth: true,
    })
    .get("/rooms/:id", async ({ params: { id } }) => {
        return await roomService.getRoomById(id);
    }, {
        auth: true,
    })
    .get("/rooms/:id/availability", async ({ params: { id }, query }) => {
        const date = query.date ?? new Date().toISOString().split("T")[0];
        return await roomService.getRoomAvailability(id, date);
    }, {
        auth: true,
        query: t.Object({ date: t.Optional(t.String()) }),
    })
    .get("/rooms/:id/schedule", async ({ params: { id } }) => {
        return await roomService.getRoomSchedule(id);
    }, {
        auth: true,
    })
    .post("/rooms", async ({ user, body, status }) => {
        if (user.role !== "adminRole") return status(403);
        return await roomService.createRoom(body);
    }, {
        body: t.Object({
            name: t.String(),
            description: t.Optional(t.String()),
            capacity: t.Number(),
            floor: t.String(),
            amenities: t.Array(t.String()),
        }),
        auth: true,
    })
    .put("/rooms/:id", async ({ user, params: { id }, body, status }) => {
        if (user.role !== "adminRole") return status(403);
        return await roomService.updateRoom(id, body);
    }, {
        body: t.Object({
            name: t.String(),
            description: t.Optional(t.String()),
            capacity: t.Number(),
            floor: t.String(),
            amenities: t.Array(t.String()),
        }),
        auth: true,
    })
    .delete("/rooms/:id", async ({ user, params: { id }, status }) => {
        if (user.role !== "adminRole") return status(403);
        return await roomService.deleteRoom(id);
    }, {
        auth: true,
    })

export default roomRoutes