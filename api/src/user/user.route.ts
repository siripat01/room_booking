import Elysia, { t } from "elysia";
import { betterAuth } from "../middleware/auth.middleware";
import { UserService } from "./user.service";
import prisma from "../../libs/db";

const userService = new UserService(prisma);

const userRoutes = new Elysia({ prefix: "/users" })
  .use(betterAuth)
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
