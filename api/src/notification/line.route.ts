import Elysia from "elysia";
import prisma from "../../libs/db";
import { DatabaseRateLimiter } from "../lib/database-rate-limiter";
import { LineLinkService } from "./line-link.service";
import { LineMessagingProvider } from "./line-messaging.provider";
import { verifyLineWebhookSignature } from "./line-webhook-signature";

type LineWebhookEvent = {
  type?: string;
  replyToken?: string;
  source?: { type?: string; userId?: string };
  message?: { type?: string; text?: string };
};

const linkService = new LineLinkService(prisma);
const lineProvider = new LineMessagingProvider();
const limiter = new DatabaseRateLimiter(prisma);

export const lineRoutes = new Elysia({ prefix: "/line" })
  .post("/webhook", async ({ request, status }) => {
    const rawBody = await request.text();
    const signature = request.headers.get("x-line-signature") ?? "";
    const channelSecret = process.env.LINE_CHANNEL_SECRET ?? "";
    if (!verifyLineWebhookSignature(rawBody, signature, channelSecret)) {
      return status(401, { error: "Invalid LINE webhook signature" });
    }

    let payload: { events?: LineWebhookEvent[] };
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return status(400, { error: "Invalid webhook payload" });
    }

    for (const event of payload.events ?? []) {
      if (
        event.type !== "message"
        || event.source?.type !== "user"
        || !event.source.userId
        || event.message?.type !== "text"
        || !event.message.text
      ) continue;

      const match = event.message.text.trim().toUpperCase().match(/^LINK\s+([A-Z0-9]{8})$/);
      if (!match) continue;
      const rate = await limiter.consume("line-link-webhook", event.source.userId, 10, 10 * 60);
      if (!rate.allowed) {
        if (event.replyToken) {
          await lineProvider.reply(event.replyToken, "ลองเชื่อมต่อบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่").catch(() => undefined);
        }
        continue;
      }

      try {
        await linkService.consumeCode(match[1], event.source.userId);
        if (event.replyToken) {
          await lineProvider.reply(event.replyToken, "เชื่อมต่อ LINE กับ RoomFlow สำเร็จแล้ว").catch(() => undefined);
        }
      } catch {
        if (event.replyToken) {
          await lineProvider.reply(event.replyToken, "รหัสเชื่อมต่อไม่ถูกต้อง หมดอายุ หรือถูกใช้แล้ว").catch(() => undefined);
        }
      }
    }
    return { received: true };
  });
