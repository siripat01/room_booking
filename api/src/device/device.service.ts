import { randomUUID, timingSafeEqual } from "crypto";
import { Prisma, PrismaClient } from "../../generated/prisma/client";
import type { CreateDeviceInput, UpdateDeviceInput } from "../../type/device";
import { BookingService } from "../booking/booking.service";
import {
  CHECK_IN_EARLY_MINUTES,
  CHECK_IN_LATE_MINUTES,
  CheckInPolicyService,
} from "../check-in/check-in-policy.service";
import { bangkokDayBounds, getBangkokDateTime } from "../lib/bangkok-time";
import {
  generateOpaqueToken,
  generatePairingCode,
  hashOpaqueToken,
  hashPairingCode,
} from "../lib/opaque-token";
import { withSerializableRetry } from "../lib/transaction-retry";
import { AuditService, type AuditActor } from "../audit/audit.service";

export const DEVICE_ONLINE_FRESHNESS_MS = 90_000;
const PAIRING_CODE_TTL_MS = 10 * 60_000;

const SAFE_DEVICE_SELECT = {
  id: true,
  roomId: true,
  name: true,
  deviceKeyPrefix: true,
  credentialVersion: true,
  credentialRotatedAt: true,
  revokedAt: true,
  isActive: true,
  lastSeenAt: true,
  createdAt: true,
  updatedAt: true,
  room: {
    select: { id: true, name: true, floor: true, isActive: true, autoApprove: true },
  },
} satisfies Prisma.DeviceSelect;

export type AuthenticatedDevice = {
  id: string;
  roomId: string | null;
  walkInPrincipalId: string;
  isActive: boolean;
  revokedAt: Date | null;
  credentialVersion: number;
};

function generateDeviceCredential() {
  const deviceKey = generateOpaqueToken("dk_");
  return {
    deviceKey,
    deviceKeyHash: hashOpaqueToken(deviceKey),
    deviceKeyPrefix: deviceKey.slice(0, 11),
  };
}

function onlineStatus(lastSeenAt: Date | null, now = new Date()) {
  if (!lastSeenAt) return "unknown" as const;
  return now.getTime() - lastSeenAt.getTime() <= DEVICE_ONLINE_FRESHNESS_MS
    ? "online" as const
    : "offline" as const;
}

function withoutQrTokenHash<T extends { qrTokenHash: string | null }>(booking: T) {
  const { qrTokenHash: _qrTokenHash, ...safeBooking } = booking;
  return safeBooking;
}

function deviceLifecycleStatus(device: { isActive: boolean; revokedAt: Date | null }) {
  if (device.revokedAt) return "REVOKED";
  return device.isActive ? "ACTIVE" : "INACTIVE";
}

function safeDeviceAuditState(device: {
  name: string;
  roomId: string | null;
  isActive: boolean;
  revokedAt: Date | null;
  credentialVersion: number;
}) {
  return {
    name: device.name,
    roomId: device.roomId,
    isActive: device.isActive,
    revokedAt: device.revokedAt?.toISOString() ?? null,
    credentialVersion: device.credentialVersion,
  };
}

export class DeviceService {
  private readonly bookingService: BookingService;
  private readonly checkInPolicy = new CheckInPolicyService();
  private readonly audit = new AuditService();

  constructor(
    private readonly prisma: PrismaClient,
    private readonly pairingSecret = process.env.BETTER_AUTH_SECRET ?? "",
  ) {
    this.bookingService = new BookingService(prisma);
  }

  async createDevice(data: CreateDeviceInput, actor: AuditActor = { type: "SYSTEM" }) {
    const id = randomUUID();
    const walkInPrincipalId = `system:walk-in:${id}`;
    const credential = generateDeviceCredential();

    const device = await this.prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          id: walkInPrincipalId,
          name: `Walk-in via ${data.name}`,
          email: `walk-in+${id.replaceAll("-", "")}@roomflow.internal`,
          emailVerified: true,
          role: "userRole",
          isSystem: true,
        },
      });
      const created = await tx.device.create({
        data: {
          id,
          name: data.name,
          roomId: data.roomId ?? null,
          isActive: data.isActive ?? true,
          walkInPrincipalId,
          deviceKeyHash: credential.deviceKeyHash,
          deviceKeyPrefix: credential.deviceKeyPrefix,
          legacyDeviceKey: `migrated:${credential.deviceKeyHash.slice(0, 24)}`,
        },
        select: SAFE_DEVICE_SELECT,
      });
      await this.audit.record(tx, {
        actor,
        targetType: "DEVICE",
        targetId: created.id,
        deviceId: created.id,
        roomId: created.roomId ?? undefined,
        eventType: "DEVICE_CREATED",
        newStatus: created.isActive ? "ACTIVE" : "INACTIVE",
        metadata: { name: created.name, roomId: created.roomId },
      });
      return created;
    });

    return { device: { ...device, onlineStatus: onlineStatus(device.lastSeenAt) }, deviceKey: credential.deviceKey };
  }

  async getAllDevices(now = new Date()) {
    const devices = await this.prisma.device.findMany({
      select: SAFE_DEVICE_SELECT,
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return devices.map((device) => ({ ...device, onlineStatus: onlineStatus(device.lastSeenAt, now) }));
  }

  async getDeviceById(id: string, now = new Date()) {
    const device = await this.prisma.device.findUnique({ where: { id }, select: SAFE_DEVICE_SELECT });
    return device ? { ...device, onlineStatus: onlineStatus(device.lastSeenAt, now) } : null;
  }

  async updateDevice(id: string, data: UpdateDeviceInput, actor: AuditActor = { type: "SYSTEM" }) {
    const device = await this.prisma.$transaction(async (tx) => {
      const previous = await tx.device.findUniqueOrThrow({ where: { id }, select: SAFE_DEVICE_SELECT });
      const updated = await tx.device.update({ where: { id }, data, select: SAFE_DEVICE_SELECT });
      await this.audit.record(tx, {
        actor,
        targetType: "DEVICE",
        targetId: id,
        deviceId: id,
        roomId: updated.roomId ?? previous.roomId ?? undefined,
        eventType: "DEVICE_UPDATED",
        previousStatus: deviceLifecycleStatus(previous),
        newStatus: deviceLifecycleStatus(updated),
        metadata: {
          before: safeDeviceAuditState(previous),
          after: safeDeviceAuditState(updated),
        },
      });
      return updated;
    });
    return { ...device, onlineStatus: onlineStatus(device.lastSeenAt) };
  }

  async deleteDevice(id: string, actor: AuditActor = { type: "SYSTEM" }) {
    return this.prisma.$transaction(async (tx) => {
      const device = await tx.device.findUnique({
        where: { id },
        select: { walkInPrincipalId: true, name: true, roomId: true, isActive: true, revokedAt: true },
      });
      if (!device) throw new Error("Device not found");
      const [deviceEvents, walkInBookings] = await Promise.all([
        tx.bookingEvent.count({ where: { actorType: "DEVICE", actorId: id } }),
        tx.booking.count({ where: { userId: device.walkInPrincipalId } }),
      ]);
      if (deviceEvents > 0 || walkInBookings > 0) {
        throw new Error("Cannot delete a device with audit history; revoke it instead");
      }
      await tx.device.delete({ where: { id } });
      await tx.user.delete({ where: { id: device.walkInPrincipalId } });
      await this.audit.record(tx, {
        actor,
        targetType: "DEVICE",
        targetId: id,
        deviceId: id,
        roomId: device.roomId ?? undefined,
        eventType: "DEVICE_DELETED",
        previousStatus: deviceLifecycleStatus(device),
        newStatus: "DELETED",
        metadata: { name: device.name },
      });
      return { success: true };
    });
  }

  async rotateDeviceKey(id: string, actor: AuditActor = { type: "SYSTEM" }) {
    const credential = generateDeviceCredential();
    const device = await this.prisma.$transaction(async (tx) => {
      const previous = await tx.device.findUnique({
        where: { id },
        select: { credentialVersion: true, roomId: true },
      });
      const updated = await tx.device.updateMany({
        where: { id, revokedAt: null },
        data: {
          deviceKeyHash: credential.deviceKeyHash,
          deviceKeyPrefix: credential.deviceKeyPrefix,
          credentialVersion: { increment: 1 },
          credentialRotatedAt: new Date(),
        },
      });
      if (updated.count !== 1) {
        throw new Error("Device not found or revoked; reactivate it instead");
      }
      const current = await tx.device.findUniqueOrThrow({ where: { id }, select: SAFE_DEVICE_SELECT });
      await this.audit.record(tx, {
        actor,
        targetType: "DEVICE",
        targetId: id,
        deviceId: id,
        roomId: current.roomId ?? undefined,
        eventType: "DEVICE_CREDENTIAL_ROTATED",
        previousStatus: previous ? `VERSION_${previous.credentialVersion}` : undefined,
        newStatus: `VERSION_${current.credentialVersion}`,
      });
      return current;
    });
    return { device, deviceKey: credential.deviceKey };
  }

  async revokeDevice(id: string, actor: AuditActor = { type: "SYSTEM" }) {
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const previous = await tx.device.findUniqueOrThrow({ where: { id }, select: SAFE_DEVICE_SELECT });
      await tx.devicePairingCode.updateMany({
        where: { deviceId: id, consumedAt: null },
        data: { consumedAt: now },
      });
      const revoked = await tx.device.update({
        where: { id },
        data: { isActive: false, revokedAt: now },
        select: SAFE_DEVICE_SELECT,
      });
      await this.audit.record(tx, {
        actor,
        targetType: "DEVICE",
        targetId: id,
        deviceId: id,
        roomId: revoked.roomId ?? undefined,
        eventType: "DEVICE_REVOKED",
        previousStatus: deviceLifecycleStatus(previous),
        newStatus: "REVOKED",
      });
      return revoked;
    });
  }

  async reactivateDevice(id: string, actor: AuditActor = { type: "SYSTEM" }) {
    const credential = generateDeviceCredential();
    const device = await this.prisma.$transaction(async (tx) => {
      const previous = await tx.device.findUniqueOrThrow({ where: { id }, select: SAFE_DEVICE_SELECT });
      const reactivated = await tx.device.update({
        where: { id },
        data: {
          isActive: true,
          revokedAt: null,
          deviceKeyHash: credential.deviceKeyHash,
          deviceKeyPrefix: credential.deviceKeyPrefix,
          credentialVersion: { increment: 1 },
          credentialRotatedAt: new Date(),
        },
        select: SAFE_DEVICE_SELECT,
      });
      await this.audit.record(tx, {
        actor,
        targetType: "DEVICE",
        targetId: id,
        deviceId: id,
        roomId: reactivated.roomId ?? undefined,
        eventType: "DEVICE_REACTIVATED",
        previousStatus: deviceLifecycleStatus(previous),
        newStatus: "ACTIVE",
        metadata: {
          previousCredentialVersion: previous.credentialVersion,
          credentialVersion: reactivated.credentialVersion,
        },
      });
      return reactivated;
    });
    return { device, deviceKey: credential.deviceKey };
  }

  async authenticateDevice(id: string, deviceKey: string): Promise<AuthenticatedDevice | null> {
    if (!deviceKey.startsWith("dk_") || deviceKey.length > 128) return null;
    const device = await this.prisma.device.findUnique({
      where: { id },
      select: {
        id: true,
        roomId: true,
        walkInPrincipalId: true,
        isActive: true,
        revokedAt: true,
        credentialVersion: true,
        deviceKeyHash: true,
      },
    });
    if (!device || !device.isActive || device.revokedAt) return null;

    const expected = Buffer.from(device.deviceKeyHash, "hex");
    const provided = Buffer.from(hashOpaqueToken(deviceKey), "hex");
    if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return null;

    const { deviceKeyHash: _, ...authenticated } = device;
    return authenticated;
  }

  async heartbeat(device: AuthenticatedDevice) {
    const lastSeenAt = new Date();
    const updated = await this.prisma.device.updateMany({
      where: {
        id: device.id,
        isActive: true,
        revokedAt: null,
        credentialVersion: device.credentialVersion,
      },
      data: { lastSeenAt },
    });
    if (updated.count !== 1) throw new Error("Device credential is no longer current");
    return { id: device.id, lastSeenAt };
  }

  async getDeviceStatus(id: string, now = new Date()) {
    const device = await this.prisma.device.findUnique({ where: { id }, select: SAFE_DEVICE_SELECT });
    if (!device) throw new Error("Device not found");
    const safeDevice = { ...device, onlineStatus: onlineStatus(device.lastSeenAt, now) };
    if (!device.roomId) {
      return {
        device: safeDevice,
        currentBooking: null,
        nextBooking: null,
        checkInWindow: null,
        nextCheckInWindow: null,
      };
    }

    const [currentBooking, nextBooking, checkInBooking] = await Promise.all([
      this.prisma.booking.findFirst({
        where: {
          roomId: device.roomId,
          status: "CHECKED_IN",
          endTime: { gt: now },
        },
        include: { user: { select: { name: true } } },
      }),
      this.prisma.booking.findFirst({
        where: { roomId: device.roomId, status: "CONFIRMED", startTime: { gt: now } },
        include: { user: { select: { name: true } } },
        orderBy: { startTime: "asc" },
      }),
      this.prisma.booking.findFirst({
        where: {
          roomId: device.roomId,
          status: "CONFIRMED",
          startTime: {
            gte: new Date(now.getTime() - CHECK_IN_LATE_MINUTES * 60_000),
            lte: new Date(now.getTime() + CHECK_IN_EARLY_MINUTES * 60_000),
          },
        },
        select: { id: true, startTime: true },
        orderBy: { startTime: "asc" },
      }),
    ]);

    return {
      device: safeDevice,
      currentBooking: currentBooking ? withoutQrTokenHash(currentBooking) : null,
      nextBooking: nextBooking ? withoutQrTokenHash(nextBooking) : null,
      nextCheckInWindow: nextBooking ? this.checkInPolicy.getWindow(nextBooking.startTime) : null,
      checkInWindow: checkInBooking
        ? { bookingId: checkInBooking.id, ...this.checkInPolicy.getWindow(checkInBooking.startTime) }
        : null,
    };
  }

  async getDeviceSchedule(id: string) {
    const device = await this.prisma.device.findUnique({
      where: { id },
      select: { id: true, name: true, roomId: true },
    });
    if (!device) throw new Error("Device not found");
    if (!device.roomId) return { device, bookings: [] };

    const { start, end } = bangkokDayBounds(getBangkokDateTime(new Date()).date);
    const bookings = await this.prisma.booking.findMany({
      where: {
        roomId: device.roomId,
        status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] },
        startTime: { gte: start },
        endTime: { lt: end },
      },
      include: { user: { select: { name: true } } },
      orderBy: { startTime: "asc" },
      take: 50,
    });
    return { device, bookings: bookings.map(withoutQrTokenHash) };
  }

  async generatePairingCode(
    deviceId: string,
    actor: AuditActor = { type: "SYSTEM" },
  ): Promise<{ code: string; expiresAt: Date }> {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
      select: { id: true, isActive: true, revokedAt: true },
    });
    if (!device) throw new Error("Device not found");
    if (!device.isActive || device.revokedAt) throw new Error("Reactivate the device before pairing");

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const code = generatePairingCode();
      const codeHash = hashPairingCode(code, this.pairingSecret);
      const expiresAt = new Date(Date.now() + PAIRING_CODE_TTL_MS);
      try {
        await this.prisma.$transaction(async (tx) => {
          await tx.devicePairingCode.updateMany({
            where: { deviceId, consumedAt: null },
            data: { consumedAt: new Date() },
          });
          await tx.devicePairingCode.create({ data: { deviceId, codeHash, expiresAt } });
          await this.audit.record(tx, {
            actor,
            targetType: "DEVICE",
            targetId: deviceId,
            deviceId,
            eventType: "DEVICE_PAIRING_CODE_ISSUED",
            metadata: { expiresAt: expiresAt.toISOString() },
          });
        });
        return { code, expiresAt };
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
      }
    }
    throw new Error("Failed to generate a unique pairing code");
  }

  async pairDevice(code: string, correlationId?: string): Promise<{ deviceId: string; deviceKey: string }> {
    if (!/^\d{6}$/.test(code)) throw new Error("Invalid or expired pairing code");
    const codeHash = hashPairingCode(code, this.pairingSecret);
    const credential = generateDeviceCredential();

    return withSerializableRetry(this.prisma, async (tx) => {
      const now = new Date();
      const pairing = await tx.devicePairingCode.findUnique({
        where: { codeHash },
        include: { device: { select: { id: true, isActive: true, revokedAt: true } } },
      });
      if (!pairing || pairing.consumedAt || pairing.expiresAt <= now || !pairing.device.isActive || pairing.device.revokedAt) {
        throw new Error("Invalid or expired pairing code");
      }

      const claimed = await tx.devicePairingCode.updateMany({
        where: { id: pairing.id, consumedAt: null, expiresAt: { gt: now } },
        data: { consumedAt: now },
      });
      if (claimed.count !== 1) throw new Error("Invalid or expired pairing code");

      await tx.device.update({
        where: { id: pairing.deviceId },
        data: {
          deviceKeyHash: credential.deviceKeyHash,
          deviceKeyPrefix: credential.deviceKeyPrefix,
          credentialVersion: { increment: 1 },
          credentialRotatedAt: now,
        },
      });
      await this.audit.record(tx, {
        actor: { type: "DEVICE", id: pairing.deviceId, correlationId },
        targetType: "DEVICE",
        targetId: pairing.deviceId,
        deviceId: pairing.deviceId,
        eventType: "DEVICE_PAIRED",
        metadata: { credentialRotated: true },
      });
      return { deviceId: pairing.deviceId, deviceKey: credential.deviceKey };
    });
  }

  async scanQr(device: AuthenticatedDevice, qrToken: string, correlationId?: string, now = new Date()) {
    return this.bookingService.checkInByDevice(qrToken, device, correlationId, now);
  }

  async createWalkIn(device: AuthenticatedDevice & { roomId: string }, data: {
    durationMinutes: number;
    attendees: number;
    purpose?: string;
    requesterName: string;
    requesterReference?: string;
    correlationId?: string;
    now?: Date;
  }) {
    return this.bookingService.createWalkIn({ device, ...data });
  }
}
