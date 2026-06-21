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

    async getRoomAvailability(id: string, date: string) {
        const room = await this.prisma.room.findUnique({
            where: { id },
            include: { timeSlots: true },
        });
        if (!room) throw new Error("Room not found");

        const dayOfWeek = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"][
            new Date(date).getDay()
        ] as "SUNDAY" | "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY";

        const timeSlot = room.timeSlots.find((s) => s.dayOfWeek === dayOfWeek && s.isActive);

        const dayStart = new Date(`${date}T00:00:00.000Z`);
        const dayEnd = new Date(`${date}T23:59:59.999Z`);

        const bookings = await this.prisma.booking.findMany({
            where: {
                roomId: id,
                status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] },
                startTime: { lt: dayEnd },
                endTime: { gt: dayStart },
            },
            select: { startTime: true, endTime: true, status: true },
            orderBy: { startTime: "asc" },
        });

        return {
            room: { id: room.id, name: room.name, capacity: room.capacity, floor: room.floor },
            date,
            openTime: timeSlot?.openTime ?? null,
            closeTime: timeSlot?.closeTime ?? null,
            bookings: bookings.map((b) => ({
                startTime: b.startTime,
                endTime: b.endTime,
                status: b.status,
            })),
        };
    }
}
