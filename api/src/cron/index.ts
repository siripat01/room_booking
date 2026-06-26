import prisma from "../../libs/db";
import { sendBookingReminder } from "../lib/email";

async function runAutoCheckout() {
    const now = new Date();

    // CHECKED_IN bookings past endTime → COMPLETED
    await prisma.booking.updateMany({
        where: { status: "CHECKED_IN", endTime: { lt: now } },
        data: { status: "COMPLETED", checkedOutAt: now },
    });

    // CONFIRMED bookings where check-in window (startTime + 10 min) has passed → EXPIRED
    const expireThreshold = new Date(now.getTime() - 10 * 60 * 1000);
    await prisma.booking.updateMany({
        where: { status: "CONFIRMED", startTime: { lt: expireThreshold } },
        data: { status: "EXPIRED" },
    });
}

async function runReminderEmails() {
    const now = new Date();
    const from = new Date(now.getTime() + 45 * 60 * 1000);
    const to = new Date(now.getTime() + 75 * 60 * 1000);

    const bookings = await prisma.booking.findMany({
        where: { status: "CONFIRMED", startTime: { gte: from, lte: to } },
        include: {
            room: { select: { name: true, floor: true } },
            user: { select: { name: true, email: true } },
        },
    });

    for (const b of bookings) {
        await sendBookingReminder({
            userEmail: b.user.email,
            userName: b.user.name,
            roomName: b.room.name,
            roomFloor: b.room.floor,
            startTime: b.startTime,
            endTime: b.endTime,
            purpose: b.purpose,
        });
    }
}

export function startCronJobs() {
    runAutoCheckout().catch(console.error);
    setInterval(() => runAutoCheckout().catch(console.error), 5 * 60 * 1000);
    setInterval(() => runReminderEmails().catch(console.error), 15 * 60 * 1000);
}
