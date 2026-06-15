import { APIError, betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "./db";
import { admin, openAPI } from "better-auth/plugins";
import { hashPassword, verifyPassword } from "../utils/password";


import { ac, teacherRole, userRole, adminRole } from "./permission";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  baseURL: {
    allowedHosts: ["http://localhost:3000", "http://localhost:3001"],
    protocol: "http",
    fallback: "http://localhost:300",
  },

  trustedOrigins: [
    process.env.FRONTEND_URL as string],

  basePath: "/api/auth",
  plugins: [
    openAPI(),
    admin({
      ac,
      roles: {
        userRole,
        teacherRole,
        adminRole,
      },
      adminRoles: ["adminRole"],
      defaultRole: "userRole",
    })
  ],

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 วัน
    updateAge: 60 * 60 * 24,     // อัปเดตทุก 24 ชม.
  },

  secret: process.env.BETTER_AUTH_SECRET as string,

  emailAndPassword: {
    enabled: true,
    password: {
      hash: hashPassword,
      verify: verifyPassword,
    },
  },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if (!user.email.endsWith("@kmitl.ac.th")) {
            throw new APIError("BAD_REQUEST", {
              message: "Only KMITL email accounts are allowed to sign up.",
            });
          }

          return { data: user };
        },
      },
    },
  },
});

let _schema: ReturnType<typeof auth.api.generateOpenAPISchema>;
const getSchema = async () => (_schema ??= auth.api.generateOpenAPISchema());
export const OpenAPI = {
  getPaths: (prefix = "/api/auth") =>
    getSchema().then(({ paths }) => {
      const reference: typeof paths = Object.create(null);
      for (const path of Object.keys(paths)) {
        const key = prefix + path;
        reference[key] = paths[path];
        for (const method of Object.keys(paths[path])) {
          const operation = (reference[key] as any)[method];
          operation.tags = ["Better Auth"];
        }
      }
      return reference;
    }) as Promise<any>,
  components: getSchema().then(({ components }) => components) as Promise<any>,
} as const;
