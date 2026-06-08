import { treaty } from "@elysiajs/eden";
import type { App } from "../../../api/src/index";

// Detect if we are running in the browser or during SSR/Server context
const getApiUrl = () => {
  if (typeof window !== "undefined") {
    // Client-side environment variables in Vite/TanStack Start
    return import.meta.env.VITE_API_URL || "http://localhost:3000";
  }
  // Server-side (SSR) environment variables
  return process.env.API_URL || "http://localhost:3000";
};

export const api = treaty<App>(getApiUrl());
