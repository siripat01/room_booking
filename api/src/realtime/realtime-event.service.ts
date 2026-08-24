import type { Prisma, PrismaClient } from "../../generated/prisma/client";
import { DEVICE_ONLINE_FRESHNESS_MS } from "../device/device.service";

type RealtimeScope = {
  userId?: string;
  admin?: boolean;
  roomId?: string;
  deviceId?: string;
};

type Cursor = { createdAt: Date; id: string };

const EVENT_NAMES: Record<string, string> = {
  CREATED: "booking.created",
  APPROVED: "booking.approved",
  REJECTED: "booking.rejected",
  CANCELLED: "booking.cancelled",
  CHECKED_IN: "booking.checked_in",
  COMPLETED: "booking.completed",
  EXPIRED: "booking.expired",
  ROOM_CREATED: "room.status_changed",
  ROOM_UPDATED: "room.status_changed",
  ROOM_ACTIVATED: "room.status_changed",
  ROOM_DEACTIVATED: "room.status_changed",
  ROOM_CLOSURE_CREATED: "room.closure_created",
  ROOM_CLOSURE_DELETED: "room.status_changed",
  ROOM_TIME_SLOTS_REPLACED: "room.status_changed",
  DEVICE_CREATED: "device.status_changed",
  DEVICE_UPDATED: "device.status_changed",
  DEVICE_REVOKED: "device.status_changed",
  DEVICE_REACTIVATED: "device.status_changed",
  DEVICE_DELETED: "device.status_changed",
  DEVICE_PAIRED: "device.status_changed",
};

function cursorValue(cursor: Cursor) {
  return `${cursor.createdAt.toISOString()}_${cursor.id}`;
}

function parseCursor(value: string | null | undefined): Cursor {
  if (value) {
    const separator = value.indexOf("_");
    const createdAt = new Date(value.slice(0, separator));
    const id = value.slice(separator + 1);
    if (separator > 0 && Number.isFinite(createdAt.getTime()) && id) return { createdAt, id };
  }
  // Replay a small overlap so an event committed between the initial page query
  // and opening the stream cannot be missed. Query invalidation is idempotent.
  return { createdAt: new Date(Date.now() - 5_000), id: "" };
}

function afterCursor(cursor: Cursor): Prisma.AuditLogWhereInput {
  return {
    OR: [
      { createdAt: { gt: cursor.createdAt } },
      { createdAt: cursor.createdAt, id: { gt: cursor.id } },
    ],
  };
}

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}

export class RealtimeEventService {
  constructor(private readonly prisma: PrismaClient) {}

  stream(scope: RealtimeScope, request: Request, suppliedCursor?: string | null) {
    const encoder = new TextEncoder();
    const pollMs = Math.max(1_000, Number(process.env.REALTIME_POLL_INTERVAL_MS) || 2_000);
    let cancelled = false;
    const service = this;

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        void (async () => {
          const send = (value: string) => {
            if (cancelled || request.signal.aborted) return false;
            try {
              controller.enqueue(encoder.encode(value));
              return true;
            } catch {
              cancelled = true;
              return false;
            }
          };
          let cursor = parseCursor(request.headers.get("last-event-id") ?? suppliedCursor);
          let deviceStatuses = new Map<string, string>();
          send("retry: 5000\n\n");
          send(`data: ${JSON.stringify({ type: "connected", timestamp: new Date().toISOString() })}\n\n`);

          while (!cancelled && !request.signal.aborted) {
            try {
              const batch = await service.readAfter(cursor, scope);
              if (cancelled || request.signal.aborted) break;
              cursor = batch.scannedCursor;
              for (const event of batch.events) {
                if (!send(`id: ${event.id}\ndata: ${JSON.stringify(event.data)}\n\n`)) break;
              }

              const currentStatuses = await service.deviceStatuses(scope);
              for (const [deviceId, status] of currentStatuses) {
                if (deviceStatuses.get(deviceId) === status) continue;
                send(`data: ${JSON.stringify({
                  type: "device.status_changed",
                  deviceId,
                  roomId: scope.roomId ?? null,
                  status,
                  timestamp: new Date().toISOString(),
                })}\n\n`);
              }
              deviceStatuses = currentStatuses;
              send(`: heartbeat ${new Date().toISOString()}\n\n`);
            } catch {
              send(`data: ${JSON.stringify({ type: "stream.degraded", timestamp: new Date().toISOString() })}\n\n`);
            }
            await sleep(pollMs, request.signal);
          }
          if (!cancelled) controller.close();
        })();
      },
      cancel() {
        cancelled = true;
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  }

  private async readAfter(cursor: Cursor, scope: RealtimeScope) {
    const rows = await this.prisma.auditLog.findMany({
      where: {
        ...afterCursor(cursor),
        eventType: { in: Object.keys(EVENT_NAMES) },
        ...(scope.roomId ? { roomId: scope.roomId } : {}),
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 100,
      select: {
        id: true,
        targetType: true,
        targetId: true,
        bookingId: true,
        deviceId: true,
        roomId: true,
        eventType: true,
        previousStatus: true,
        newStatus: true,
        createdAt: true,
      },
    });
    const lastRow = rows[rows.length - 1];
    const scannedCursor = lastRow
      ? { createdAt: lastRow.createdAt, id: lastRow.id }
      : cursor;

    let allowedBookingIds: Set<string> | undefined;
    let allowedSeriesIds: Set<string> | undefined;
    if (!scope.admin && !scope.roomId && scope.userId) {
      const bookingIds = rows.flatMap(({ bookingId }) => bookingId ? [bookingId] : []);
      const seriesIds = rows.filter(({ targetType }) => targetType === "BOOKING_SERIES").map(({ targetId }) => targetId);
      const [bookings, series] = await Promise.all([
        this.prisma.booking.findMany({
          where: { id: { in: bookingIds }, userId: scope.userId },
          select: { id: true },
        }),
        this.prisma.bookingSeries.findMany({
          where: { id: { in: seriesIds }, userId: scope.userId },
          select: { id: true },
        }),
      ]);
      allowedBookingIds = new Set(bookings.map(({ id }) => id));
      allowedSeriesIds = new Set(series.map(({ id }) => id));
    }

    const events = rows.flatMap((row) => {
      const type = EVENT_NAMES[row.eventType];
      if (!type) return [];
      if (scope.deviceId && row.deviceId && row.deviceId !== scope.deviceId) return [];
      if (!scope.admin && !scope.roomId) {
        const allowed =
          (row.bookingId && allowedBookingIds?.has(row.bookingId)) ||
          (row.targetType === "BOOKING_SERIES" && allowedSeriesIds?.has(row.targetId));
        if (!allowed) return [];
      }
      const eventCursor = { createdAt: row.createdAt, id: row.id };
      return [{
        id: cursorValue(eventCursor),
        data: {
          type,
          targetType: row.targetType,
          targetId: scope.roomId && !scope.admin ? null : row.targetId,
          roomId: row.roomId,
          previousStatus: row.previousStatus,
          newStatus: row.newStatus,
          timestamp: row.createdAt.toISOString(),
        },
      }];
    });
    return { scannedCursor, events };
  }

  private async deviceStatuses(scope: RealtimeScope) {
    if (!scope.admin && !scope.roomId && !scope.deviceId) return new Map<string, string>();
    const devices = await this.prisma.device.findMany({
      where: {
        ...(scope.deviceId ? { id: scope.deviceId } : {}),
        ...(scope.roomId ? { roomId: scope.roomId } : {}),
      },
      select: { id: true, isActive: true, revokedAt: true, lastSeenAt: true },
    });
    const now = Date.now();
    return new Map(devices.map((device) => {
      const status = !device.isActive || device.revokedAt
        ? "offline"
        : !device.lastSeenAt
          ? "unknown"
          : now - device.lastSeenAt.getTime() <= DEVICE_ONLINE_FRESHNESS_MS
            ? "online"
            : "offline";
      return [device.id, status];
    }));
  }
}
