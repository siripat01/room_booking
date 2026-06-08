import { APIError, betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "./db";
import { openAPI } from "better-auth/plugins";
import { hashPassword, verifyPassword } from "../utils/password";
import { dash } from "@better-auth/infra";
import { redirect } from "elysia";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  baseURL: {
    allowedHosts: ["http://localhost:3000", "http://localhost:3001"],
    protocol: "http",
    fallback: "http://localhost:3001",
  },
  basePath: "/api/auth",
  plugins: [
    openAPI(),
    // dash({
    //   apiKey: process.env.BETTER_AUTH_API_KEY,
    //   activityTracking: {
    //     enabled: true,
    //     updateInterval: 300000, // Update interval in ms (default: 5 minutes)
    //   },
    // }),
  ],

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
        // ดักเช็ค "ก่อน" ที่จะทำการสร้าง User ใหม่ในระบบ
        before: async (user) => {
          // ตรวจสอบว่า email ลงท้ายด้วย @kmitl.ac.th หรือไม่
          if (!user.email.endsWith("@kmitl.ac.th")) {
            // ส่ง Error กลับไปหาผู้ใช้ และยกเลิกการสมัครสมาชิก
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
