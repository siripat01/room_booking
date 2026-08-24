import type { PrismaClient } from "../../generated/prisma/client";
import type { CreateRoomInput } from "../../type/room";
import { AuditService, type AuditActor } from "../audit/audit.service";
import {
    addCalendarDays,
    bangkokDayBounds,
    bangkokLocalDateTimeToInstant,
    getBangkokDateTime,
} from "../lib/bangkok-time";

export class RoomService {
    private readonly audit = new AuditService();

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
            const start = bangkokLocalDateTimeToInstant(params.date, params.startTime);
            const end = bangkokLocalDateTimeToInstant(params.date, params.endTime);

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
            console.error(e);
            throw new Error("Failed to get room");
        }
    }

    async createRoom(data: CreateRoomInput, actor: AuditActor = { type: "SYSTEM" }) {
        try {
            return await this.prisma.$transaction(async (tx) => {
                const room = await tx.room.create({ data });
                await this.audit.record(tx, {
                    actor,
                    targetType: "ROOM",
                    targetId: room.id,
                    roomId: room.id,
                    eventType: "ROOM_CREATED",
                    newStatus: room.isActive ? "ACTIVE" : "INACTIVE",
                    metadata: { room: safeRoomAuditState(room) },
                });
                return room;
            });
        } catch (e) {
            console.error(e);
            throw new Error("Failed to create room");
        }
    }

    async updateRoom(id: string, data: Partial<CreateRoomInput>, actor: AuditActor = { type: "SYSTEM" }) {
        try {
            return await this.prisma.$transaction(async (tx) => {
                const previous = await tx.room.findUniqueOrThrow({ where: { id } });
                const room = await tx.room.update({ where: { id }, data });
                await this.audit.record(tx, {
                    actor,
                    targetType: "ROOM",
                    targetId: id,
                    roomId: id,
                    eventType: "ROOM_UPDATED",
                    previousStatus: previous.isActive ? "ACTIVE" : "INACTIVE",
                    newStatus: room.isActive ? "ACTIVE" : "INACTIVE",
                    metadata: {
                        before: safeRoomAuditState(previous),
                        after: safeRoomAuditState(room),
                    },
                });
                return room;
            });
        } catch (e) {
            console.error(e);
            throw new Error("Failed to update room");
        }
    }

    async deleteRoom(id: string, actor: AuditActor = { type: "SYSTEM" }) {
        try {
            return await this.prisma.$transaction(async (tx) => {
                const previous = await tx.room.findUniqueOrThrow({ where: { id } });
                const room = await tx.room.update({ where: { id }, data: { isActive: false } });
                await this.audit.record(tx, {
                    actor,
                    targetType: "ROOM",
                    targetId: id,
                    roomId: id,
                    eventType: "ROOM_DEACTIVATED",
                    previousStatus: previous.isActive ? "ACTIVE" : "INACTIVE",
                    newStatus: "INACTIVE",
                    metadata: { name: room.name },
                });
                return room;
            });
        } catch (e) {
            console.error(e);
            throw new Error("Failed to delete room");
        }
    }

    async getRoomSchedule(id: string) {
        try {
            const today = getBangkokDateTime(new Date()).date;
            const bounds = bangkokDayBounds(today);
            return await this.prisma.booking.findMany({
                where: {
                    roomId: id,
                    startTime: {
                        gte: bounds.start,
                        lt: bounds.end,
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
            console.error(e);
            throw new Error("Failed to get room schedule");
        }
    }

    async getRoomAvailability(id: string, date: string) {
        const room = await this.prisma.room.findUnique({
            where: { id },
            include: { timeSlots: true },
        });
        if (!room) throw new Error("Room not found");

        const dayOfWeek = getBangkokDateTime(bangkokLocalDateTimeToInstant(date, "12:00")).dayOfWeek;

        const timeSlot = room.timeSlots.find((s) => s.dayOfWeek === dayOfWeek && s.isActive);

        const { start: dayStart, end: dayEnd } = bangkokDayBounds(date);

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

    async getRoomCalendar(id: string, date: string) {
        const day = bangkokLocalDateTimeToInstant(date, "12:00").getUTCDay();
        const mondayDate = addCalendarDays(date, -((day + 6) % 7));
        const sundayDate = addCalendarDays(mondayDate, 7);
        const monday = bangkokDayBounds(mondayDate).start;
        const sunday = bangkokDayBounds(sundayDate).start;

        const bookings = await this.prisma.booking.findMany({
            where: {
                roomId: id,
                status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] },
                startTime: { gte: monday },
                endTime: { lt: sunday },
            },
            select: { id: true, startTime: true, endTime: true, status: true, purpose: true },
            orderBy: { startTime: "asc" },
            take: 200,
        });

        return { weekStart: monday.toISOString(), bookings };
    }

    // ── Time Slots ────────────────────────────────────────────────────────────

    async getTimeSlots(roomId: string) {
        return this.prisma.timeSlot.findMany({
            where: { roomId },
            orderBy: { dayOfWeek: "asc" },
            take: 7,
        });
    }

    async replaceTimeSlots(
        roomId: string,
        slots: { dayOfWeek: string; openTime: string; closeTime: string; isActive?: boolean }[],
        actor: AuditActor = { type: "SYSTEM" },
    ) {
        return this.prisma.$transaction(async (tx) => {
            await tx.room.findUniqueOrThrow({ where: { id: roomId }, select: { id: true } });
            const previous = await tx.timeSlot.findMany({ where: { roomId }, orderBy: { dayOfWeek: "asc" } });
            await tx.timeSlot.deleteMany({ where: { roomId } });
            const created = await tx.timeSlot.createMany({
                data: slots.map((s) => ({
                    roomId,
                    dayOfWeek: s.dayOfWeek as any,
                    openTime: s.openTime,
                    closeTime: s.closeTime,
                    isActive: s.isActive ?? true,
                })),
            });
            await this.audit.record(tx, {
                actor,
                targetType: "ROOM",
                targetId: roomId,
                roomId,
                eventType: "ROOM_TIME_SLOTS_REPLACED",
                metadata: {
                    previousCount: previous.length,
                    newCount: created.count,
                    slots: slots.map((slot) => ({
                        dayOfWeek: slot.dayOfWeek,
                        openTime: slot.openTime,
                        closeTime: slot.closeTime,
                        isActive: slot.isActive ?? true,
                    })),
                },
            });
            return created;
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

    async createClosure(
        roomId: string,
        data: { date: string; reason?: string; allDay?: boolean; startTime?: string; endTime?: string },
        actor: AuditActor = { type: "SYSTEM" },
    ) {
        return this.prisma.$transaction(async (tx) => {
            await tx.room.findUniqueOrThrow({ where: { id: roomId }, select: { id: true } });
            const closure = await tx.roomClosure.create({
                data: {
                    roomId,
                    date: new Date(data.date),
                    reason: data.reason,
                    allDay: data.allDay ?? true,
                    startTime: data.startTime,
                    endTime: data.endTime,
                },
            });
            await this.audit.record(tx, {
                actor,
                targetType: "ROOM",
                targetId: roomId,
                roomId,
                eventType: "ROOM_CLOSURE_CREATED",
                metadata: {
                    closureId: closure.id,
                    date: data.date,
                    reason: closure.reason ?? null,
                    allDay: closure.allDay,
                    startTime: closure.startTime ?? null,
                    endTime: closure.endTime ?? null,
                },
            });
            return closure;
        });
    }

    async deleteClosure(closureId: string, actor: AuditActor = { type: "SYSTEM" }) {
        return this.prisma.$transaction(async (tx) => {
            const closure = await tx.roomClosure.findUnique({ where: { id: closureId } });
            if (!closure) throw new Error("Closure not found");
            await tx.roomClosure.delete({ where: { id: closureId } });
            await this.audit.record(tx, {
                actor,
                targetType: "ROOM",
                targetId: closure.roomId,
                roomId: closure.roomId,
                eventType: "ROOM_CLOSURE_DELETED",
                metadata: { closureId, date: closure.date.toISOString().slice(0, 10) },
            });
            return { success: true };
        });
    }
}

function safeRoomAuditState(room: {
    name: string;
    description: string | null;
    capacity: number;
    floor: string;
    amenities: string[];
    allowedRoles: string[];
    autoApprove: boolean;
    isActive: boolean;
}) {
    return {
        name: room.name,
        description: room.description,
        capacity: room.capacity,
        floor: room.floor,
        amenities: room.amenities,
        allowedRoles: room.allowedRoles,
        autoApprove: room.autoApprove,
        isActive: room.isActive,
    };
}
