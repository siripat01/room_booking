import type { PrismaClient } from "../../generated/prisma/client";
import prisma from "../../libs/db";
import type { CreateRoomInput } from "../../type/room";

export class RoomService {
    constructor(
        private readonly prisma: PrismaClient,
    ) { }

    async getRooms() {
        try {
            return this.prisma.room.findMany();
        } catch (e) {
            console.log(e);
            throw new Error("Failed to get rooms");
        }
    }

    async getRoomById(id: string) {
        try {
            return await this.prisma.room.findUnique({
                where: { id: id }
            })
        } catch (e) {
            console.log(e);
            throw new Error("Failed to get room");
        }
    }

    async createRoom(data: CreateRoomInput) {
        try {
            return await this.prisma.room.create({
                data,
            })
        } catch (e) {
            console.log(e);
            throw new Error("Failed to create room");
        }
    }

    async updateRoom(id: string, data: CreateRoomInput) {
        try {
            return await this.prisma.room.update({
                where: { id },
                data,
            })
        } catch (e) {
            console.log(e);
            throw new Error("Failed to update room");
        }
    }

    async deleteRoom(id: string) {
        try {
            return await this.prisma.room.delete({
                where: { id },
            })
        } catch (e) {
            console.log(e);
            throw new Error("Failed to delete room");
        }
    }

    async getRoomSchedule(id: string) {
        try {
            const today = new Date().toISOString().split('T')[0];

            const bookingToday = await this.prisma.booking.findMany({
                where: {
                    createdAt: {
                        gte: new Date(today),
                        lt: new Date(new Date(today).setDate(new Date(today).getDate() + 1)),
                    },
                    roomId: id
                },
                select: {
                    id: true,
                    startTime: true,
                    endTime: true,
                    attendees: true,
                    purpose: true,
                    status: true,
                }
            })

            return bookingToday;
        } catch (e) {
            console.log(e);
            throw new Error("Failed to get room schedule");
        }
    }
}
