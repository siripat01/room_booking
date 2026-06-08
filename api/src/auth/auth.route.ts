import Elysia from "elysia"
import { betterAuth } from "../middleware/auth.middleware"

const authRoutes = new Elysia({ prefix: "/auth" })
    .use(betterAuth)
    .get("/me", ({ user }) => {
        return user;
    }, {
        auth: true
    })


export default authRoutes