import type { PrismaClient } from "../../generated/prisma/client";

export class ReportService {
    constructor(private prisma: PrismaClient) { }

    async getOverview(from?: string, to?: string, roomId?: string) {
        const dateFilter = this.dateFilter(from, to);
        const roomFilter = roomId ? { roomId } : {};

        const where = { ...dateFilter, ...roomFilter };

        const [
            totalRooms,
            totalBookings,
            pendingBookings,
            confirmedBookings,
            cancelledBookings,
            totalUsers,
        ] = await Promise.all([
            this.prisma.room.count({ where: { isActive: true } }),
            this.prisma.booking.count({ where }),
            this.prisma.booking.count({ where: { ...where, status: "PENDING" } }),
            this.prisma.booking.count({ where: { ...where, status: "CONFIRMED" } }),
            this.prisma.booking.count({ where: { ...where, status: "CANCELLED" } }),
            this.prisma.user.count(),
        ]);

        const popularRooms = await this.prisma.booking.groupBy({
            by: ["roomId"],
            where,
            _count: { id: true },
            orderBy: { _count: { id: "desc" } },
            take: 5,
        });

        const roomDetails = await this.prisma.room.findMany({
            where: { id: { in: popularRooms.map((r) => r.roomId) } },
            select: { id: true, name: true, floor: true },
        });

        const roomMap = Object.fromEntries(roomDetails.map((r) => [r.id, r]));

        return {
            totalRooms,
            totalBookings,
            pendingBookings,
            confirmedBookings,
            cancelledBookings,
            totalUsers,
            popularRooms: popularRooms.map((r) => ({
                room: roomMap[r.roomId],
                bookingCount: r._count.id,
            })),
        };
    }

    async getRoomUsage(from?: string, to?: string, roomId?: string) {
        const dateFilter = this.dateFilter(from, to);
        const rooms = await this.prisma.room.findMany({
            where: { isActive: true, ...(roomId ? { id: roomId } : {}) },
            select: { id: true, name: true, floor: true, capacity: true },
            take: 200,
        });

        const usage = await this.prisma.booking.groupBy({
            by: ["roomId"],
            where: { ...dateFilter, status: { in: ["CONFIRMED", "CHECKED_IN", "COMPLETED"] } },
            _count: { id: true },
        });

        const countMap = Object.fromEntries(usage.map((u) => [u.roomId, u._count.id]));

        return rooms.map((room) => ({
            room,
            bookingCount: countMap[room.id] ?? 0,
        })).sort((a, b) => b.bookingCount - a.bookingCount);
    }

    async getBookingsSummary(from?: string, to?: string, roomId?: string) {
        const dateFilter = this.dateFilter(from, to);
        const where: any = { ...dateFilter, ...(roomId ? { roomId } : {}) };

        const byStatus = await this.prisma.booking.groupBy({
            by: ["status"],
            where,
            _count: { id: true },
        });

        const byDate = await this.prisma.booking.findMany({
            where,
            select: { createdAt: true, status: true },
            orderBy: { createdAt: "asc" },
            take: 5000,
        });

        // group by date string
        const dailyMap: Record<string, number> = {};
        for (const b of byDate) {
            const d = b.createdAt.toISOString().split("T")[0];
            dailyMap[d] = (dailyMap[d] ?? 0) + 1;
        }

        return {
            byStatus: byStatus.map((s) => ({ status: s.status, count: s._count.id })),
            daily: Object.entries(dailyMap).map(([date, count]) => ({ date, count })),
        };
    }

    async getPeakHours(from?: string, to?: string, roomId?: string) {
        const dateFilter = this.dateFilter(from, to);
        const where: any = { ...dateFilter, ...(roomId ? { roomId } : {}), status: { in: ["CONFIRMED", "CHECKED_IN", "COMPLETED"] } };

        const bookings = await this.prisma.booking.findMany({
            where,
            select: { startTime: true },
            take: 5000,
        });

        const hourMap: Record<number, number> = {};
        for (const b of bookings) {
            const hour = b.startTime.getHours();
            hourMap[hour] = (hourMap[hour] ?? 0) + 1;
        }

        return Array.from({ length: 24 }, (_, h) => ({
            hour: h,
            label: `${String(h).padStart(2, "0")}:00`,
            count: hourMap[h] ?? 0,
        }));
    }

    async getActiveUsers(from?: string, to?: string) {
        const dateFilter = this.dateFilter(from, to);

        const usage = await this.prisma.booking.groupBy({
            by: ["userId"],
            where: dateFilter,
            _count: { id: true },
            orderBy: { _count: { id: "desc" } },
            take: 10,
        });

        const users = await this.prisma.user.findMany({
            where: { id: { in: usage.map((u) => u.userId) } },
            select: { id: true, name: true, email: true, image: true },
        });

        const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

        return usage.map((u) => ({
            user: userMap[u.userId],
            bookingCount: u._count.id,
        }));
    }

    private dateFilter(from?: string, to?: string) {
        if (!from && !to) return {};
        const filter: any = {};
        if (from) filter.gte = new Date(from);
        if (to) filter.lte = new Date(to);
        return { createdAt: filter };
    }
}
