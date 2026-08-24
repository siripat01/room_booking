import Elysia, { t } from "elysia";
import { betterAuth } from "../middleware/auth.middleware";
import { BookingService } from "./booking.service";
import { isBookingPolicyError } from "./booking.errors";
import { CheckInPolicyError } from "../check-in/check-in.errors";
import prisma from "../../libs/db";
import { requestCorrelationId } from "../lib/request-correlation";

const bookingService = new BookingService(prisma);

const bookingRoutes = new Elysia({ prefix: "/bookings" })
    .use(betterAuth)
    .onError(({ error, status }) => {
        if (error instanceof Error && error.message === "Unauthorized") {
            return status(403, { error: "Forbidden" });
        }
        if (error instanceof Error && error.message === "Booking not found") {
            return status(404, { error: error.message });
        }
        if (!isBookingPolicyError(error)) return;
        const conflict = [
            "ROOM_OVERLAP",
            "USER_OVERLAP",
            "CONCURRENT_BOOKING_CONFLICT",
            "INVALID_STATE_TRANSITION",
        ].includes(error.code);
        return status(conflict ? 409 : 400, { error: error.message, code: error.code });
    })
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
                search: query.search,
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
                search: t.Optional(t.String()),
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
        "/waitlist",
        async ({ user }) => bookingService.getUserWaitlist(user.id),
        { auth: true },
    )
    .post(
        "/waitlist",
        async ({ user, body, status, request }) => {
            try {
                return await bookingService.joinWaitlist({
                    userId: user.id,
                    roomId: body.roomId,
                    startTime: new Date(body.startTime),
                    endTime: new Date(body.endTime),
                    attendees: body.attendees,
                    purpose: body.purpose,
                    userRole: user.role ?? "userRole",
                    correlationId: requestCorrelationId(request),
                });
            } catch (e: any) {
                if (e.message === "Waitlist requires PRO plan") return status(403, { error: e.message });
                if (e.message.startsWith("Already")) return status(409, { error: e.message });
                throw e;
            }
        },
        {
            auth: true,
            body: t.Object({
                roomId: t.String(),
                startTime: t.String(),
                endTime: t.String(),
                attendees: t.Number({ minimum: 1 }),
                purpose: t.Optional(t.String()),
            }),
        },
    )
    .delete(
        "/waitlist/:wId",
        async ({ user, params: { wId }, request }) =>
            bookingService.leaveWaitlist(wId, user.id, requestCorrelationId(request)),
        { auth: true },
    )
    .get(
        "/:id/timeline",
        async ({ user, params: { id }, status }) => {
            if (user.role !== "adminRole") return status(403);
            return bookingService.getBookingTimeline(id, user.role);
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
        async ({ user, body, status: setStatus, request }) => {
            try {
                return await bookingService.createBooking({
                    userId: user.id,
                    roomId: body.roomId,
                    startTime: new Date(body.startTime),
                    endTime: new Date(body.endTime),
                    attendees: body.attendees,
                    purpose: body.purpose,
                    userRole: user.role ?? "userRole",
                    actor: {
                        type: user.role === "adminRole" ? "ADMIN" : "USER",
                        id: user.id,
                        correlationId: requestCorrelationId(request),
                    },
                });
            } catch (e: any) {
                if (["ROOM_OVERLAP", "USER_OVERLAP", "CONCURRENT_BOOKING_CONFLICT"].includes(e.code)) {
                    return setStatus(409, { error: e.message, code: e.code, alternatives: e.alternatives ?? [] });
                }
                return setStatus(400, { error: e.message ?? "Booking failed", code: e.code });
            }
        },
        {
            auth: true,
            body: t.Object({
                roomId: t.String(),
                startTime: t.String(),
                endTime: t.String(),
                attendees: t.Number({ minimum: 1, maximum: 500 }),
                purpose: t.Optional(t.String()),
            }),
        },
    )
    .patch(
        "/:id/cancel",
        async ({ user, params: { id }, body, request }) => {
            return bookingService.cancelBooking(
                id,
                user.id,
                user.role ?? "userRole",
                body?.cancelReason,
                requestCorrelationId(request),
            );
        },
        {
            auth: true,
            body: t.Optional(t.Object({ cancelReason: t.Optional(t.String()) })),
        },
    )
    .post(
        "/:id/qr",
        async ({ user, params: { id }, status, request }) => {
            try {
                return await bookingService.generateQr(
                    id,
                    user.id,
                    user.role ?? "userRole",
                    new Date(),
                    requestCorrelationId(request),
                );
            } catch (error) {
                return status(400, {
                    error: error instanceof Error ? error.message : "QR generation failed",
                    code: error instanceof CheckInPolicyError ? error.code : "QR_GENERATION_FAILED",
                });
            }
        },
        { auth: true },
    )
    .post(
        "/:id/checkout",
        async ({ user, params: { id }, status, request }) => {
            if (!["adminRole", "teacherRole"].includes(user.role ?? "")) return status(403);
            return bookingService.checkOut(id, {
                type: user.role === "adminRole" ? "ADMIN" : "USER",
                id: user.id,
                correlationId: requestCorrelationId(request),
            });
        },
        { auth: true },
    )
    .patch(
        "/:id/approve",
        async ({ user, params: { id }, status, request }) => {
            if (user.role !== "adminRole") return status(403);
            return bookingService.approveBooking(id, user.id, requestCorrelationId(request));
        },
        { auth: true },
    )
    .patch(
        "/:id/reject",
        async ({ user, params: { id }, body, status, request }) => {
            if (user.role !== "adminRole") return status(403);
            return bookingService.rejectBooking(id, user.id, body.reason, requestCorrelationId(request));
        },
        {
            auth: true,
            body: t.Object({ reason: t.String() }),
        },
    )
    .delete(
        "/:id",
        async ({ user, params: { id }, status, request }) => {
            if (user.role !== "adminRole") return status(403);
            return bookingService.forceDeleteBooking(id, user.id, requestCorrelationId(request));
        },
        { auth: true },
    );

export default bookingRoutes;
