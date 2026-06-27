import Elysia, { t } from "elysia";
import { betterAuth } from "../middleware/auth.middleware";
import { UserService } from "./user.service";
import prisma from "../../libs/db";
import { sendLineNotify } from "../lib/lineNotify";

const userService = new UserService(prisma);

const userRoutes = new Elysia({ prefix: "/users" })
  .use(betterAuth)
  // ── Self-service Line Notify (any authenticated user) ──────────────────────
  .get("/me/line-notify", async ({ user, status }) => {
    if (!user) return status(401);
    const u = await prisma.user.findUnique({ where: { id: user.id }, select: { lineNotifyToken: true } });
    return { connected: !!u?.lineNotifyToken };
  }, { auth: true })
  .put("/me/line-notify", async ({ user, body, status }) => {
    if (!user) return status(401);
    await prisma.user.update({ where: { id: user.id }, data: { lineNotifyToken: body.token } });
    return { success: true };
  }, { auth: true, body: t.Object({ token: t.String() }) })
  .delete("/me/line-notify", async ({ user, status }) => {
    if (!user) return status(401);
    await prisma.user.update({ where: { id: user.id }, data: { lineNotifyToken: null } });
    return { success: true };
  }, { auth: true })
  .get("/me/plan", async ({ user, status }) => {
    if (!user) return status(401);
    const u = await prisma.user.findUnique({ where: { id: user.id }, select: { plan: true, planExpiresAt: true } });
    return { plan: u?.plan ?? "FREE", planExpiresAt: u?.planExpiresAt ?? null };
  }, { auth: true })
  .post("/me/line-notify/test", async ({ user, status: setStatus }) => {
    if (!user) return setStatus(401);
    const u = await prisma.user.findUnique({ where: { id: user.id }, select: { lineNotifyToken: true } });
    if (!u?.lineNotifyToken) return setStatus(400, { error: "No Line Notify token configured" });
    await sendLineNotify(u.lineNotifyToken, "🔔 ทดสอบการแจ้งเตือน Room Booking สำเร็จ!");
    return { success: true };
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
