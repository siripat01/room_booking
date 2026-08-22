export type NotificationChannelName = "EMAIL" | "LINE";

export type NotificationTypeName =
  | "BOOKING_APPROVED"
  | "BOOKING_REJECTED"
  | "REMINDER_30"
  | "CHECKIN_REMINDER"
  | "WAITLIST_PROMOTED"
  | "TEST";

export type NotificationPayload = {
  userName: string;
  roomName?: string;
  roomFloor?: string;
  startTime?: string;
  endTime?: string;
  purpose?: string | null;
  reason?: string | null;
};

export type NotificationMessage = {
  recipient: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
  retryKey: string;
};

export type NotificationDeliveryResult = {
  providerMessageId?: string;
  suppressed?: boolean;
};

export interface NotificationProvider {
  readonly channel: NotificationChannelName;
  send(message: NotificationMessage): Promise<NotificationDeliveryResult>;
}

export class NotificationDeliveryError extends Error {
  constructor(
    message: string,
    readonly retryable = true,
  ) {
    super(message);
    this.name = "NotificationDeliveryError";
  }
}
