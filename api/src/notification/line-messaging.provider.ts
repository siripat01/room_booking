import {
  NotificationDeliveryError,
  type NotificationMessage,
  type NotificationProvider,
} from "./notification.types";

const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";
const LINE_REPLY_URL = "https://api.line.me/v2/bot/message/reply";
type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export class LineMessagingProvider implements NotificationProvider {
  readonly channel = "LINE" as const;

  constructor(
    private readonly accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN,
    private readonly fetchImpl: FetchLike = fetch,
    private readonly deliveryDisabled = process.env.NODE_ENV === "test" || process.env.NOTIFICATIONS_DISABLED === "true",
  ) {}

  async send(message: NotificationMessage) {
    if (this.deliveryDisabled) {
      return { providerMessageId: `suppressed:${message.retryKey}`, suppressed: true };
    }
    if (!this.accessToken) {
      throw new NotificationDeliveryError("LINE Messaging provider is not configured");
    }

    const response = await this.fetchImpl(LINE_PUSH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        "X-Line-Retry-Key": message.retryKey,
      },
      body: JSON.stringify({
        to: message.recipient,
        messages: [{ type: "text", text: message.text.slice(0, 5_000) }],
      }),
    });
    if (response.status === 409) {
      const acceptedRequestId = response.headers.get("x-line-accepted-request-id");
      if (acceptedRequestId) return { providerMessageId: acceptedRequestId };
    }
    if (!response.ok) {
      throw new NotificationDeliveryError(
        `LINE Messaging API returned HTTP ${response.status}`,
        response.status === 429 || response.status >= 500,
      );
    }
    return { providerMessageId: response.headers.get("x-line-request-id") ?? undefined };
  }

  async reply(replyToken: string, text: string) {
    if (this.deliveryDisabled) return;
    if (!this.accessToken) throw new NotificationDeliveryError("LINE Messaging provider is not configured", false);

    const response = await this.fetchImpl(LINE_REPLY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ replyToken, messages: [{ type: "text", text: text.slice(0, 5_000) }] }),
    });
    if (!response.ok) {
      throw new NotificationDeliveryError(
        `LINE reply API returned HTTP ${response.status}`,
        response.status === 429 || response.status >= 500,
      );
    }
  }
}
