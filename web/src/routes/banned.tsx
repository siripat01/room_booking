import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { authClient } from "../lib/auth";
import { Button } from "../components/ui/button";
import { ShieldBan, LogOut } from "lucide-react";

export const Route = createFileRoute("/banned")({
  validateSearch: (search: Record<string, unknown>) => ({
    reason: (search.reason as string | undefined) ?? "",
  }),
  component: BannedPage,
});

function BannedPage() {
  const { reason } = Route.useSearch();
  const navigate = useNavigate();

  async function handleSignOut() {
    await authClient.signOut();
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md text-center">
        <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-6 border border-red-100">
          <ShieldBan className="w-9 h-9 text-red-500" />
        </div>

        <div className="text-6xl font-black text-slate-200 mb-2 leading-none">BAN</div>

        <h1 className="text-xl font-bold text-slate-800 mb-2">บัญชีของคุณถูกระงับ</h1>
        <p className="text-muted-foreground text-sm mb-2">คุณไม่สามารถใช้งานระบบได้ในขณะนี้</p>

        {reason && (
          <div className="mt-4 mb-8 bg-red-50 border border-red-100 rounded-xl px-5 py-4 text-left">
            <p className="text-xs font-semibold text-red-600 mb-1 uppercase tracking-wide">เหตุผล</p>
            <p className="text-sm text-slate-700">{reason}</p>
          </div>
        )}

        {!reason && <div className="mb-8" />}

        <p className="text-xs text-muted-foreground mb-6">
          หากคิดว่าเป็นความผิดพลาด กรุณาติดต่อผู้ดูแลระบบ
        </p>

        <Button onClick={handleSignOut} variant="outline" className="gap-2">
          <LogOut className="w-4 h-4" /> ออกจากระบบ
        </Button>
      </div>
    </div>
  );
}
