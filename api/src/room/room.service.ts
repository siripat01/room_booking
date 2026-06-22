import type { PrismaClient } from "../../generated/prisma/client";
import prisma from "../../libs/db";
import type { CreateRoomInput } from "../../type/room";

export class RoomService {
    constructor(
        private readonly prisma: PrismaClient,
    ) { }

    async getRooms(params?: { date?: string; startTime?: string; endTime?: string; capacity?: number; amenities?: string[]; floor?: string }) {
        const where: any = { isActive: true };
        if (params?.floor) where.floor = params.floor;
        if (params?.capacity) where.capacity = { gte: params.capacity };
        if (params?.amenities?.length) where.amenities = { hasEvery: params.amenities };

        const rooms = await this.prisma.room.findMany({
            where,
            include: { timeSlots: true },
            orderBy: { name: "asc" },
            take: 200,
        });

        // filter out rooms with conflicting bookings for the requested time window
        if (params?.date && params?.startTime && params?.endTime) {
            const start = new Date(`${params.date}T${params.startTime}:00`);
            const end = new Date(`${params.date}T${params.endTime}:00`);

            const conflicted = await this.prisma.booking.findMany({
                where: {
                    status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] },
                    startTime: { lt: end },
                    endTime: { gt: start },
                },
                select: { roomId: true },
                distinct: ["roomId"],
                take: 500,
            });

            const conflictedIds = new Set(conflicted.map((b) => b.roomId));
            return rooms.filter((r) => !conflictedIds.has(r.id));
        }

        return rooms;
    }

    async getRoomById(id: string) {
        try {
            return await this.prisma.room.findUnique({
                where: { id },
                include: { timeSlots: true },
            });
        } catch (e) {
            console.log(e);
            throw new Error("Failed to get room");
        }
    }

    async createRoom(data: CreateRoomInput) {
        try {
            return await this.prisma.room.create({ data });
        } catch (e) {
            console.log(e);
            throw new Error("Failed to create room");
        }
    }

    async updateRoom(id: string, data: Partial<CreateRoomInput>) {
        try {
            return await this.prisma.room.update({ where: { id }, data });
        } catch (e) {
            console.log(e);
            throw new Error("Failed to update room");
        }
    }

    async deleteRoom(id: string) {
        try {
            return await this.prisma.room.update({
                where: { id },
                data: { isActive: false },
            });
        } catch (e) {
            console.log(e);
            throw new Error("Failed to delete room");
        }
    }

    async getRoomSchedule(id: string) {
        try {
            const today = new Date().toISOString().split('T')[0];
            return await this.prisma.booking.findMany({
                where: {
                    roomId: id,
                    startTime: {
                        gte: new Date(today),
                        lt: new Date(new Date(today).setDate(new Date(today).getDate() + 1)),
                    },
                },
                select: {
                    id: true,
                    startTime: true,
                    endTime: true,
                    attendees: true,
                    purpose: true,
                    status: true,
                },
                orderBy: { startTime: "asc" },
                take: 50,
            });
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
            take: 50,
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

    // ── Time Slots ────────────────────────────────────────────────────────────

    async getTimeSlots(roomId: string) {
        return this.prisma.timeSlot.findMany({
            where: { roomId },
            orderBy: { dayOfWeek: "asc" },
            take: 7,
        });
    }

    async replaceTimeSlots(roomId: string, slots: { dayOfWeek: string; openTime: string; closeTime: string; isActive?: boolean }[]) {
        await this.prisma.timeSlot.deleteMany({ where: { roomId } });
        return this.prisma.timeSlot.createMany({
            data: slots.map((s) => ({
                roomId,
                dayOfWeek: s.dayOfWeek as any,
                openTime: s.openTime,
                closeTime: s.closeTime,
                isActive: s.isActive ?? true,
            })),
        });
    }

    // ── Closures ──────────────────────────────────────────────────────────────

    async getClosures(roomId: string) {
        return this.prisma.roomClosure.findMany({
            where: { roomId },
            orderBy: { date: "asc" },
            take: 200,
        });
    }

    async createClosure(roomId: string, data: { date: string; reason?: string; allDay?: boolean; startTime?: string; endTime?: string }) {
        return this.prisma.roomClosure.create({
            data: {
                roomId,
                date: new Date(data.date),
                reason: data.reason,
                allDay: data.allDay ?? true,
                startTime: data.startTime,
                endTime: data.endTime,
            },
        });
    }

    async deleteClosure(closureId: string) {
        const closure = await this.prisma.roomClosure.findUnique({ where: { id: closureId } });
        if (!closure) throw new Error("Closure not found");
        await this.prisma.roomClosure.delete({ where: { id: closureId } });
        return { success: true };
    }
}
