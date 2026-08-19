import prisma from "../../libs/db";
import { sendBookingReminder30, sendBookingReminderCheckin } from "../lib/email";
import { sendLineNotify } from "../lib/lineNotify";
import { BookingService } from "../booking/booking.service";

const bookingService = new BookingService(prisma);

async function runAutoCheckout() {
    const now = new Date();

    const completed = await bookingService.completeDueBookings(now);
    const expired = await bookingService.expireDueBookings(now);

    if (completed > 0 || expired > 0) {
        console.log(`[cron] checkout: completed=${completed} expired=${expired}`);
    }
}

async function runReminderEmails() {
    const now = new Date();
    console.log("[cron] runReminderEmails at", now.toISOString());

    // 30-min reminder: startTime in [now+25min, now+35min], PRO users, not yet sent
    const from30 = new Date(now.getTime() + 25 * 60 * 1000);
    const to30 = new Date(now.getTime() + 35 * 60 * 1000);

    const bookings30 = await prisma.booking.findMany({
        where: {
            status: "CONFIRMED",
            startTime: { gte: from30, lte: to30 },
            reminder30SentAt: null,
            user: { plan: "PRO" },
        },
        include: {
            room: { select: { name: true, floor: true } },
            user: { select: { name: true, email: true, lineNotifyToken: true } },
        },
    });

    console.log(`[cron] 30-min window ${from30.toISOString()} – ${to30.toISOString()}: ${bookings30.length} booking(s)`);

    for (const b of bookings30) {
        const reminderData = {
            userEmail: b.user.email,
            userName: b.user.name,
            roomName: b.room.name,
            roomFloor: b.room.floor,
            startTime: b.startTime,
            endTime: b.endTime,
            purpose: b.purpose,
        };
        await sendBookingReminder30(reminderData);
        if (b.user.lineNotifyToken) {
            sendLineNotify(b.user.lineNotifyToken, `⏰ ห้อง ${b.room.name} จะเริ่มใน 30 นาที`);
        }
        await prisma.booking.update({ where: { id: b.id }, data: { reminder30SentAt: now } });
    }

    // Check-in reminder: startTime in [now-5min, now+5min], PRO users, not yet sent
    const fromCheckin = new Date(now.getTime() - 5 * 60 * 1000);
    const toCheckin = new Date(now.getTime() + 5 * 60 * 1000);

    const bookingsCheckin = await prisma.booking.findMany({
        where: {
            status: "CONFIRMED",
            startTime: { gte: fromCheckin, lte: toCheckin },
            reminderCheckinSentAt: null,
            user: { plan: "PRO" },
        },
        include: {
            room: { select: { name: true, floor: true } },
            user: { select: { name: true, email: true, lineNotifyToken: true } },
        },
    });

    console.log(`[cron] checkin window ${fromCheckin.toISOString()} – ${toCheckin.toISOString()}: ${bookingsCheckin.length} booking(s)`);

    for (const b of bookingsCheckin) {
        const reminderData = {
            userEmail: b.user.email,
            userName: b.user.name,
            roomName: b.room.name,
            roomFloor: b.room.floor,
            startTime: b.startTime,
            endTime: b.endTime,
            purpose: b.purpose,
        };
        await sendBookingReminderCheckin(reminderData);
        if (b.user.lineNotifyToken) {
            sendLineNotify(b.user.lineNotifyToken, `🏁 เช็คอินห้อง ${b.room.name} ได้แล้ว!`);
        }
        await prisma.booking.update({ where: { id: b.id }, data: { reminderCheckinSentAt: now } });
    }
}

export function startCronJobs() {
    console.log("[cron] starting cron jobs");
    runAutoCheckout().catch(console.error);
    runReminderEmails().catch(console.error);

    setInterval(() => runAutoCheckout().catch(console.error), 2 * 60 * 1000);
    setInterval(() => runReminderEmails().catch(console.error), 2 * 60 * 1000);
}
