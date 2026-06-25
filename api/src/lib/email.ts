import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM ?? "noreply@room-booking.kmitl.ac.th";

type BookingEmailData = {
  userEmail: string;
  userName: string;
  roomName: string;
  roomFloor: string;
  startTime: Date;
  endTime: Date;
  purpose?: string | null;
};

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
  if (!process.env.RESEND_API_KEY) return;
  await resend.emails.send({
    from: FROM,
    to: data.userEmail,
    subject: `✅ การจองของคุณได้รับการอนุมัติ — ${data.roomName}`,
    html: `
      <p>เรียน ${data.userName},</p>
      <p>การจองห้อง <strong>${data.roomName}</strong> (ชั้น ${data.roomFloor}) ของคุณได้รับการ<strong>อนุมัติ</strong>แล้ว</p>
      <p>วันและเวลา: ${formatDate(data.startTime)} – ${formatDate(data.endTime)}</p>
      ${data.purpose ? `<p>หัวข้อ: ${data.purpose}</p>` : ""}
      <p>กรุณาเช็คอินด้วย QR Code ภายใน 10 นาทีหลังเวลาเริ่มต้น</p>
    `,
  }).catch(console.error);
}

export async function sendBookingRejected(data: BookingEmailData & { reason?: string | null }) {
  if (!process.env.RESEND_API_KEY) return;
  await resend.emails.send({
    from: FROM,
    to: data.userEmail,
    subject: `❌ การจองของคุณถูกปฏิเสธ — ${data.roomName}`,
    html: `
      <p>เรียน ${data.userName},</p>
      <p>การจองห้อง <strong>${data.roomName}</strong> ของคุณ วันที่ ${formatDate(data.startTime)} ถูก<strong>ปฏิเสธ</strong></p>
      ${data.reason ? `<p>เหตุผล: ${data.reason}</p>` : ""}
      <p>คุณสามารถทำการจองใหม่ได้ที่ระบบ Room Booking</p>
    `,
  }).catch(console.error);
}

export async function sendBookingReminder(data: BookingEmailData) {
  if (!process.env.RESEND_API_KEY) return;
  await resend.emails.send({
    from: FROM,
    to: data.userEmail,
    subject: `⏰ แจ้งเตือน: การจองของคุณจะเริ่มใน 1 ชั่วโมง — ${data.roomName}`,
    html: `
      <p>เรียน ${data.userName},</p>
      <p>การจองห้อง <strong>${data.roomName}</strong> (ชั้น ${data.roomFloor}) ของคุณจะเริ่มใน <strong>1 ชั่วโมง</strong></p>
      <p>เวลา: ${formatDate(data.startTime)}</p>
      ${data.purpose ? `<p>หัวข้อ: ${data.purpose}</p>` : ""}
      <p>อย่าลืมเช็คอินด้วย QR Code ที่หน้าห้องด้วยนะคะ</p>
    `,
  }).catch(console.error);
}
