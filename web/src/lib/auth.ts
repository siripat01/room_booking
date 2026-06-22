import { createAuthClient } from "better-auth/client";
import { adminClient } from "better-auth/client/plugins";

const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

export const authClient = createAuthClient({
    baseURL: `${backendUrl}/api/auth`,
    plugins: [
        adminClient()
    ]
})