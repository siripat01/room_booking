import type { Prisma } from "../../generated/prisma/client";
import {
  bangkokDateAsUtcDate,
  getBangkokDateTime,
  parseClockMinutes,
} from "../lib/bangkok-time";
import { BookingPolicyError } from "./booking.errors";

const ACTIVE_BOOKING_STATUSES = ["PENDING", "CONFIRMED", "CHECKED_IN"] as const;
const MILLIS_PER_DAY = 24 * 60 * 60 * 1000;

type PolicyClient = Pick<
  Prisma.TransactionClient,
  "booking" | "room" | "roomClosure" | "timeSlot" | "user"
>;

export type BookingPolicyInput = {
  userId: string;
  roomId: string;
  startTime: Date;
  endTime: Date;
  attendees: number;
  userRole?: string;
  excludeBookingId?: string;
  allowRoomConflict?: boolean;
};

export type BookingPolicyConfig = {
  maxDurationMinutes: number;
  freeAdvanceDays: number;
  proAdvanceDays: number;
  userActiveLimit: number;
  teacherActiveLimit: number;
  proActiveLimit: number;
};

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function bookingPolicyConfigFromEnv(): BookingPolicyConfig {
  return {
    maxDurationMinutes: positiveInteger(process.env.BOOKING_MAX_DURATION_MINUTES, 240),
    freeAdvanceDays: positiveInteger(process.env.BOOKING_FREE_ADVANCE_DAYS, 3),
    proAdvanceDays: positiveInteger(process.env.BOOKING_PRO_ADVANCE_DAYS, 30),
    userActiveLimit: positiveInteger(process.env.BOOKING_USER_ACTIVE_LIMIT, 3),
    teacherActiveLimit: positiveInteger(process.env.BOOKING_TEACHER_ACTIVE_LIMIT, 5),
    proActiveLimit: positiveInteger(process.env.BOOKING_PRO_ACTIVE_LIMIT, 10),
  };
}

export class BookingPolicyService {
  constructor(
    private readonly config: BookingPolicyConfig = bookingPolicyConfigFromEnv(),
    private readonly now: () => Date = () => new Date(),
  ) {}

  async validateCreate(client: PolicyClient, input: BookingPolicyInput) {
    this.validateTimeRange(input);

    const [room, user] = await Promise.all([
      client.room.findUnique({
        where: { id: input.roomId },
        select: { id: true, name: true, isActive: true, capacity: true, allowedRoles: true, autoApprove: true },
      }),
      client.user.findUnique({
        where: { id: input.userId },
        select: { id: true, role: true, plan: true, email: true, name: true, lineNotifyToken: true },
      }),
    ]);

    if (!room) throw new BookingPolicyError("ROOM_NOT_FOUND", "Room not found");
    if (!room.isActive) throw new BookingPolicyError("ROOM_INACTIVE", "Room is not active");
    if (!user) throw new BookingPolicyError("USER_NOT_FOUND", "User not found");
    if (input.attendees > room.capacity) {
      throw new BookingPolicyError("CAPACITY_EXCEEDED", `Room capacity is ${room.capacity}`, {
        capacity: room.capacity,
        attendees: input.attendees,
      });
    }

    // Database role is authoritative; the caller value only supports legacy rows
    // whose Better Auth role has not been populated yet.
    const userRole = user.role ?? input.userRole ?? "userRole";
    if (room.allowedRoles.length > 0 && !room.allowedRoles.includes(userRole)) {
      throw new BookingPolicyError("ROLE_NOT_ALLOWED", "Your role is not allowed to book this room");
    }

    await this.validateOpeningHoursAndClosures(client, input);
    const conflicts = await this.validateLimitsAndConflicts(client, input, userRole, user.plan);

    return { room, user, userRole, ...conflicts };
  }

  private validateTimeRange(input: BookingPolicyInput) {
    const start = input.startTime.getTime();
    const end = input.endTime.getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end || !Number.isInteger(input.attendees) || input.attendees < 1) {
      throw new BookingPolicyError("INVALID_TIME_RANGE", "Booking requires a valid time range and at least one attendee");
    }
    if (start < this.now().getTime()) {
      throw new BookingPolicyError("START_TIME_IN_PAST", "Cannot book a room in the past");
    }

    const durationMinutes = (end - start) / 60_000;
    if (durationMinutes > this.config.maxDurationMinutes) {
      throw new BookingPolicyError(
        "DURATION_LIMIT_EXCEEDED",
        `Booking duration cannot exceed ${this.config.maxDurationMinutes} minutes`,
        { maxDurationMinutes: this.config.maxDurationMinutes },
      );
    }
  }

  private async validateOpeningHoursAndClosures(client: PolicyClient, input: BookingPolicyInput) {
    const start = getBangkokDateTime(input.startTime);
    const end = getBangkokDateTime(input.endTime);
    if (start.date !== end.date) {
      throw new BookingPolicyError("OUTSIDE_OPENING_HOURS", "Booking must start and end on the same Bangkok calendar day");
    }

    const slot = await client.timeSlot.findFirst({
      where: { roomId: input.roomId, dayOfWeek: start.dayOfWeek, isActive: true },
      select: { openTime: true, closeTime: true },
    });
    if (!slot) {
      throw new BookingPolicyError("OUTSIDE_OPENING_HOURS", "Room is closed on this day");
    }

    const opensAt = parseClockMinutes(slot.openTime);
    const closesAt = parseClockMinutes(slot.closeTime, { allowEndOfDay: true });
    const endMinute = end.minutesSinceMidnight + (end.second > 0 ? 1 : 0);
    if (start.minutesSinceMidnight < opensAt || endMinute > closesAt) {
      throw new BookingPolicyError("OUTSIDE_OPENING_HOURS", `Room is open from ${slot.openTime} to ${slot.closeTime}`);
    }

    const closures = await client.roomClosure.findMany({
      where: { roomId: input.roomId, date: bangkokDateAsUtcDate(start.date) },
      select: { allDay: true, startTime: true, endTime: true, reason: true },
    });

    for (const closure of closures) {
      if (closure.allDay) {
        throw new BookingPolicyError("ROOM_CLOSED", closure.reason ? `Room is closed: ${closure.reason}` : "Room is closed");
      }
      if (!closure.startTime || !closure.endTime) {
        throw new BookingPolicyError("ROOM_CLOSED", "Room has an invalid partial closure and is unavailable");
      }
      const closureStart = parseClockMinutes(closure.startTime);
      const closureEnd = parseClockMinutes(closure.endTime, { allowEndOfDay: true });
      if (start.minutesSinceMidnight < closureEnd && endMinute > closureStart) {
        throw new BookingPolicyError("ROOM_CLOSED", closure.reason ? `Room is closed: ${closure.reason}` : "Room is closed during this time");
      }
    }
  }

  private async validateLimitsAndConflicts(
    client: PolicyClient,
    input: BookingPolicyInput,
    userRole: string,
    plan: string,
  ) {
    const isAdmin = userRole === "adminRole";
    const isPro = plan === "PRO";
    const now = this.now();

    if (!isAdmin) {
      const advanceDays = isPro ? this.config.proAdvanceDays : this.config.freeAdvanceDays;
      if (input.startTime.getTime() > now.getTime() + advanceDays * MILLIS_PER_DAY) {
        throw new BookingPolicyError(
          "ADVANCE_LIMIT_EXCEEDED",
          `Booking cannot be made more than ${advanceDays} days in advance`,
          { advanceDays },
        );
      }
    }

    const exclusion = input.excludeBookingId ? { id: { not: input.excludeBookingId } } : {};
    const [activeCount, userConflict, roomConflict] = await Promise.all([
      isAdmin
        ? Promise.resolve(0)
        : client.booking.count({
            where: { userId: input.userId, status: { in: [...ACTIVE_BOOKING_STATUSES] }, ...exclusion },
          }),
      client.booking.findFirst({
        where: {
          userId: input.userId,
          status: { in: [...ACTIVE_BOOKING_STATUSES] },
          startTime: { lt: input.endTime },
          endTime: { gt: input.startTime },
          ...exclusion,
        },
        select: { id: true },
      }),
      client.booking.findFirst({
        where: {
          roomId: input.roomId,
          status: { in: [...ACTIVE_BOOKING_STATUSES] },
          startTime: { lt: input.endTime },
          endTime: { gt: input.startTime },
          ...exclusion,
        },
        select: { id: true },
      }),
    ]);

    if (userConflict) {
      throw new BookingPolicyError("USER_OVERLAP", "You already have an active booking overlapping this time", {
        conflictingBookingId: userConflict.id,
      });
    }
    if (roomConflict && !input.allowRoomConflict) {
      throw new BookingPolicyError("ROOM_OVERLAP", "Room already has a booking overlapping this time slot", {
        conflictingBookingId: roomConflict.id,
      });
    }

    if (!isAdmin) {
      const activeLimit = isPro
        ? this.config.proActiveLimit
        : userRole === "teacherRole"
          ? this.config.teacherActiveLimit
          : this.config.userActiveLimit;
      if (activeCount >= activeLimit) {
        throw new BookingPolicyError("ACTIVE_LIMIT_EXCEEDED", `Active booking limit of ${activeLimit} reached`, {
          activeLimit,
          activeCount,
        });
      }
    }

    return { roomConflict };
  }
}
