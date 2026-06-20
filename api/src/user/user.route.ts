import Elysia, { t } from "elysia";
import { betterAuth } from "../middleware/auth.middleware";
import { UserService } from "./user.service";
import prisma from "../../libs/db";

const userService = new UserService(prisma);

const userRoutes = new Elysia({ prefix: "/users" })
  .use(betterAuth)
  .get(
    "/",
    async ({ user, status }) => {
      if (user.role !== "adminRole") return status(403);
      return userService.getUsers();
    },
    { auth: true },
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
