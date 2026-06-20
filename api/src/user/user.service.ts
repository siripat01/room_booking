import type { PrismaClient } from "../../generated/prisma/client";
import prisma from "../../libs/db";

export class UserService {
  constructor(private readonly prisma: PrismaClient) {}

  async getUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        banned: true,
        banReason: true,
        banExpires: true,
        createdAt: true,
        _count: { select: { bookings: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async updateUserRole(userId: string, role: string) {
    const allowed = ["userRole", "teacherRole", "adminRole"];
    if (!allowed.includes(role)) throw new Error("Invalid role");

    return this.prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, name: true, email: true, role: true },
    });
  }

  async banUser(userId: string, reason: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { banned: true, banReason: reason },
      select: { id: true, name: true, banned: true, banReason: true },
    });
  }

  async unbanUser(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { banned: false, banReason: null, banExpires: null },
      select: { id: true, name: true, banned: true },
    });
  }
}
