import { PrismaClient } from "../../generated/prisma/client";
import type { CreateDeviceInput, UpdateDeviceInput } from "../../type/device";
import { randomBytes } from "crypto";

function generateDeviceKey(): string {
    return "dk_" + randomBytes(16).toString("hex");
}

export class DeviceService {
    constructor(private prisma: PrismaClient) { }

    async createDevice(data: CreateDeviceInput) {
        const deviceKey = generateDeviceKey();
        try {
            const device = await this.prisma.device.create({
                data: {
                    name: data.name,
                    deviceKey,
                    roomId: data.roomId ?? null,
                    isActive: data.isActive ?? true,
                },
                include: { room: true },
            });
            return { device, deviceKey };
        } catch (e) {
            console.log(e);
            throw new Error("Failed to create device");
        }
    }

    async getAllDevices() {
        try {
            return await this.prisma.device.findMany({
                include: { room: true },
                orderBy: { createdAt: "desc" },
            });
        } catch (e) {
            console.log(e);
            throw new Error("Failed to get all devices");
        }
    }

    async getDeviceById(id: string) {
        try {
            return await this.prisma.device.findUnique({
                where: { id },
                include: { room: true },
            });
        } catch (e) {
            console.log(e);
            throw new Error("Failed to get device");
        }
    }

    async updateDevice(id: string, data: UpdateDeviceInput) {
        try {
            return await this.prisma.device.update({
                where: { id },
                data,
                include: { room: true },
            });
        } catch (e) {
            console.log(e);
            throw new Error("Failed to update device");
        }
    }

    async deleteDevice(id: string) {
        try {
            return await this.prisma.device.delete({ where: { id } });
        } catch (e) {
            console.log(e);
            throw new Error("Failed to delete device");
        }
    }

    async rotateDeviceKey(id: string) {
        const deviceKey = generateDeviceKey();
        try {
            await this.prisma.device.update({
                where: { id },
                data: { deviceKey },
            });
            return { deviceKey };
        } catch (e) {
            console.log(e);
            throw new Error("Failed to rotate device key");
        }
    }

    async heartbeat(id: string) {
        return this.prisma.device.update({
            where: { id },
            data: { lastSeenAt: new Date() },
            select: { id: true, lastSeenAt: true },
        });
    }

    async getDeviceStatus(id: string) {
        const device = await this.prisma.device.findUnique({
            where: { id },
            include: { room: true },
        });
        if (!device) throw new Error("Device not found");
        if (!device.roomId) return { device, currentBooking: null, nextBooking: null };

        const now = new Date();

        const currentBooking = await this.prisma.booking.findFirst({
            where: {
                roomId: device.roomId,
                status: { in: ["CHECKED_IN"] },
                startTime: { lte: now },
                endTime: { gt: now },
            },
            include: { user: { select: { name: true, email: true } } },
        });

        const nextBooking = await this.prisma.booking.findFirst({
            where: {
                roomId: device.roomId,
                status: { in: ["CONFIRMED"] },
                startTime: { gt: now },
            },
            include: { user: { select: { name: true, email: true } } },
            orderBy: { startTime: "asc" },
        });

        return { device, currentBooking, nextBooking };
    }

    async getDeviceSchedule(id: string) {
        const device = await this.prisma.device.findUnique({ where: { id } });
        if (!device) throw new Error("Device not found");
        if (!device.roomId) return { device, bookings: [] };

        const today = new Date();
        const start = new Date(today.setHours(0, 0, 0, 0));
        const end = new Date(today.setHours(23, 59, 59, 999));

        const bookings = await this.prisma.booking.findMany({
            where: {
                roomId: device.roomId,
                status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] },
                startTime: { gte: start },
                endTime: { lte: end },
            },
            include: { user: { select: { name: true } } },
            orderBy: { startTime: "asc" },
        });

        return { device, bookings };
    }

    async generatePairingCode(deviceId: string): Promise<{ code: string; expiresAt: Date }> {
        const device = await this.prisma.device.findUnique({ where: { id: deviceId } });
        if (!device) throw new Error("Device not found");

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await this.prisma.verification.create({
            data: {
                id: randomBytes(16).toString("hex"),
                identifier: `pairing:${code}`,
                value: `${deviceId}|${device.deviceKey}`,
                expiresAt,
            },
        });

        return { code, expiresAt };
    }

    async pairDevice(code: string): Promise<{ deviceId: string; deviceKey: string }> {
        const verification = await this.prisma.verification.findFirst({
            where: { identifier: `pairing:${code}`, expiresAt: { gt: new Date() } },
        });
        if (!verification) throw new Error("Invalid or expired pairing code");

        await this.prisma.verification.delete({ where: { id: verification.id } });

        const [deviceId, deviceKey] = verification.value.split("|");
        return { deviceId, deviceKey };
    }

    async scanQr(id: string, qrToken: string) {
        const device = await this.prisma.device.findUnique({ where: { id } });
        if (!device) throw new Error("Device not found");

        const booking = await this.prisma.booking.findFirst({
            where: { qrToken },
            include: {
                room: { select: { name: true, floor: true } },
                user: { select: { name: true, email: true } },
            },
        });

        if (!booking) throw new Error("Invalid QR token");
        if (booking.status !== "CONFIRMED") throw new Error("Booking is not confirmed");
        if (!booking.qrExpiresAt || booking.qrExpiresAt < new Date()) throw new Error("QR token has expired");
        if (device.roomId && booking.roomId !== device.roomId) throw new Error("QR code is for a different room");

        const now = new Date();
        const checkInOpens = new Date(booking.startTime.getTime() - 10 * 60 * 1000);
        if (now < checkInOpens) throw new Error("Too early to check in — opens 10 minutes before start");
        if (now > booking.startTime) throw new Error("Check-in window has passed");

        return this.prisma.booking.update({
            where: { id: booking.id },
            data: { status: "CHECKED_IN", checkedInAt: new Date(), qrToken: null, qrExpiresAt: null },
            include: {
                room: { select: { name: true, floor: true } },
                user: { select: { name: true, email: true } },
            },
        });
    }
}
