import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  CheckCircle2,
  Copy,
  ExternalLink,
  Link2,
  Loader2,
  Mail,
  MessageCircle,
  Trash2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Navbar } from "../components/Navbar";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import { sessionQuery } from "../lib/queries";
import { useCurrentUser } from "../lib/useCurrentUser";
import { useTitle } from "../lib/useTitle";

export const Route = createFileRoute("/settings")({
  beforeLoad: async ({ context: { queryClient }, location }) => {
    if (typeof window === "undefined") return;
    try {
      const user = await queryClient.ensureQueryData(sessionQuery());
      if (!user) throw redirect({ to: "/", search: { redirect: location.pathname } });
    } catch (error: any) {
      if (error?.isRedirect) throw error;
      throw redirect({ to: "/", search: { redirect: location.pathname } });
    }
  },
  component: SettingsPage,
});

type NotificationPreferences = {
  emailEnabled: boolean;
  lineEnabled: boolean;
  bookingUpdatesEnabled: boolean;
  reminder30Enabled: boolean;
  checkInReminderEnabled: boolean;
  waitlistEnabled: boolean;
};

type NotificationSettings = {
  preferences: NotificationPreferences;
  line: {
    connected: boolean;
    botBasicId: string | null;
    addFriendUrl: string | null;
  };
};

type LinkCode = {
  code: string;
  expiresAt: string;
  botBasicId: string | null;
  addFriendUrl: string | null;
};

const preferenceOptions: Array<{
  key: keyof NotificationPreferences;
  title: string;
  description: string;
}> = [
  { key: "bookingUpdatesEnabled", title: "Booking updates", description: "แจ้งเมื่อการจองได้รับอนุมัติหรือถูกปฏิเสธ" },
  { key: "reminder30Enabled", title: "30-minute reminder", description: "แจ้งเตือนก่อนเวลาเริ่ม 30 นาที" },
  { key: "checkInReminderEnabled", title: "Check-in reminder", description: "แจ้งเมื่อเข้าสู่ช่วงเวลาเช็คอิน" },
  { key: "waitlistEnabled", title: "Waitlist promotion", description: "แจ้งเมื่อได้รับห้องจากรายการรอ" },
];

function SettingsPage() {
  useTitle("Settings");
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const [linkCode, setLinkCode] = useState<LinkCode | null>(null);

  const { data: planData } = useQuery({
    queryKey: ["my-plan"],
    queryFn: async () => {
      const response = await fetch("/api/users/me/plan", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to load plan");
      return response.json() as Promise<{ plan: string; planExpiresAt: string | null }>;
    },
  });

  const { data: notificationSettings, isLoading: notificationsLoading } = useQuery({
    queryKey: ["notification-settings"],
    queryFn: async () => {
      const response = await fetch("/api/users/me/notifications", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to load notification settings");
      return response.json() as Promise<NotificationSettings>;
    },
    refetchInterval: linkCode ? 5_000 : false,
  });

  useEffect(() => {
    if (linkCode && notificationSettings?.line.connected) {
      setLinkCode(null);
      toast.success("เชื่อมต่อ LINE Messaging สำเร็จแล้ว");
    }
  }, [linkCode, notificationSettings?.line.connected]);

  const isPro = planData?.plan === "PRO";
  const cancelledAt = planData?.planExpiresAt ? new Date(planData.planExpiresAt) : null;

  const portalMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/subscription/portal", { method: "POST", credentials: "include" });
      if (!response.ok) throw new Error("Failed to open subscription portal");
      const { url } = await response.json();
      return url as string;
    },
    onSuccess: (url) => { window.location.href = url; },
    onError: () => toast.error("เกิดข้อผิดพลาด"),
  });

  const preferenceMutation = useMutation({
    mutationFn: async (update: Partial<NotificationPreferences>) => {
      const response = await fetch("/api/users/me/notifications/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(update),
      });
      if (!response.ok) throw new Error("Failed to update notification preferences");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notification-settings"] }),
    onError: () => toast.error("บันทึกการตั้งค่าไม่สำเร็จ"),
  });

  const createLinkMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/users/me/line-link", { method: "POST", credentials: "include" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Failed to create link code");
      return data as LinkCode;
    },
    onSuccess: setLinkCode,
    onError: (error) => toast.error(error.message),
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/users/me/line-link", { method: "DELETE", credentials: "include" });
      if (!response.ok) throw new Error("Failed to disconnect LINE");
    },
    onSuccess: () => {
      setLinkCode(null);
      queryClient.invalidateQueries({ queryKey: ["notification-settings"] });
      toast.success("ยกเลิกการเชื่อมต่อ LINE แล้ว");
    },
    onError: () => toast.error("ยกเลิกการเชื่อมต่อไม่สำเร็จ"),
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/users/me/notifications/test", { method: "POST", credentials: "include" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Failed to queue notification");
      return data as { queued: number };
    },
    onSuccess: ({ queued }) => toast.success(queued > 0 ? `เพิ่มการแจ้งเตือนทดสอบ ${queued} รายการในคิวแล้ว` : "ไม่มีช่องทางที่เปิดใช้งาน"),
    onError: (error) => toast.error(error.message),
  });

  const copyLinkCommand = async () => {
    if (!linkCode) return;
    await navigator.clipboard.writeText(`LINK ${linkCode.code}`);
    toast.success("คัดลอกคำสั่งเชื่อมต่อแล้ว");
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar user={user} />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-4">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">จัดการการแจ้งเตือนและการตั้งค่าส่วนตัว</p>
        </div>

        <section className="bg-white rounded-xl border shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-800">Subscription</h2>
              <p className="text-xs text-muted-foreground">แผนการใช้งานของคุณ</p>
            </div>
            <div className="ml-auto">
              {isPro ? <Badge className="bg-blue-600 text-white">Pro</Badge> : <Badge variant="secondary">Free</Badge>}
            </div>
          </div>
          {isPro ? (
            <div className="space-y-3">
              {cancelledAt ? (
                <p className="text-sm text-slate-600">
                  คุณยกเลิก Pro แล้ว — ยังใช้งานได้จนถึง <strong className="text-amber-600">
                    {cancelledAt.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })}
                  </strong>
                </p>
              ) : (
                <p className="text-sm text-slate-600">คุณใช้งาน <strong>Pro plan</strong> อยู่ — รับการแจ้งเตือน Email และ LINE Messaging ตาม preferences ด้านล่าง</p>
              )}
              <Button variant="outline" size="sm" onClick={() => portalMutation.mutate()} disabled={portalMutation.isPending}>
                {portalMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                {cancelledAt ? "ต่ออายุ Subscription" : "จัดการ Subscription"}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">คุณใช้งาน <strong>Free plan</strong> — การแจ้งเตือนการจองอัตโนมัติยังเป็นสิทธิ์ของ Pro ตามพฤติกรรมเดิม</p>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700" asChild>
                <Link to="/pricing">อัปเกรดเป็น Pro →</Link>
              </Button>
            </div>
          )}
        </section>

        <section className="bg-white rounded-xl border shadow-sm p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-800">Notification preferences</h2>
              <p className="text-xs text-muted-foreground">เลือกช่องทางและเหตุการณ์ที่ต้องการรับ</p>
            </div>
          </div>
          {notificationsLoading || !notificationSettings ? (
            <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="space-y-5">
              <div className="grid sm:grid-cols-2 gap-3">
                {([
                  ["emailEnabled", "Email", "ส่งผ่าน Resend", Mail],
                  ["lineEnabled", "LINE Messaging", "ส่งผ่าน RoomFlow bot", MessageCircle],
                ] as const).map(([key, title, description, Icon]) => (
                  <label key={key} className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer">
                    <Checkbox
                      checked={notificationSettings.preferences[key]}
                      onCheckedChange={(checked) => preferenceMutation.mutate({ [key]: checked === true })}
                      disabled={preferenceMutation.isPending}
                      className="mt-0.5"
                    />
                    <Icon className="w-4 h-4 mt-0.5 text-slate-500" />
                    <span><span className="block text-sm font-medium">{title}</span><span className="block text-xs text-muted-foreground">{description}</span></span>
                  </label>
                ))}
              </div>
              <div className="space-y-1">
                {preferenceOptions.map((option) => (
                  <label key={option.key} className="flex items-start gap-3 rounded-lg p-2.5 hover:bg-slate-50 cursor-pointer">
                    <Checkbox
                      checked={notificationSettings.preferences[option.key]}
                      onCheckedChange={(checked) => preferenceMutation.mutate({ [option.key]: checked === true })}
                      disabled={preferenceMutation.isPending}
                      className="mt-0.5"
                    />
                    <span><span className="block text-sm font-medium text-slate-700">{option.title}</span><span className="block text-xs text-muted-foreground">{option.description}</span></span>
                  </label>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={() => testMutation.mutate()} disabled={testMutation.isPending}>
                {testMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                ทดสอบช่องทางที่เปิดอยู่
              </Button>
            </div>
          )}
        </section>

        <section className="bg-white rounded-xl border shadow-sm p-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
              <MessageCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-800">LINE Messaging</h2>
              <p className="text-xs text-muted-foreground">เชื่อมบัญชีกับ RoomFlow bot โดยไม่เก็บ access token ของผู้ใช้</p>
            </div>
            {notificationSettings?.line.connected && (
              <span className="ml-auto flex items-center gap-1 text-xs text-emerald-600 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> เชื่อมต่อแล้ว
              </span>
            )}
          </div>

          <div className="mt-5">
            {notificationsLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : notificationSettings?.line.connected ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                {disconnectMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Trash2 className="w-3.5 h-3.5 mr-1.5" />ยกเลิกการเชื่อมต่อ</>}
              </Button>
            ) : linkCode ? (
              <div className="space-y-4">
                <div className="rounded-lg border bg-slate-50 p-4 text-sm space-y-2">
                  <p className="font-medium">รหัสหมดอายุ {new Date(linkCode.expiresAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.</p>
                  <p className="text-muted-foreground">1. เพิ่ม RoomFlow bot เป็นเพื่อน 2. ส่งข้อความนี้ในแชตของ bot:</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded-md bg-slate-900 px-3 py-2 text-center text-white font-bold tracking-widest">LINK {linkCode.code}</code>
                    <Button variant="outline" size="icon" onClick={copyLinkCommand} aria-label="Copy link command"><Copy className="w-4 h-4" /></Button>
                  </div>
                </div>
                {linkCode.addFriendUrl && (
                  <Button asChild className="bg-green-600 hover:bg-green-700">
                    <a href={linkCode.addFriendUrl} target="_blank" rel="noreferrer">เปิด LINE และเพิ่ม bot <ExternalLink className="w-4 h-4 ml-2" /></a>
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">หน้านี้ตรวจสถานะอัตโนมัติทุก 5 วินาที รหัสใช้ได้ครั้งเดียวเป็นเวลา 10 นาที</p>
              </div>
            ) : notificationSettings?.line.botBasicId ? (
              <Button className="bg-green-600 hover:bg-green-700" onClick={() => createLinkMutation.mutate()} disabled={createLinkMutation.isPending}>
                {createLinkMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Link2 className="w-4 h-4 mr-2" />}
                สร้างรหัสเชื่อมต่อ LINE
              </Button>
            ) : (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">ผู้ดูแลระบบยังไม่ได้ตั้งค่า LINE bot สำหรับ environment นี้</p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
