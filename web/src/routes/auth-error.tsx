import { createFileRoute, useSearch } from "@tanstack/react-router";
import { ErrorPage } from "../components/ErrorPage";

export const Route = createFileRoute("/auth-error")({
  validateSearch: (search: Record<string, unknown>) => ({
    reason: (search.reason as string | undefined) ?? "domain",
  }),
  component: AuthErrorPage,
});

function AuthErrorPage() {
  const { reason } = useSearch({ from: "/auth-error" });

  if (reason === "domain") {
    return <ErrorPage type="auth-domain" />;
  }

  return <ErrorPage type="generic" title="เข้าสู่ระบบไม่สำเร็จ" description="กรุณาลองใหม่อีกครั้ง" />;
}
