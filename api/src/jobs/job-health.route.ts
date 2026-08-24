import Elysia from "elysia";
import prisma from "../../libs/db";
import { betterAuth } from "../middleware/auth.middleware";
import { JobHealthService } from "./job-health.service";

const health = new JobHealthService(prisma);

export const jobHealthRoutes = new Elysia({ prefix: "/operations/jobs" }).use(betterAuth).get(
  "/health",
  async ({ user, status }) => {
    if (user.role !== "adminRole") return status(403);
    return health.getSnapshot();
  },
  { auth: true },
);
