import type { PrismaClient } from "../../generated/prisma/client";

const USER_SELECT = {
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
};

function withoutQrTokenHash<T extends { qrTokenHash: string | null }>(booking: T) {
  const { qrTokenHash: _qrTokenHash, ...safeBooking } = booking;
  return safeBooking;
}

export class UserService {
  constructor(private readonly prisma: PrismaClient) {}

  private async assertHumanUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { isSystem: true } });
    if (!user || user.isSystem) throw new Error("User not found");
  }

  async getUsers(params?: { search?: string; role?: string; isBanned?: boolean; page?: number; limit?: number }) {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = { isSystem: false };
    if (params?.search) {
      where.OR = [
        { name: { contains: params.search, mode: "insensitive" } },
        { email: { contains: params.search, mode: "insensitive" } },
      ];
    }
    if (params?.role) where.role = params.role;
    if (params?.isBanned !== undefined) where.banned = params.isBanned;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({ where, select: USER_SELECT, orderBy: { createdAt: "desc" }, skip, take: limit }),
      this.prisma.user.count({ where }),
    ]);

    return { users, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getUserById(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, isSystem: false },
      select: { ...USER_SELECT, updatedAt: true },
    });
    if (!user) throw new Error("User not found");
    return user;
  }

  async updateUser(id: string, data: { name?: string; image?: string }) {
    await this.assertHumanUser(id);
    return this.prisma.user.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, image: true, role: true },
    });
  }

  async deleteUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, isSystem: true, _count: { select: { bookings: true } } },
    });
    if (!user || user.isSystem) throw new Error("User not found");
    if (user._count.bookings > 0) {
      throw new Error("Cannot delete a user with booking history; ban the account instead");
    }
    await this.prisma.user.delete({ where: { id } });
    return { success: true };
  }

  async getUserBookings(id: string, params?: { page?: number; limit?: number }) {
    await this.assertHumanUser(id);
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    const skip = (page - 1) * limit;

    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
        where: { userId: id },
        include: { room: { select: { name: true, floor: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.booking.count({ where: { userId: id } }),
    ]);

    return {
      bookings: bookings.map(withoutQrTokenHash),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateUserRole(userId: string, role: string) {
    const allowed = ["userRole", "teacherRole", "adminRole"];
    if (!allowed.includes(role)) throw new Error("Invalid role");
    await this.assertHumanUser(userId);

    return this.prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, name: true, email: true, role: true },
    });
  }

  async banUser(userId: string, reason: string) {
    await this.assertHumanUser(userId);
    return this.prisma.user.update({
      where: { id: userId },
      data: { banned: true, banReason: reason },
      select: { id: true, name: true, banned: true, banReason: true },
    });
  }

  async unbanUser(userId: string) {
    await this.assertHumanUser(userId);
    return this.prisma.user.update({
      where: { id: userId },
      data: { banned: false, banReason: null, banExpires: null },
      select: { id: true, name: true, banned: true },
    });
  }
}
