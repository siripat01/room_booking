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
    .guard({ auth: true }, (app) =>
        app
            .onBeforeHandle(({ user, status }) => {
                if (user.role !== "adminRole") return status(403);
            })
            .get("/overview", ({ query }) =>
                reportService.getOverview(query.from, query.to, query.roomId), { query: QUERY })
            .get("/rooms/usage", ({ query }) =>
                reportService.getRoomUsage(query.from, query.to, query.roomId), { query: QUERY })
            .get("/bookings-summary", ({ query }) =>
                reportService.getBookingsSummary(query.from, query.to, query.roomId), { query: QUERY })
            .get("/peak-hours", ({ query }) =>
                reportService.getPeakHours(query.from, query.to, query.roomId), { query: QUERY })
            .get("/users/active", ({ query }) =>
                reportService.getActiveUsers(query.from, query.to), {
                query: t.Object({ from: t.Optional(t.String()), to: t.Optional(t.String()) }),
            })
    );

export default reportRoutes;
