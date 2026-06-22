import Elysia, { t } from "elysia";
import { betterAuth } from "../middleware/auth.middleware";
import { BookingService } from "./booking.service";
import prisma from "../../libs/db";

const bookingService = new BookingService(prisma);

const bookingRoutes = new Elysia({ prefix: "/bookings" })
    .use(betterAuth)
    .get(
        "/",
        async ({ user, query }) => {
            return bookingService.getBookings(user.id, user.role ?? "userRole", {
                status: query.status,
                roomId: query.roomId,
                userId: query.userId,
                date: query.date,
                page: query.page ? Number(query.page) : undefined,
                limit: query.limit ? Number(query.limit) : undefined,
                forSelf: query.forSelf === "true",
            });
        },
        {
            auth: true,
            query: t.Object({
                status: t.Optional(t.String()),
                roomId: t.Optional(t.String()),
                userId: t.Optional(t.String()),
                date: t.Optional(t.String()),
                page: t.Optional(t.String()),
                limit: t.Optional(t.String()),
                forSelf: t.Optional(t.String()),
            }),
        },
    )
    .get(
        "/stats",
        async ({ user, status }) => {
            if (user.role !== "adminRole") return status(403);
            return bookingService.getStats();
        },
        { auth: true },
    )
    .get(
        "/:id",
        async ({ user, params: { id } }) => {
            return bookingService.getBookingById(id, user.id, user.role ?? "userRole");
        },
        { auth: true },
    )
    .post(
        "/",
        async ({ user, body }) => {
            const autoConfirm = ["teacherRole", "adminRole"].includes(user.role ?? "");
            return bookingService.createBooking({
                userId: user.id,
                roomId: body.roomId,
                startTime: new Date(body.startTime),
                endTime: new Date(body.endTime),
                attendees: body.attendees,
                purpose: body.purpose,
                autoConfirm,
                approvedBy: autoConfirm ? user.id : undefined,
                userRole: user.role ?? "userRole",
            });
        },
        {
            auth: true,
            body: t.Object({
                roomId: t.String(),
                startTime: t.String(),
                endTime: t.String(),
                attendees: t.Number(),
                purpose: t.Optional(t.String()),
            }),
        },
    )
    .patch(
        "/:id/cancel",
        async ({ user, params: { id }, body }) => {
            return bookingService.cancelBooking(
                id,
                user.id,
                user.role ?? "userRole",
                body?.cancelReason,
            );
        },
        {
            auth: true,
            body: t.Optional(t.Object({ cancelReason: t.Optional(t.String()) })),
        },
    )
    .get(
        "/:id/qr",
        async ({ user, params: { id } }) => {
            return bookingService.generateQr(id, user.id, user.role ?? "userRole");
        },
        { auth: true },
    )
    .post(
        "/:id/checkin",
        async ({ params: { id }, body }) => {
            return bookingService.checkIn(id, body.qrToken);
        },
        {
            auth: true,
            body: t.Object({ qrToken: t.String() }),
        },
    )
    .post(
        "/:id/checkout",
        async ({ user, params: { id }, status }) => {
            if (!["adminRole", "teacherRole"].includes(user.role ?? "")) return status(403);
            return bookingService.checkOut(id);
        },
        { auth: true },
    )
    .patch(
        "/:id/approve",
        async ({ user, params: { id }, status }) => {
            if (user.role !== "adminRole") return status(403);
            return bookingService.approveBooking(id, user.id);
        },
        { auth: true },
    )
    .patch(
        "/:id/reject",
        async ({ user, params: { id }, body, status }) => {
            if (user.role !== "adminRole") return status(403);
            return bookingService.rejectBooking(id, user.id, body.reason);
        },
        {
            auth: true,
            body: t.Object({ reason: t.String() }),
        },
    )
    .delete(
        "/:id",
        async ({ user, params: { id }, status }) => {
            if (user.role !== "adminRole") return status(403);
            return bookingService.forceDeleteBooking(id);
        },
        { auth: true },
    );

export default bookingRoutes;