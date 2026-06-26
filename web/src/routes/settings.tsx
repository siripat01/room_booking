import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "../lib/useCurrentUser";
import { sessionQuery } from "../lib/queries";
import { Navbar } from "../components/Navbar";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Bell, CheckCircle2, Loader2, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { Badge } from "../components/ui/badge";

export const Route = createFileRoute("/settings")({
  beforeLoad: async ({ context: { queryClient }, location }) => {
    if (typeof window === "undefined") return;
    try {
      const user = await queryClient.ensureQueryData(sessionQuery());
      if (!user) throw redirect({ to: "/", search: { redirect: location.pathname } });
    } catch (e: any) {
      if (e?.isRedirect) throw e;
      throw redirect({ to: "/", search: { redirect: location.pathname } });
    }
  },
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useCurrentUser();
  const qc = useQueryClient();
  const [tokenInput, setTokenInput] = useState("");
  const isPro = (user as any)?.plan === "PRO";

  const portalMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/subscription/portal", { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      const { url } = await res.json();
      return url as string;
    },
    onSuccess: (url) => { window.location.href = url; },
    onError: () => toast.error("เกิดข้อผิดพลาด"),
  });

  const { data: lineStatus, isLoading: lineLoading } = useQuery({
    queryKey: ["line-notify-status"],
    queryFn: async () => {
      const res = await fetch("/api/users/me/line-notify", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json() as Promise<{ connected: boolean }>;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (token: string) => {
      const res = await fetch("/api/users/me/line-notify", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token }),
      });
      if (!res.ok) throw new Error("Failed to save");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["line-notify-status"] });
      setTokenInput("");
      toast.success("บันทึก Line Notify Token แล้ว");
    },
    onError: () => toast.error("บันทึกไม่สำเร็จ"),
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/users/me/line-notify", { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["line-notify-status"] });
      toast.success("ยกเลิกการเชื่อมต่อ Line Notify แล้ว");
    },
    onError: () => toast.error("เกิดข้อผิดพลาด"),
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/users/me/line-notify/test", { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => toast.success("ส่ง test notification แล้ว กรุณาตรวจสอบ Line ของคุณ"),
    onError: () => toast.error("ส่งไม่สำเร็จ"),
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar user={user} />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">จัดการการแจ้งเตือนและการตั้งค่าส่วนตัว</p>
        </div>

        {/* Subscription */}
        <div className="bg-white rounded-xl border shadow-sm p-6 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-800">Subscription</h2>
              <p className="text-xs text-muted-foreground">แผนการใช้งานของคุณ</p>
            </div>
            <div className="ml-auto">
              {isPro
                ? <Badge className="bg-blue-600 text-white">Pro</Badge>
                : <Badge variant="secondary">Free</Badge>}
            </div>
          </div>
          {isPro ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">คุณใช้งาน <strong>Pro plan</strong> อยู่ — จองล่วงหน้าได้ 30 วัน, สูงสุด 10 รายการ, รับการแจ้งเตือน Email + Line</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => portalMutation.mutate()}
                disabled={portalMutation.isPending}
              >
                {portalMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                จัดการ Subscription
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">คุณใช้งาน <strong>Free plan</strong> — จองล่วงหน้าได้ 3 วัน, สูงสุด 3 รายการพร้อมกัน</p>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700" asChild>
                <Link to="/pricing">อัปเกรดเป็น Pro →</Link>
              </Button>
            </div>
          )}
        </div>

        {/* Line Notify */}
        <div className="bg-white rounded-xl border shadow-sm p-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-800">Line Notify</h2>
              <p className="text-xs text-muted-foreground">รับการแจ้งเตือนการจองผ่าน Line</p>
            </div>
            {lineStatus?.connected && (
              <span className="ml-auto flex items-center gap-1 text-xs text-emerald-600 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> เชื่อมต่อแล้ว
              </span>
            )}
          </div>

          <div className="mt-5 space-y-4">
            {lineLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : lineStatus?.connected ? (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => testMutation.mutate()}
                  disabled={testMutation.isPending}
                >
                  {testMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                  ทดสอบการแจ้งเตือน
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => disconnectMutation.mutate()}
                  disabled={disconnectMutation.isPending}
                  className="text-red-600 border-red-200 hover:bg-red-50"
                >
                  {disconnectMutation.isPending
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <><Trash2 className="w-3.5 h-3.5 mr-1.5" />ยกเลิกการเชื่อมต่อ</>}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-lg bg-slate-50 border p-3 text-sm text-slate-600 space-y-1">
                  <p className="font-medium">วิธีขอ Token:</p>
                  <ol className="list-decimal list-inside space-y-0.5 text-xs text-muted-foreground">
                    <li>ไปที่ notify.line.me แล้ว login ด้วย Line account</li>
                    <li>เลือก "Generate token" แล้วตั้งชื่อ เช่น "Room Booking"</li>
                    <li>เลือก "1-on-1 chat with LINE Notify"</li>
                    <li>Copy token แล้วนำมาวางด้านล่าง</li>
                  </ol>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="line-token">Line Notify Token</Label>
                  <div className="flex gap-2">
                    <Input
                      id="line-token"
                      type="password"
                      placeholder="วาง token ที่นี่…"
                      value={tokenInput}
                      onChange={(e) => setTokenInput(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      onClick={() => tokenInput.trim() && saveMutation.mutate(tokenInput.trim())}
                      disabled={saveMutation.isPending || !tokenInput.trim()}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "บันทึก"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
