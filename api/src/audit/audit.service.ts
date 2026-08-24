import type { Prisma } from "../../generated/prisma/client";

const MAX_METADATA_DEPTH = 4;
const MAX_METADATA_KEYS = 50;
const MAX_METADATA_STRING_LENGTH = 500;
const SENSITIVE_METADATA_KEYS = new Set([
  "authorization",
  "cookie",
  "setcookie",
  "password",
  "secret",
  "apikey",
  "accesstoken",
  "refreshtoken",
  "idtoken",
  "qrtoken",
  "qrtokenhash",
  "devicekey",
  "devicekeyhash",
  "pairingcode",
  "codehash",
  "linechannelaccesstoken",
  "linechannelsecret",
  "stripewebhooksecret",
]);

function normalizedKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function sanitizeValue(value: unknown, depth: number): unknown {
  if (depth > MAX_METADATA_DEPTH) return "[truncated]";
  if (typeof value === "string") return value.slice(0, MAX_METADATA_STRING_LENGTH);
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value)) {
    return value.slice(0, MAX_METADATA_KEYS).map((item) => sanitizeValue(item, depth + 1));
  }
  if (typeof value !== "object" || !value) return String(value).slice(0, MAX_METADATA_STRING_LENGTH);

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !SENSITIVE_METADATA_KEYS.has(normalizedKey(key)))
      .slice(0, MAX_METADATA_KEYS)
      .map(([key, item]) => [key, sanitizeValue(item, depth + 1)]),
  );
}

export function sanitizeAuditMetadata(metadata?: Prisma.InputJsonObject) {
  if (!metadata) return undefined;
  return sanitizeValue(metadata, 0) as Prisma.InputJsonObject;
}

export type AuditActor = {
  type: "USER" | "ADMIN" | "DEVICE" | "SYSTEM";
  id?: string;
  correlationId?: string;
};

export type AuditRecord = {
  actor: AuditActor;
  targetType: "BOOKING" | "BOOKING_SERIES" | "DEVICE" | "ROOM" | "JOB" | "WAITLIST";
  targetId: string;
  eventType: string;
  sourceEventId?: string;
  bookingId?: string;
  deviceId?: string;
  roomId?: string;
  previousStatus?: string | null;
  newStatus?: string | null;
  metadata?: Prisma.InputJsonObject;
  createdAt?: Date;
};

export class AuditService {
  async record(tx: Prisma.TransactionClient, event: AuditRecord) {
    return tx.auditLog.create({
      data: {
        sourceEventId: event.sourceEventId,
        actorType: event.actor.type,
        actorId: event.actor.id,
        targetType: event.targetType,
        targetId: event.targetId,
        bookingId: event.bookingId,
        deviceId: event.deviceId,
        roomId: event.roomId,
        eventType: event.eventType,
        previousStatus: event.previousStatus,
        newStatus: event.newStatus,
        metadata: sanitizeAuditMetadata(event.metadata),
        correlationId: event.actor.correlationId,
        createdAt: event.createdAt,
      },
    });
  }
}
