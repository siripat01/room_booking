import { Elysia } from "elysia";
import { auth } from "../../libs/auth";

export const betterAuth = new Elysia({ name: "better-auth" })
  .mount(auth.handler)
  .macro({
    auth: {
      async resolve({ status, request: { headers } }) {
        const session = await auth.api.getSession({ headers });
        if (!session) return status(401);

        // getSession reads the current user row, including the Better Auth admin
        // plugin's ban fields. Avoid a second sequential user lookup on every API
        // request; the session lookup remains the source of truth.
        const user = session.user as typeof session.user & { banned?: boolean | null; banReason?: string | null };
        if (user.banned) {
          return status(403, { error: "banned", reason: user.banReason ?? "ไม่ระบุเหตุผล" });
        }

        return {
          user,
          session: session.session,
        };
      },
    },
  });
