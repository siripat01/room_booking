import { createHmac, randomInt } from "crypto";
import { Prisma, type PrismaClient } from "../../generated/prisma/client";
import { withSerializableRetry } from "../lib/transaction-retry";

const LINK_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const LINK_CODE_LENGTH = 8;
const LINK_CODE_TTL_MS = 10 * 60_000;

function normalizeCode(code: string) {
  return code.trim().toUpperCase();
}

export function hashLineLinkCode(code: string, secret: string) {
  return createHmac("sha256", secret)
    .update(`roomflow:line-link:${normalizeCode(code)}`)
    .digest("hex");
}

function generateLinkCode() {
  return Array.from(
    { length: LINK_CODE_LENGTH },
    () => LINK_CODE_ALPHABET[randomInt(0, LINK_CODE_ALPHABET.length)],
  ).join("");
}

export class LineLinkService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly secret = process.env.BETTER_AUTH_SECRET ?? "",
  ) {}

  async getStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { lineUserId: true, isSystem: true },
    });
    if (!user || user.isSystem) throw new Error("User not found");
    const botBasicId = process.env.LINE_BOT_BASIC_ID?.trim() || null;
    return {
      connected: Boolean(user.lineUserId),
      botBasicId,
      addFriendUrl: botBasicId ? `https://line.me/R/ti/p/${encodeURIComponent(botBasicId)}` : null,
    };
  }

  async createCode(userId: string, now = new Date()) {
    if (this.secret.length < 32) throw new Error("LINE link hashing secret is not configured");
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isSystem: true, lineUserId: true },
    });
    if (!user || user.isSystem) throw new Error("User not found");
    if (user.lineUserId) throw new Error("LINE account is already linked");

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const code = generateLinkCode();
      const codeHash = hashLineLinkCode(code, this.secret);
      const expiresAt = new Date(now.getTime() + LINK_CODE_TTL_MS);
      try {
        await this.prisma.$transaction(async (tx) => {
          await tx.lineLinkCode.updateMany({
            where: { userId, consumedAt: null },
            data: { consumedAt: now },
          });
          await tx.lineLinkCode.create({ data: { userId, codeHash, expiresAt } });
        });
        const status = await this.getStatus(userId);
        return { code, expiresAt, botBasicId: status.botBasicId, addFriendUrl: status.addFriendUrl };
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
      }
    }
    throw new Error("Failed to generate a unique LINE link code");
  }

  async consumeCode(code: string, lineUserId: string, now = new Date()) {
    if (this.secret.length < 32) throw new Error("LINE link hashing secret is not configured");
    if (!/^U[0-9a-f]{32}$/.test(lineUserId)) throw new Error("Invalid LINE user ID");
    const normalized = normalizeCode(code);
    if (normalized.length !== LINK_CODE_LENGTH || [...normalized].some((character) => !LINK_CODE_ALPHABET.includes(character))) {
      throw new Error("Invalid or expired LINE link code");
    }
    const codeHash = hashLineLinkCode(normalized, this.secret);

    try {
      return await withSerializableRetry(this.prisma, async (tx) => {
        const link = await tx.lineLinkCode.findUnique({
          where: { codeHash },
          include: { user: { select: { id: true, isSystem: true, lineUserId: true } } },
        });
        if (!link || link.consumedAt || link.expiresAt <= now || link.user.isSystem) {
          throw new Error("Invalid or expired LINE link code");
        }

        const claimed = await tx.lineLinkCode.updateMany({
          where: { id: link.id, consumedAt: null, expiresAt: { gt: now } },
          data: { consumedAt: now },
        });
        if (claimed.count !== 1) throw new Error("Invalid or expired LINE link code");

        await tx.user.update({
          where: { id: link.userId },
          data: { lineUserId },
        });
        return { userId: link.userId };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new Error("This LINE account is already linked to another RoomFlow user");
      }
      throw error;
    }
  }

  async disconnect(userId: string, now = new Date()) {
    return this.prisma.$transaction(async (tx) => {
      await tx.lineLinkCode.updateMany({
        where: { userId, consumedAt: null },
        data: { consumedAt: now },
      });
      await tx.notificationJob.updateMany({
        where: {
          userId,
          channel: "LINE",
          status: { in: ["PENDING", "RETRY"] },
        },
        data: { status: "CANCELLED", lastError: "LINE account disconnected" },
      });
      await tx.user.update({ where: { id: userId }, data: { lineUserId: null } });
      return { success: true };
    });
  }
}
