import { afterAll, expect, test } from "bun:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";
import { RealtimeEventService } from "../../src/realtime/realtime-event.service";

const connectionString = process.env.TEST_DATABASE_URL;
const integrationTest = connectionString ? test : test.skip;
const prisma = connectionString
  ? new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
  : null;
const suffix = crypto.randomUUID();
const auditId = crypto.randomUUID();
const roomId = `realtime-room-${suffix}`;

afterAll(async () => {
  if (!prisma) return;
  await prisma.auditLog.deleteMany({ where: { id: auditId } });
  await prisma.$disconnect();
});

integrationTest("room-scoped SSE emits a safe database-backed booking event", async () => {
  if (!prisma) throw new Error("TEST_DATABASE_URL is required");
  const cursorTime = new Date(Date.now() - 1_000);
  await prisma.auditLog.create({
    data: {
      id: auditId,
      actorType: "SYSTEM",
      targetType: "BOOKING",
      targetId: `booking-${suffix}`,
      bookingId: `booking-${suffix}`,
      roomId,
      eventType: "APPROVED",
      previousStatus: "PENDING",
      newStatus: "CONFIRMED",
      metadata: { privateNote: "must-not-be-streamed" },
    },
  });

  const abort = new AbortController();
  const request = new Request("http://roomflow.test/api/realtime/events", { signal: abort.signal });
  const response = new RealtimeEventService(prisma).stream(
    { roomId },
    request,
    `${cursorTime.toISOString()}_cursor`,
  );
  expect(response.headers.get("content-type")).toBe("text/event-stream");

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let output = "";
  for (let index = 0; index < 8 && !output.includes("booking.approved"); index += 1) {
    const result = await reader.read();
    if (result.done) break;
    output += decoder.decode(result.value);
  }
  abort.abort();
  await reader.cancel();

  expect(output).toContain("booking.approved");
  expect(output).toContain("CONFIRMED");
  expect(output).not.toContain("privateNote");
  expect(output).not.toContain("must-not-be-streamed");
});
