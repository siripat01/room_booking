import { Elysia } from "elysia";
import { auth } from "../../libs/auth";
import prisma from "../../libs/db";

export const betterAuth = new Elysia({ name: "better-auth" })
  .mount(auth.handler)
  .macro({
    auth: {
      async resolve({ status, request: { headers } }) {
        const session = await auth.api.getSession({ headers });
        if (!session) return status(401);

        const dbUser = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { banned: true, banReason: true },
        });
        if (dbUser?.banned) {
          return status(403, { error: "banned", reason: dbUser.banReason ?? "ไม่ระบุเหตุผล" });
        }

        return {
          user: session.user,
          session: session.session,
        };
      },
    },
  });
