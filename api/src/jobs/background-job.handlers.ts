import type { BackgroundJobType, PrismaClient } from "../../generated/prisma/client";
import { BookingService } from "../booking/booking.service";
import { NotificationScheduler } from "../notification/notification.scheduler";
import { RecurringEntitlementService } from "../subscription/recurring-entitlement.service";

const DEFAULT_COMPLETED_JOB_RETENTION_DAYS = 30;
const DEFAULT_NOTIFICATION_JOB_RETENTION_DAYS = 90;
const DEFAULT_FAILED_NOTIFICATION_JOB_RETENTION_DAYS = 180;

function completedJobRetentionDays() {
  const configured = Number(process.env.BACKGROUND_JOB_RETENTION_DAYS ?? DEFAULT_COMPLETED_JOB_RETENTION_DAYS);
  return Number.isInteger(configured) && configured >= 1 && configured <= 365
    ? configured
    : DEFAULT_COMPLETED_JOB_RETENTION_DAYS;
}

function configuredRetentionDays(name: string, fallback: number) {
  const configured = Number(process.env[name] ?? fallback);
  return Number.isInteger(configured) && configured >= 1 && configured <= 730
    ? configured
    : fallback;
}

export type BackgroundJobResult = Record<string, string | number | boolean | null>;
export type BackgroundJobHandler = (jobId: string, now: Date) => Promise<BackgroundJobResult>;

export class BackgroundJobHandlers {
  private readonly bookings: BookingService;
  private readonly notifications: NotificationScheduler;
  private readonly recurringEntitlements: RecurringEntitlementService;

  constructor(private readonly prisma: PrismaClient) {
    this.bookings = new BookingService(prisma);
    this.notifications = new NotificationScheduler(prisma);
    this.recurringEntitlements = new RecurringEntitlementService(prisma);
  }

  for(type: BackgroundJobType): BackgroundJobHandler {
    switch (type) {
      case "EXPIRE_BOOKINGS":
        return async (jobId, now) => ({
          expired: await this.bookings.expireDueBookings(now, this.systemActor(jobId, type)),
        });
      case "EXPIRE_PRO_ACCESS":
        return async (_jobId, now) => this.recurringEntitlements.expireDueProAccess(now);
      case "AUTO_CHECKOUT":
        return async (jobId, now) => ({
          completed: await this.bookings.completeDueBookings(now, this.systemActor(jobId, type)),
        });
      case "ENQUEUE_REMINDERS":
        return async (_jobId, now) => this.notifications.enqueueDueReminders(now);
      case "PROMOTE_WAITLIST":
        return async (jobId, now) => this.bookings.promoteDueWaitlist(now, this.systemActor(jobId, type));
      case "PURGE_JOB_HISTORY":
        return async (jobId, now) => {
          const retentionDays = completedJobRetentionDays();
          const notificationRetentionDays = configuredRetentionDays(
            "NOTIFICATION_JOB_RETENTION_DAYS",
            DEFAULT_NOTIFICATION_JOB_RETENTION_DAYS,
          );
          const failedNotificationRetentionDays = configuredRetentionDays(
            "FAILED_NOTIFICATION_JOB_RETENTION_DAYS",
            DEFAULT_FAILED_NOTIFICATION_JOB_RETENTION_DAYS,
          );
          const [backgroundJobs, terminalNotifications, failedNotifications] = await this.prisma.$transaction([
            this.prisma.backgroundJob.deleteMany({
              where: {
                id: { not: jobId },
                status: "COMPLETED",
                completedAt: { lt: new Date(now.getTime() - retentionDays * 24 * 60 * 60_000) },
              },
            }),
            this.prisma.notificationJob.deleteMany({
              where: {
                status: { in: ["SENT", "CANCELLED"] },
                updatedAt: {
                  lt: new Date(now.getTime() - notificationRetentionDays * 24 * 60 * 60_000),
                },
              },
            }),
            this.prisma.notificationJob.deleteMany({
              where: {
                status: "FAILED",
                updatedAt: {
                  lt: new Date(now.getTime() - failedNotificationRetentionDays * 24 * 60 * 60_000),
                },
              },
            }),
          ]);
          return {
            backgroundJobsDeleted: backgroundJobs.count,
            terminalNotificationsDeleted: terminalNotifications.count,
            failedNotificationsDeleted: failedNotifications.count,
            retentionDays,
            notificationRetentionDays,
            failedNotificationRetentionDays,
          };
        };
    }
  }

  private systemActor(jobId: string, type: BackgroundJobType) {
    return {
      type: "SYSTEM" as const,
      correlationId: jobId,
      metadata: { source: "background-job", jobType: type },
    };
  }
}
