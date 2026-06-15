import { PrismaClient } from "../../generated/prisma/client";
import type { CreateDeviceInput } from "../../type/device";

export class DeviceService {
    constructor(private prisma: PrismaClient) { }

    async createDevice(data: CreateDeviceInput) {
        try {
            return await this.prisma.device.create({
                data
            })
        } catch (e) {
            console.log(e);
            throw new Error("Failed to create device");
        }
    }

    async getAllDevices() {
        try {
            return await this.prisma.device.findMany()
        } catch (e) {
            console.log(e);
            throw new Error("Failed to get all devices");
        }
    }

    async getDeviceById(id: string) {
        try {
            return await this.prisma.device.findUnique({
                where: { id }
            })
        } catch (e) {
            console.log(e);
            throw new Error("Failed to get device");
        }
    }

    async updateDevice(id: string, data: CreateDeviceInput) {
        try {
            return await this.prisma.device.update({
                where: { id },
                data
            })
        } catch (e) {
            console.log(e);
            throw new Error("Failed to update device");
        }
    }

    async deleteDevice(id: string) {
        try {
            return await this.prisma.device.delete({
                where: { id }
            })
        } catch (e) {
            console.log(e);
            throw new Error("Failed to delete device");
        }
    }
}