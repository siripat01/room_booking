import Elysia, { t } from "elysia";
import { betterAuth } from "../middleware/auth.middleware";
import { UserService } from "./user.service";
import prisma from "../../libs/db";

const userService = new UserService(prisma);

const userRoutes = new Elysia({ prefix: "/users" })
  .use(betterAuth)
  .get(
    "/",
    async ({ user, query, status }) => {
      if (user.role !== "adminRole") return status(403);
      return userService.getUsers({
        search: query.search,
        role: query.role,
        isBanned: query.isBanned !== undefined ? query.isBanned === "true" : undefined,
        page: query.page ? Number(query.page) : undefined,
        limit: query.limit ? Number(query.limit) : undefined,
      });
    },
    {
      auth: true,
      query: t.Object({
        search: t.Optional(t.String()),
        role: t.Optional(t.String()),
        isBanned: t.Optional(t.String()),
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
    },
  )
  .get(
    "/:id",
    async ({ user, params: { id }, status }) => {
      if (user.role !== "adminRole") return status(403);
      return userService.getUserById(id);
    },
    { auth: true },
  )
  .patch(
    "/:id",
    async ({ user, params: { id }, body, status }) => {
      if (user.role !== "adminRole") return status(403);
      return userService.updateUser(id, body);
    },
    {
      auth: true,
      body: t.Object({
        name: t.Optional(t.String()),
        image: t.Optional(t.String()),
      }),
    },
  )
  .delete(
    "/:id",
    async ({ user, params: { id }, status }) => {
      if (user.role !== "adminRole") return status(403);
      return userService.deleteUser(id);
    },
    { auth: true },
  )
  .get(
    "/:id/bookings",
    async ({ user, params: { id }, query, status }) => {
      if (user.role !== "adminRole") return status(403);
      return userService.getUserBookings(id, {
        page: query.page ? Number(query.page) : undefined,
        limit: query.limit ? Number(query.limit) : undefined,
      });
    },
    {
      auth: true,
      query: t.Object({
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
    },
  )
  .patch(
    "/:id/role",
    async ({ user, params: { id }, body, status }) => {
      if (user.role !== "adminRole") return status(403);
      return userService.updateUserRole(id, body.role);
    },
    {
      auth: true,
      body: t.Object({ role: t.String() }),
    },
  )
  .patch(
    "/:id/ban",
    async ({ user, params: { id }, body, status }) => {
      if (user.role !== "adminRole") return status(403);
      return userService.banUser(id, body.reason);
    },
    {
      auth: true,
      body: t.Object({ reason: t.String() }),
    },
  )
  .patch(
    "/:id/unban",
    async ({ user, params: { id }, status }) => {
      if (user.role !== "adminRole") return status(403);
      return userService.unbanUser(id);
    },
    { auth: true },
  );

export default userRoutes;
