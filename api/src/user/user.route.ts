import Elysia, { t } from "elysia";
import { betterAuth } from "../middleware/auth.middleware";
import { UserService } from "./user.service";
import prisma from "../../libs/db";
import { NotificationService } from "../notification/notification.service";
import { LineLinkService } from "../notification/line-link.service";
import { DatabaseRateLimiter } from "../lib/database-rate-limiter";

const userService = new UserService(prisma);
const notificationService = new NotificationService(prisma);
const lineLinkService = new LineLinkService(prisma);
const limiter = new DatabaseRateLimiter(prisma);

const userRoutes = new Elysia({ prefix: "/users" })
  .use(betterAuth)
  // ── Self-service notification preferences and LINE Messaging link ─────────
  .get("/me/notifications", async ({ user, status }) => {
    if (!user) return status(401);
    const [preferences, line] = await Promise.all([
      notificationService.getPreferences(user.id),
      lineLinkService.getStatus(user.id),
    ]);
    return { preferences, line };
  }, { auth: true })
  .patch("/me/notifications/preferences", async ({ user, body, status }) => {
    if (!user) return status(401);
    return notificationService.updatePreferences(user.id, body);
  }, {
    auth: true,
    body: t.Object({
      emailEnabled: t.Optional(t.Boolean()),
      lineEnabled: t.Optional(t.Boolean()),
      bookingUpdatesEnabled: t.Optional(t.Boolean()),
      reminder30Enabled: t.Optional(t.Boolean()),
      checkInReminderEnabled: t.Optional(t.Boolean()),
      waitlistEnabled: t.Optional(t.Boolean()),
    }),
  })
  .post("/me/line-link", async ({ user, status }) => {
    if (!user) return status(401);
    const rate = await limiter.consume("line-link-create", user.id, 5, 10 * 60);
    if (!rate.allowed) {
      return status(429, { error: "Too many LINE link attempts", retryAfterSeconds: rate.retryAfterSeconds });
    }
    try {
      return await lineLinkService.createCode(user.id);
    } catch (error) {
      return status(400, { error: error instanceof Error ? error.message : "Unable to create LINE link code" });
    }
  }, { auth: true })
  .delete("/me/line-link", async ({ user, status }) => {
    if (!user) return status(401);
    return lineLinkService.disconnect(user.id);
  }, { auth: true })
  .get("/me/plan", async ({ user, status }) => {
    if (!user) return status(401);
    const u = await prisma.user.findUnique({ where: { id: user.id }, select: { plan: true, planExpiresAt: true } });
    return { plan: u?.plan ?? "FREE", planExpiresAt: u?.planExpiresAt ?? null };
  }, { auth: true })
  .post("/me/notifications/test", async ({ user, status }) => {
    if (!user) return status(401);
    const rate = await limiter.consume("notification-test", user.id, 5, 10 * 60);
    if (!rate.allowed) {
      return status(429, { error: "Too many test notifications", retryAfterSeconds: rate.retryAfterSeconds });
    }
    const queued = await notificationService.enqueueTest(user.id);
    return { queued };
  }, { auth: true })
  // ── Admin-only ─────────────────────────────────────────────────────────────
  .guard({ auth: true }, (app) =>
    app
      .onBeforeHandle(({ user, status }) => {
        if (user.role !== "adminRole") return status(403);
      })
      .get("/", ({ query }) =>
        userService.getUsers({
          search: query.search,
          role: query.role,
          isBanned: query.isBanned !== undefined ? query.isBanned === "true" : undefined,
          page: query.page ? Number(query.page) : undefined,
          limit: query.limit ? Number(query.limit) : undefined,
        }), {
          query: t.Object({
            search: t.Optional(t.String()),
            role: t.Optional(t.String()),
            isBanned: t.Optional(t.String()),
            page: t.Optional(t.String()),
            limit: t.Optional(t.String()),
          }),
        },
      )
      .get("/:id", ({ params: { id } }) => userService.getUserById(id))
      .patch("/:id", ({ params: { id }, body }) => userService.updateUser(id, body), {
        body: t.Object({
          name: t.Optional(t.String()),
          image: t.Optional(t.String()),
        }),
      })
      .delete("/:id", ({ params: { id } }) => userService.deleteUser(id))
      .get("/:id/bookings", ({ params: { id }, query }) =>
        userService.getUserBookings(id, {
          page: query.page ? Number(query.page) : undefined,
          limit: query.limit ? Number(query.limit) : undefined,
        }), {
          query: t.Object({
            page: t.Optional(t.String()),
            limit: t.Optional(t.String()),
          }),
        },
      )
      .patch("/:id/role", ({ params: { id }, body }) => userService.updateUserRole(id, body.role), {
        body: t.Object({ role: t.String() }),
      })
      .patch("/:id/ban", ({ params: { id }, body }) => userService.banUser(id, body.reason), {
        body: t.Object({ reason: t.String() }),
      })
      .patch("/:id/unban", ({ params: { id } }) => userService.unbanUser(id))
  );

export default userRoutes;
