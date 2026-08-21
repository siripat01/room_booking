import type { NotificationPayload, NotificationTypeName } from "./notification.types";

const BANGKOK_FORMATTER = new Intl.DateTimeFormat("th-TH", {
  timeZone: "Asia/Bangkok",
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character]!);
}

function required(value: string | undefined, field: string) {
  if (!value) throw new Error(`Notification payload is missing ${field}`);
  return value;
}

function formatInstant(value: string | undefined, field: string) {
  const instant = new Date(required(value, field));
  if (Number.isNaN(instant.getTime())) throw new Error(`Notification payload has invalid ${field}`);
  return BANGKOK_FORMATTER.format(instant);
}

function bookingContext(payload: NotificationPayload) {
  const roomName = required(payload.roomName, "roomName");
  const start = formatInstant(payload.startTime, "startTime");
  const end = formatInstant(payload.endTime, "endTime");
  const floor = payload.roomFloor ? ` (ชั้น ${payload.roomFloor})` : "";
  const purposeText = payload.purpose ? `\nหัวข้อ: ${payload.purpose}` : "";
  const purposeHtml = payload.purpose ? `<p>หัวข้อ: ${escapeHtml(payload.purpose)}</p>` : "";
  return { roomName, start, end, floor, purposeText, purposeHtml };
}

export function renderNotification(type: NotificationTypeName, payload: NotificationPayload) {
  const userName = required(payload.userName, "userName");
  const safeUserName = escapeHtml(userName);

  if (type === "TEST") {
    return {
      subject: "RoomFlow notification test",
      text: `สวัสดี ${userName}\nการแจ้งเตือน RoomFlow พร้อมใช้งานแล้ว`,
      html: `<p>สวัสดี ${safeUserName},</p><p>การแจ้งเตือน RoomFlow พร้อมใช้งานแล้ว</p>`,
    };
  }

  const context = bookingContext(payload);
  const safeRoom = escapeHtml(context.roomName);
  const safeFloor = payload.roomFloor ? ` (ชั้น ${escapeHtml(payload.roomFloor)})` : "";

  switch (type) {
    case "BOOKING_APPROVED":
      return {
        subject: `✅ การจองของคุณได้รับการอนุมัติ — ${context.roomName}`,
        text: `การจองห้อง ${context.roomName}${context.floor} ได้รับการอนุมัติแล้ว\nเวลา: ${context.start} – ${context.end}${context.purposeText}`,
        html: `<p>เรียน ${safeUserName},</p><p>การจองห้อง <strong>${safeRoom}</strong>${safeFloor} ได้รับการอนุมัติแล้ว</p><p>เวลา: ${escapeHtml(context.start)} – ${escapeHtml(context.end)}</p>${context.purposeHtml}<p>กรุณาเช็คอินด้วย QR Code ที่ kiosk ประจำห้องภายในช่วงเวลาที่กำหนด</p>`,
      };
    case "BOOKING_REJECTED": {
      const reasonText = payload.reason ? `\nเหตุผล: ${payload.reason}` : "";
      const reasonHtml = payload.reason ? `<p>เหตุผล: ${escapeHtml(payload.reason)}</p>` : "";
      return {
        subject: `❌ การจองของคุณถูกปฏิเสธ — ${context.roomName}`,
        text: `การจองห้อง ${context.roomName} เวลา ${context.start} ถูกปฏิเสธ${reasonText}`,
        html: `<p>เรียน ${safeUserName},</p><p>การจองห้อง <strong>${safeRoom}</strong> เวลา ${escapeHtml(context.start)} ถูกปฏิเสธ</p>${reasonHtml}`,
      };
    }
    case "REMINDER_30":
      return {
        subject: `⏰ การจองของคุณจะเริ่มใน 30 นาที — ${context.roomName}`,
        text: `ห้อง ${context.roomName}${context.floor} จะเริ่มใน 30 นาที\nเวลา: ${context.start}${context.purposeText}`,
        html: `<p>เรียน ${safeUserName},</p><p>การจองห้อง <strong>${safeRoom}</strong>${safeFloor} จะเริ่มใน <strong>30 นาที</strong></p><p>เวลา: ${escapeHtml(context.start)}</p>${context.purposeHtml}`,
      };
    case "CHECKIN_REMINDER":
      return {
        subject: `🏁 ถึงเวลาเช็คอินแล้ว — ${context.roomName}`,
        text: `เช็คอินห้อง ${context.roomName}${context.floor} ได้แล้ว\nเวลา: ${context.start} – ${context.end}${context.purposeText}`,
        html: `<p>เรียน ${safeUserName},</p><p>เช็คอินห้อง <strong>${safeRoom}</strong>${safeFloor} ได้แล้ว</p><p>เวลา: ${escapeHtml(context.start)} – ${escapeHtml(context.end)}</p>${context.purposeHtml}<p>กรุณาใช้ QR Code ที่ kiosk ประจำห้องไม่เกิน 12 นาทีหลังเวลาเริ่ม</p>`,
      };
    case "WAITLIST_PROMOTED":
      return {
        subject: `✅ คุณได้รับการเลื่อนขึ้นจากรายการรอ — ${context.roomName}`,
        text: `คุณได้รับการจองห้อง ${context.roomName}${context.floor} จากรายการรอแล้ว\nเวลา: ${context.start} – ${context.end}${context.purposeText}`,
        html: `<p>เรียน ${safeUserName},</p><p>คุณได้รับการจองห้อง <strong>${safeRoom}</strong>${safeFloor} จากรายการรอแล้ว</p><p>เวลา: ${escapeHtml(context.start)} – ${escapeHtml(context.end)}</p>${context.purposeHtml}`,
      };
  }
}
