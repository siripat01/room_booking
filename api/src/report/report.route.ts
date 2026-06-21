import Elysia, { t } from "elysia";
import { betterAuth } from "../middleware/auth.middleware";
import { ReportService } from "./report.service";
import prisma from "../../libs/db";

const reportService = new ReportService(prisma);

const QUERY = t.Object({
    from: t.Optional(t.String()),
    to: t.Optional(t.String()),
    roomId: t.Optional(t.String()),
});

const reportRoutes = new Elysia({ prefix: "/reports" })
    .use(betterAuth)
    .get("/overview", async ({ user, query, status }) => {
        if (user.role !== "adminRole") return status(403);
        return reportService.getOverview(query.from, query.to, query.roomId);
    }, { auth: true, query: QUERY })
    .get("/rooms/usage", async ({ user, query, status }) => {
        if (user.role !== "adminRole") return status(403);
        return reportService.getRoomUsage(query.from, query.to, query.roomId);
    }, { auth: true, query: QUERY })
    .get("/bookings-summary", async ({ user, query, status }) => {
        if (user.role !== "adminRole") return status(403);
        return reportService.getBookingsSummary(query.from, query.to, query.roomId);
    }, { auth: true, query: QUERY })
    .get("/peak-hours", async ({ user, query, status }) => {
        if (user.role !== "adminRole") return status(403);
        return reportService.getPeakHours(query.from, query.to, query.roomId);
    }, { auth: true, query: QUERY })
    .get("/users/active", async ({ user, query, status }) => {
        if (user.role !== "adminRole") return status(403);
        return reportService.getActiveUsers(query.from, query.to);
    }, {
        auth: true,
        query: t.Object({ from: t.Optional(t.String()), to: t.Optional(t.String()) }),
    });

export default reportRoutes;
