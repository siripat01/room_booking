import Elysia, { t } from "elysia";
import { RoomService } from "./room.service";
import prisma from "../../libs/db";
import { betterAuth } from "../middleware/auth.middleware";
import type { CreateRoomInput } from "../../type/room";


const roomService = new RoomService(prisma)

const roomRoutes = new Elysia()
    .use(betterAuth)
    .get("/rooms", async ({ session }) => {
        return await roomService.getRooms();
    }, {
        auth: true,
    })
    .get("/rooms/:id", async ({ params: { id } }) => {
        return await roomService.getRoomById(id);
    }, {
        auth: true,
    })
    .get("/rooms/:id/schedule", async ({ params: { id }, session }) => {
        return await roomService.getRoomSchedule(id);
    }, {
        auth: true,
    })
    .post("/rooms", async ({ body, session }) => {
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
    .put("/rooms/:id", async ({ params: { id }, body }) => {
        return await roomService.updateRoom(id, body);
    }, {
        body: t.Object({
            name: t.String(),
            description: t.String(),
            capacity: t.Number(),
            floor: t.String(),
            amenities: t.Array(t.String()),
        }),
        auth: true,
    })
    .delete("/rooms/:id", async ({ params: { id } }) => {
        return await roomService.deleteRoom(id);
    }, {
        auth: true,
    })

export default roomRoutes