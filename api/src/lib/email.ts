import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM;

type BookingEmailData = {
  userEmail: string;
  userName: string;
  roomName: string;
  roomFloor: string;
  startTime: Date;
  endTime: Date;
  purpose?: string | null;
};

function canSend(): boolean {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[email] Skipped: RESEND_API_KEY not set");
    return false;
  }
  if (!FROM) {
    console.warn("[email] Skipped: EMAIL_FROM not set — set it in Fly.io secrets to enable email");
    return false;
  }
  return true;
}

async function send(payload: Parameters<typeof resend.emails.send>[0]) {
  const { data, error } = await resend.emails.send(payload);
  if (error) {
    console.error("[email] Send failed:", error);
  } else {
    console.log("[email] Sent:", data?.id, "→", payload.to);
  }
}

function formatDate(d: Date) {
  return d.toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function sendBookingApproved(data: BookingEmailData) {
  if (!canSend()) return;
  await send({
    from: FROM!,
    to: data.userEmail,
    subject: `✅ การจองของคุณได้รับการอนุมัติ — ${data.roomName}`,
    html: `
      <p>เรียน ${data.userName},</p>
      <p>การจองห้อง <strong>${data.roomName}</strong> (ชั้น ${data.roomFloor}) ของคุณได้รับการ<strong>อนุมัติ</strong>แล้ว</p>
      <p>วันและเวลา: ${formatDate(data.startTime)} – ${formatDate(data.endTime)}</p>
      ${data.purpose ? `<p>หัวข้อ: ${data.purpose}</p>` : ""}
      <p>กรุณาเช็คอินด้วย QR Code ภายใน 10 นาทีหลังเวลาเริ่มต้น</p>
    `,
  });
}

export async function sendBookingRejected(data: BookingEmailData & { reason?: string | null }) {
  if (!canSend()) return;
  await send({
    from: FROM!,
    to: data.userEmail,
    subject: `❌ การจองของคุณถูกปฏิเสธ — ${data.roomName}`,
    html: `
      <p>เรียน ${data.userName},</p>
      <p>การจองห้อง <strong>${data.roomName}</strong> ของคุณ วันที่ ${formatDate(data.startTime)} ถูก<strong>ปฏิเสธ</strong></p>
      ${data.reason ? `<p>เหตุผล: ${data.reason}</p>` : ""}
      <p>คุณสามารถทำการจองใหม่ได้ที่ระบบ Room Booking</p>
    `,
  });
}

export async function sendBookingReminder30(data: BookingEmailData) {
  if (!canSend()) return;
  await send({
    from: FROM!,
    to: data.userEmail,
    subject: `⏰ การจองของคุณจะเริ่มใน 30 นาที — ${data.roomName}`,
    html: `
      <p>เรียน ${data.userName},</p>
      <p>การจองห้อง <strong>${data.roomName}</strong> (ชั้น ${data.roomFloor}) ของคุณจะเริ่มใน <strong>30 นาที</strong></p>
      <p>เวลา: ${formatDate(data.startTime)}</p>
      ${data.purpose ? `<p>หัวข้อ: ${data.purpose}</p>` : ""}
      <p>อย่าลืมเช็คอินด้วย QR Code ที่หน้าห้องด้วยนะคะ</p>
    `,
  });
}

export async function sendBookingReminderCheckin(data: BookingEmailData) {
  if (!canSend()) return;
  await send({
    from: FROM!,
    to: data.userEmail,
    subject: `🏁 ถึงเวลาเช็คอินแล้ว! — ${data.roomName}`,
    html: `
      <p>เรียน ${data.userName},</p>
      <p>ถึงเวลาเช็คอินห้อง <strong>${data.roomName}</strong> (ชั้น ${data.roomFloor}) แล้ว!</p>
      <p>เวลา: ${formatDate(data.startTime)} – ${formatDate(data.endTime)}</p>
      ${data.purpose ? `<p>หัวข้อ: ${data.purpose}</p>` : ""}
      <p>กรุณาเช็คอินด้วย QR Code ที่หน้าห้องภายใน 10 นาที</p>
    `,
  });
}

export async function sendWaitlistPromoted(data: BookingEmailData) {
  if (!canSend()) return;
  await send({
    from: FROM!,
    to: data.userEmail,
    subject: `✅ คุณได้รับการเลื่อนขึ้นจากรายการรอ — ${data.roomName}`,
    html: `
      <p>เรียน ${data.userName},</p>
      <p>ยินดีด้วย! การจองห้อง <strong>${data.roomName}</strong> (ชั้น ${data.roomFloor}) ของคุณได้รับการ<strong>ยืนยันแล้ว</strong> เนื่องจากมีผู้ยกเลิกการจอง</p>
      <p>วันและเวลา: ${formatDate(data.startTime)} – ${formatDate(data.endTime)}</p>
      ${data.purpose ? `<p>หัวข้อ: ${data.purpose}</p>` : ""}
      <p>กรุณาเช็คอินด้วย QR Code ที่หน้าห้องภายใน 10 นาทีหลังเวลาเริ่มต้น</p>
    `,
  });
}
