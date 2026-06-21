import Elysia, { t } from "elysia"
import { betterAuth } from "../middleware/auth.middleware"
import prisma from "../../libs/db"

const authRoutes = new Elysia({ prefix: "/auth" })
    .use(betterAuth)
    .get("/me", ({ user }) => {
        return user;
    }, {
        auth: true
    })
    .patch("/me", async ({ user, body }) => {
        return prisma.user.update({
            where: { id: user.id },
            data: body,
            select: { id: true, name: true, email: true, image: true, role: true },
        });
    }, {
        auth: true,
        body: t.Object({
            name: t.Optional(t.String({ minLength: 1 })),
            image: t.Optional(t.String()),
        }),
    })

export default authRoutes
