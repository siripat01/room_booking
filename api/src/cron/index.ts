import prisma from "../../libs/db";
import { BookingService } from "../booking/booking.service";
import { NotificationScheduler } from "../notification/notification.scheduler";

const bookingService = new BookingService(prisma);
const notificationScheduler = new NotificationScheduler(prisma);

async function runAutoCheckout() {
    const now = new Date();

    const completed = await bookingService.completeDueBookings(now);
    const expired = await bookingService.expireDueBookings(now);

    if (completed > 0 || expired > 0) {
        console.log(`[cron] checkout: completed=${completed} expired=${expired}`);
    }
}

async function runReminderJobs() {
    const now = new Date();
    const result = await notificationScheduler.enqueueDueReminders(now);
    if (result.reminder30 > 0 || result.checkIn > 0) {
        console.log(`[cron] reminders: 30-minute=${result.reminder30} check-in=${result.checkIn} jobs=${result.queued}`);
    }
}

export function startCronJobs() {
    console.log("[cron] starting cron jobs");
    runAutoCheckout().catch(console.error);
    runReminderJobs().catch(console.error);

    setInterval(() => runAutoCheckout().catch(console.error), 2 * 60 * 1000);
    setInterval(() => runReminderJobs().catch(console.error), 2 * 60 * 1000);
}
