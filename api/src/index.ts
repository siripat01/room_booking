import { Elysia, Context } from "elysia";
import { openapi } from "@elysia/openapi";
import { OpenAPI } from "../libs/auth";
import { betterAuth } from "./middleware/auth.middleware";

const app = new Elysia({ prefix: "/api" })
  .use(
    openapi({
      documentation: {
        components: await OpenAPI.components,
        paths: await OpenAPI.getPaths(),
      },
    }),
  )
  .use(betterAuth)
  .get("/", () => "Hello Elysia")
  .listen(3000);

export type App = typeof app;

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
