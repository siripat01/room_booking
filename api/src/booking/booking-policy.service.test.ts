import { describe, expect, test } from "bun:test";
import { BookingPolicyService, type BookingPolicyConfig } from "./booking-policy.service";

const NOW = new Date("2026-08-19T00:00:00.000Z");
const START = new Date("2026-08-19T03:00:00.000Z"); // 10:00 Asia/Bangkok
const END = new Date("2026-08-19T04:00:00.000Z"); // 11:00 Asia/Bangkok

const CONFIG: BookingPolicyConfig = {
  maxDurationMinutes: 240,
  freeAdvanceDays: 3,
  proAdvanceDays: 30,
  userActiveLimit: 3,
  teacherActiveLimit: 5,
  proActiveLimit: 10,
};

function repository(overrides: {
  room?: Record<string, unknown> | null;
  user?: Record<string, unknown> | null;
  slot?: Record<string, unknown> | null;
  closures?: Record<string, unknown>[];
  userConflict?: { id: string } | null;
  roomConflict?: { id: string } | null;
  activeCount?: number;
} = {}) {
  return {
    room: {
      findUnique: async () => overrides.room === undefined
        ? { id: "room-1", name: "A101", isActive: true, capacity: 10, allowedRoles: [], autoApprove: false }
        : overrides.room,
    },
    user: {
      findUnique: async () => overrides.user === undefined
        ? { id: "user-1", role: "userRole", plan: "FREE", email: "user@example.com", name: "User", lineNotifyToken: null }
        : overrides.user,
    },
    timeSlot: {
      findFirst: async () => overrides.slot === undefined ? { openTime: "08:00", closeTime: "18:00" } : overrides.slot,
    },
    roomClosure: {
      findMany: async () => overrides.closures ?? [],
    },
    booking: {
      count: async () => overrides.activeCount ?? 0,
      findFirst: async ({ where }: any) => where.userId ? (overrides.userConflict ?? null) : (overrides.roomConflict ?? null),
    },
  } as any;
}

function input(overrides: Record<string, unknown> = {}) {
  return {
    userId: "user-1",
    roomId: "room-1",
    startTime: START,
    endTime: END,
    attendees: 5,
    userRole: "userRole",
    ...overrides,
  } as any;
}

describe("BookingPolicyService", () => {
  const policy = new BookingPolicyService(CONFIG, () => NOW);

  test("accepts a valid Bangkok opening-hours booking", async () => {
    await expect(policy.validateCreate(repository(), input())).resolves.toMatchObject({
      room: { id: "room-1" },
      user: { id: "user-1" },
    });
  });

  test("rejects an invalid time range", async () => {
    await expect(policy.validateCreate(repository(), input({ endTime: START }))).rejects.toMatchObject({
      code: "INVALID_TIME_RANGE",
    });
  });

  test("rejects attendee count above room capacity", async () => {
    await expect(policy.validateCreate(repository(), input({ attendees: 11 }))).rejects.toMatchObject({
      code: "CAPACITY_EXCEEDED",
    });
  });

  test("rejects a booking outside the room TimeSlot", async () => {
    await expect(policy.validateCreate(repository({ slot: { openTime: "11:00", closeTime: "18:00" } }), input())).rejects.toMatchObject({
      code: "OUTSIDE_OPENING_HOURS",
    });
  });

  test("rejects an overlapping partial room closure", async () => {
    await expect(policy.validateCreate(repository({
      closures: [{ allDay: false, startTime: "10:30", endTime: "12:00", reason: "Maintenance" }],
    }), input())).rejects.toMatchObject({ code: "ROOM_CLOSED" });
  });

  test("rejects an overlapping active booking for the user", async () => {
    await expect(policy.validateCreate(repository({ userConflict: { id: "user-conflict" } }), input())).rejects.toMatchObject({
      code: "USER_OVERLAP",
    });
  });

  test("rejects an overlapping active booking for the room", async () => {
    await expect(policy.validateCreate(repository({ roomConflict: { id: "room-conflict" } }), input())).rejects.toMatchObject({
      code: "ROOM_OVERLAP",
    });
  });

  test("rejects inactive rooms and excessive duration", async () => {
    await expect(policy.validateCreate(repository({
      room: { id: "room-1", name: "A101", isActive: false, capacity: 10, allowedRoles: [], autoApprove: false },
    }), input())).rejects.toMatchObject({ code: "ROOM_INACTIVE" });

    await expect(policy.validateCreate(repository(), input({
      endTime: new Date("2026-08-19T08:00:01.000Z"),
    }))).rejects.toMatchObject({ code: "DURATION_LIMIT_EXCEEDED" });
  });

  test("rejects missing rooms and disallowed roles", async () => {
    await expect(policy.validateCreate(repository({ room: null }), input())).rejects.toMatchObject({
      code: "ROOM_NOT_FOUND",
    });

    await expect(policy.validateCreate(repository({
      room: { id: "room-1", name: "A101", isActive: true, capacity: 10, allowedRoles: ["teacherRole"], autoApprove: false },
    }), input())).rejects.toMatchObject({ code: "ROLE_NOT_ALLOWED" });
  });

  test("rejects past, advance-limit, and active-limit violations", async () => {
    await expect(policy.validateCreate(repository(), input({
      startTime: new Date("2026-08-18T03:00:00.000Z"),
      endTime: new Date("2026-08-18T04:00:00.000Z"),
    }))).rejects.toMatchObject({ code: "START_TIME_IN_PAST" });

    await expect(policy.validateCreate(repository(), input({
      startTime: new Date("2026-08-23T03:00:00.000Z"),
      endTime: new Date("2026-08-23T04:00:00.000Z"),
    }))).rejects.toMatchObject({ code: "ADVANCE_LIMIT_EXCEEDED" });

    await expect(policy.validateCreate(repository({ activeCount: 3 }), input())).rejects.toMatchObject({
      code: "ACTIVE_LIMIT_EXCEEDED",
    });
  });

  test("rejects full-day closures", async () => {
    await expect(policy.validateCreate(repository({
      closures: [{ allDay: true, startTime: null, endTime: null, reason: "Holiday" }],
    }), input())).rejects.toMatchObject({ code: "ROOM_CLOSED" });
  });
});
