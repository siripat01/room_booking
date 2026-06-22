import type { PrismaClient } from "../../generated/prisma/client";
import prisma from "../../libs/db";
import { randomBytes } from "crypto";

export class BookingService {
  constructor(private readonly prisma: PrismaClient) {}

  async createBooking(data: {
    userId: string;
    roomId: string;
    startTime: Date;
    endTime: Date;
    attendees: number;
    purpose?: string;
    autoConfirm: boolean;
    approvedBy?: string;
    userRole?: string;
  }) {
    if (data.startTime < new Date()) throw new Error("Cannot book a room in the past");

    // Check room's allowed roles
    const room = await this.prisma.room.findUnique({ where: { id: data.roomId }, select: { allowedRoles: true } });
    if (room && room.allowedRoles.length > 0 && data.userRole && !room.allowedRoles.includes(data.userRole)) {
      throw new Error("คุณไม่มีสิทธิ์จองห้องนี้");
    }

    // Booking limit check (skip for adminRole)
    if (data.userRole !== "adminRole") {
      const activeLimit = data.userRole === "teacherRole" ? 5 : 3;
      const activeCount = await this.prisma.booking.count({
        where: { userId: data.userId, status: { in: ["PENDING", "CONFIRMED"] } },
      });
      if (activeCount >= activeLimit) {
        throw new Error(
          `คุณมีการจองที่ยังไม่เสร็จสิ้น ${activeCount} รายการ (สูงสุด ${activeLimit} รายการ) กรุณารอให้การจองก่อนหน้าสิ้นสุดก่อน`,
        );
      }
    }

    // Race-condition-safe conflict check inside a serializable transaction
    return this.prisma.$transaction(
      async (tx) => {
        const conflict = await tx.booking.findFirst({
          where: {
            roomId: data.roomId,
            status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] },
            AND: [{ startTime: { lt: data.endTime } }, { endTime: { gt: data.startTime } }],
          },
        });
        if (conflict) throw new Error("Room already has a booking overlapping this time slot");

        return tx.booking.create({
          data: {
            userId: data.userId,
            roomId: data.roomId,
            startTime: data.startTime,
            endTime: data.endTime,
            attendees: data.attendees,
            purpose: data.purpose,
            status: data.autoConfirm ? "CONFIRMED" : "PENDING",
            approvedAt: data.autoConfirm ? new Date() : undefined,
            approvedBy: data.autoConfirm ? (data.approvedBy ?? data.userId) : undefined,
          },
          include: {
            room: { select: { name: true, floor: true } },
            user: { select: { name: true, email: true } },
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
  }

  private async expireStaleBookings() {
    await this.prisma.booking.updateMany({
      where: { status: "CONFIRMED", endTime: { lt: new Date() } },
      data: { status: "EXPIRED" },
    });
  }

  async getBookings(userId: string, role: string, params?: { status?: string; roomId?: string; userId?: string; date?: string; page?: number; limit?: number; forSelf?: boolean }) {
    await this.expireStaleBookings();
    const isAdmin = role === "adminRole";
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    const skip = (page - 1) * limit;

    // forSelf=true forces filtering by current user regardless of role (used by My Bookings page)
    const where: any = (isAdmin && !params?.forSelf) ? {} : { userId };
    if (params?.status) where.status = params.status;
    if (params?.roomId) where.roomId = params.roomId;
    if (isAdmin && params?.userId) where.userId = params.userId;
    if (params?.date) {
      const start = new Date(`${params.date}T00:00:00.000Z`);
      const end = new Date(`${params.date}T23:59:59.999Z`);
      where.startTime = { gte: start, lte: end };
    }

    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        include: {
          room: { select: { name: true, floor: true } },
          user: { select: { name: true, email: true, image: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.booking.count({ where }),
    ]);

    return { bookings, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getBookingById(id: string, userId: string, role: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        room: true,
        user: { select: { name: true, email: true, image: true } },
      },
    });
    if (!booking) throw new Error("Booking not found");
    if (role !== "adminRole" && booking.userId !== userId) throw new Error("Unauthorized");
    return booking;
  }

  async cancelBooking(id: string, userId: string, role: string, cancelReason?: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id } });
    if (!booking) throw new Error("Booking not found");
    if (role !== "adminRole" && booking.userId !== userId) throw new Error("Unauthorized");
    if (!["PENDING", "CONFIRMED"].includes(booking.status))
      throw new Error("Cannot cancel this booking");

    return this.prisma.booking.update({
      where: { id },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason },
    });
  }

  async approveBooking(id: string, adminId: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id } });
    if (!booking) throw new Error("Booking not found");
    if (booking.status !== "PENDING") throw new Error("Only pending bookings can be approved");

    return this.prisma.booking.update({
      where: { id },
      data: { status: "CONFIRMED", approvedAt: new Date(), approvedBy: adminId },
      include: {
        room: { select: { name: true, floor: true } },
        user: { select: { name: true, email: true } },
      },
    });
  }

  async rejectBooking(id: string, adminId: string, reason: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id } });
    if (!booking) throw new Error("Booking not found");
    if (booking.status !== "PENDING") throw new Error("Only pending bookings can be rejected");

    return this.prisma.booking.update({
      where: { id },
      data: { status: "REJECTED", rejectedReason: reason },
      include: {
        room: { select: { name: true, floor: true } },
        user: { select: { name: true, email: true } },
      },
    });
  }

  async forceDeleteBooking(id: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id } });
    if (!booking) throw new Error("Booking not found");
    await this.prisma.booking.delete({ where: { id } });
    return { success: true };
  }

  async generateQr(id: string, userId: string, role: string) {
    await this.expireStaleBookings();
    const booking = await this.prisma.booking.findUnique({ where: { id } });
    if (!booking) throw new Error("Booking not found");
    if (role !== "adminRole" && booking.userId !== userId) throw new Error("Unauthorized");
    if (booking.status !== "CONFIRMED") throw new Error("Only confirmed bookings can generate a QR code");
    if (booking.endTime < new Date()) throw new Error("Booking time has already passed");

    const qrToken = randomBytes(32).toString("hex");
    const qrExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await this.prisma.booking.update({
      where: { id },
      data: { qrToken, qrExpiresAt },
    });

    return { qrToken, expiresAt: qrExpiresAt };
  }

  async checkIn(id: string, qrToken: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id } });
    if (!booking) throw new Error("Booking not found");
    if (booking.status !== "CONFIRMED") throw new Error("Booking is not confirmed");
    if (booking.qrToken !== qrToken) throw new Error("Invalid QR token");
    if (!booking.qrExpiresAt || booking.qrExpiresAt < new Date()) throw new Error("QR token has expired");

    return this.prisma.booking.update({
      where: { id },
      data: {
        status: "CHECKED_IN",
        checkedInAt: new Date(),
        qrToken: null,
        qrExpiresAt: null,
      },
      include: {
        room: { select: { name: true, floor: true } },
        user: { select: { name: true, email: true } },
      },
    });
  }

  async checkOut(id: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id } });
    if (!booking) throw new Error("Booking not found");
    if (booking.status !== "CHECKED_IN") throw new Error("Booking is not checked in");

    return this.prisma.booking.update({
      where: { id },
      data: { status: "COMPLETED", checkedOutAt: new Date() },
      include: {
        room: { select: { name: true, floor: true } },
        user: { select: { name: true, email: true } },
      },
    });
  }

  async getStats() {
    const [totalRooms, pendingBookings, totalUsers, confirmedToday] = await Promise.all([
      this.prisma.room.count({ where: { isActive: true } }),
      this.prisma.booking.count({ where: { status: "PENDING" } }),
      this.prisma.user.count(),
      this.prisma.booking.count({
        where: {
          status: "CONFIRMED",
          startTime: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
    ]);
    return { totalRooms, pendingBookings, totalUsers, confirmedToday };
  }
}
