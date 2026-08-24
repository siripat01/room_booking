import { afterAll, beforeAll, expect, mock, test } from "bun:test";
import { PrismaPg } from "@prisma/adapter-pg";
import Elysia from "elysia";
import { PrismaClient } from "../../generated/prisma/client";

mock.module("../../src/middleware/auth.middleware", () => ({
  betterAuth: new Elysia({ name: "test-auth" }).macro({
    auth: {
      resolve({ request, status }) {
        const id = request.headers.get("x-test-user-id");
        if (!id) return status(401);
        return {
          user: {
            id,
            role: request.headers.get("x-test-user-role") ?? "userRole",
            name: "Route Test User",
            email: `${id}@example.com`,
          },
          session: { id: `session-${id}` },
        };
      },
    },
  }),
}));

const connectionString = process.env.TEST_DATABASE_URL;
const integrationTest = connectionString ? test : test.skip;
const prisma = connectionString
  ? new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
  : null;

const suffix = crypto.randomUUID();
const ownerId = `route-owner-${suffix}`;
const outsiderId = `route-outsider-${suffix}`;
const adminId = `route-admin-${suffix}`;
const roomId = `route-room-${suffix}`;
const bookingId = `route-booking-${suffix}`;
let app: { handle(request: Request): Response | Promise<Response> };

function request(path: string, userId: string, role: string, init?: RequestInit) {
  return new Request(`http://roomflow.test${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-test-user-id": userId,
      "x-test-user-role": role,
      ...init?.headers,
    },
  });
}

beforeAll(async () => {
  if (!prisma) return;
  const [{ default: bookingRoutes }, { jobHealthRoutes }] = await Promise.all([
    import("../../src/booking/booking.route"),
    import("../../src/jobs/job-health.route"),
  ]);
  app = new Elysia().use(bookingRoutes).use(jobHealthRoutes);
  await prisma.user.createMany({
    data: [
      { id: ownerId, name: "Route Owner", email: `${ownerId}@example.com`, role: "userRole" },
      {
        id: outsiderId,
        name: "Route Outsider",
        email: `${outsiderId}@example.com`,
        role: "userRole",
      },
      { id: adminId, name: "Route Admin", email: `${adminId}@example.com`, role: "adminRole" },
    ],
  });
  await prisma.room.create({
    data: { id: roomId, name: "Route RBAC Room", floor: "TEST", capacity: 8 },
  });
  await prisma.booking.create({
    data: {
      id: bookingId,
      userId: ownerId,
      roomId,
      startTime: new Date("2099-09-01T03:00:00.000Z"),
      endTime: new Date("2099-09-01T04:00:00.000Z"),
      attendees: 2,
      status: "PENDING",
      qrTokenHash: "b".repeat(64),
    },
  });
  await prisma.auditLog.create({
    data: {
      actorType: "USER",
      actorId: ownerId,
      targetType: "BOOKING",
      targetId: bookingId,
      bookingId,
      roomId,
      eventType: "CREATED",
      newStatus: "PENDING",
    },
  });
});

afterAll(async () => {
  if (!prisma) return;
  await prisma.notificationJob.deleteMany({
    where: { userId: { in: [ownerId, outsiderId, adminId] } },
  });
  await prisma.auditLog.deleteMany({ where: { bookingId } });
  await prisma.booking.deleteMany({ where: { id: bookingId } });
  await prisma.room.deleteMany({ where: { id: roomId } });
  await prisma.user.deleteMany({ where: { id: { in: [ownerId, outsiderId, adminId] } } });
  await prisma.$disconnect();
});

integrationTest(
  "booking detail returns 403 to an authenticated non-owner and hides credentials from the owner",
  async () => {
    const denied = await app.handle(request(`/bookings/${bookingId}`, outsiderId, "userRole"));
    expect(denied.status).toBe(403);

    const allowed = await app.handle(request(`/bookings/${bookingId}`, ownerId, "userRole"));
    expect(allowed.status).toBe(200);
    const body = (await allowed.json()) as Record<string, unknown>;
    expect(body.id).toBe(bookingId);
    expect(body.qrTokenHash).toBeUndefined();
    expect(body.events).toBeUndefined();
  },
);

integrationTest(
  "booking timeline and operational job health are admin-only over HTTP",
  async () => {
    const timelineDenied = await app.handle(
      request(`/bookings/${bookingId}/timeline`, ownerId, "userRole"),
    );
    expect(timelineDenied.status).toBe(403);
    const timelineAllowed = await app.handle(
      request(`/bookings/${bookingId}/timeline`, adminId, "adminRole"),
    );
    expect(timelineAllowed.status).toBe(200);
    expect((await timelineAllowed.json()) as unknown[]).toHaveLength(1);

    const healthDenied = await app.handle(request("/operations/jobs/health", ownerId, "userRole"));
    expect(healthDenied.status).toBe(403);
    const healthAllowed = await app.handle(
      request("/operations/jobs/health", adminId, "adminRole"),
    );
    expect(healthAllowed.status).toBe(200);
    expect(((await healthAllowed.json()) as { status: string }).status).toMatch(/healthy|degraded/);
  },
);

integrationTest(
  "booking cancellation cannot be performed by another authenticated user",
  async () => {
    const denied = await app.handle(
      request(`/bookings/${bookingId}/cancel`, outsiderId, "userRole", {
        method: "PATCH",
        body: JSON.stringify({ cancelReason: "Unauthorized attempt" }),
      }),
    );
    expect(denied.status).toBe(403);
    expect((await prisma!.booking.findUniqueOrThrow({ where: { id: bookingId } })).status).toBe(
      "PENDING",
    );
  },
);
