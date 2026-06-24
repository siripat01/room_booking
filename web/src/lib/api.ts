import { treaty } from "@elysiajs/eden";
import type { App } from "../../../api/src/index";

const getApiUrl = () => {
  if (typeof window !== "undefined") {
    return import.meta.env.VITE_API_URL || "http://localhost:3000";
  }
  return process.env.API_URL || "http://localhost:3000";
};

async function fetchWithBanCheck(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status === 403) {
    const clone = res.clone();
    try {
      const body = await clone.json();
      if (body?.error === "banned" && typeof window !== "undefined") {
        const reason = encodeURIComponent(body.reason ?? "");
        window.location.href = `/banned?reason=${reason}`;
      }
    } catch {}
  }
  return res;
}

export const app = treaty<App>(getApiUrl(), {
  fetch: { credentials: "include" },
  fetcher: fetchWithBanCheck,
});
