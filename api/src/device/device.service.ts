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

    async deleteDevice(id: string) {
        try {
            return await this.prisma.device.delete({
                where: { id }
            });
        } catch (e) {
            console.log(e);
            throw new Error("Failed to delete device");
        }
    }
}
