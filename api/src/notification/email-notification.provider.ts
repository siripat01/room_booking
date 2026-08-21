import { Resend } from "resend";
import {
  NotificationDeliveryError,
  type NotificationMessage,
  type NotificationProvider,
} from "./notification.types";

const NON_RETRYABLE_CODES = new Set([
  "invalid_idempotency_key",
  "validation_error",
  "missing_api_key",
  "restricted_api_key",
  "invalid_api_key",
  "invalid_from_address",
  "invalid_parameter",
  "missing_required_field",
]);

export class EmailNotificationProvider implements NotificationProvider {
  readonly channel = "EMAIL" as const;
  private resend?: Resend;

  constructor(
    private readonly config = {
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.EMAIL_FROM,
    },
  ) {}

  async send(message: NotificationMessage) {
    if (process.env.NODE_ENV === "test" || process.env.NOTIFICATIONS_DISABLED === "true") {
      return { providerMessageId: `suppressed:${message.retryKey}`, suppressed: true };
    }
    if (!this.config.apiKey || !this.config.from) {
      throw new NotificationDeliveryError("Email provider is not configured");
    }

    this.resend ??= new Resend(this.config.apiKey);
    const { data, error } = await this.resend.emails.send({
      from: this.config.from,
      to: message.recipient,
      subject: message.subject,
      html: message.html,
      text: message.text,
    }, { idempotencyKey: message.idempotencyKey });

    if (error) {
      const code = "name" in error ? String(error.name) : "unknown";
      throw new NotificationDeliveryError(
        `Resend rejected the notification (${code})`,
        !NON_RETRYABLE_CODES.has(code),
      );
    }
    return { providerMessageId: data?.id };
  }
}
