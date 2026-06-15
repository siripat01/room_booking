import { Elysia, Context } from "elysia";
import { cors } from "@elysiajs/cors";
import { openapi } from "@elysia/openapi";
import { OpenAPI } from "../libs/auth";
import { betterAuth } from "./middleware/auth.middleware";
import authRoutes from "./auth/auth.route";
import roomRoutes from "./room/room.route";

const app = new Elysia({ prefix: "/api" })
  .use(
    cors({
      origin: process.env.NODE_ENV === "production"
        ? [process.env.FRONTEND_URL || "http://localhost:3001"]
        : true,
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  )
  .use(
    openapi({
      documentation: {
        components: await OpenAPI.components,
        paths: await OpenAPI.getPaths(),
      },
    }),
  )
  .use(betterAuth)
  .use(roomRoutes)
  .use(authRoutes)
  .all("/health", () => "Healthy as fuck")
  .all("/version", () => process.env.APP_VERSION)
  .listen(3000);

export type App = typeof app;

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
