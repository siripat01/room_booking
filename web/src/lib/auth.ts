import { createAuthClient } from "better-auth/client";
import { adminClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
    baseURL: `${import.meta.env.VITE_BACKEND_URL}/api/auth`,
    plugins: [
        adminClient()
    ]
})