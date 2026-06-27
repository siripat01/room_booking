import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useCurrentUser } from "../lib/useCurrentUser";
import { sessionQuery } from "../lib/queries";
import { Navbar } from "../components/Navbar";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { CheckCircle2, Loader2, Zap } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/pricing")({
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
  component: PricingPage,
});

const FREE_FEATURES = [
  "จองห้องได้สูงสุด 3 รายการพร้อมกัน",
  "จองล่วงหน้าได้ไม่เกิน 3 วัน",
  "ดูตารางห้องและสถานะ",
  "เช็คอินด้วย QR Code",
];

const PRO_FEATURES = [
  "จองห้องได้สูงสุด 10 รายการพร้อมกัน",
  "จองล่วงหน้าได้ถึง 30 วัน",
  "รับการแจ้งเตือนทาง Email",
  "รับการแจ้งเตือนผ่าน Line Notify",
  "ทุก Feature ของ Free",
];

function PricingPage() {
  const { user } = useCurrentUser();
  const router = useRouter();
  const isPro = (user as any)?.plan === "PRO";

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/subscription/checkout", { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      const { url } = await res.json();
      return url as string;
    },
    onSuccess: (url) => { window.location.href = url; },
    onError: () => toast.error("เกิดข้อผิดพลาด กรุณาลองใหม่"),
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/subscription/portal", { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      const { url } = await res.json();
      return url as string;
    },
    onSuccess: (url) => { window.location.href = url; },
    onError: () => toast.error("เกิดข้อผิดพลาด กรุณาลองใหม่"),
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar user={user} />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-slate-900">แผนการใช้งาน</h1>
          <p className="text-muted-foreground mt-2">เลือกแผนที่เหมาะกับคุณ</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Free */}
          <div className="bg-white rounded-2xl border shadow-sm p-6 flex flex-col">
            <div className="mb-4">
              <Badge variant="secondary" className="mb-2">Free</Badge>
              <h2 className="text-2xl font-bold">ฟรี</h2>
              <p className="text-muted-foreground text-sm mt-1">สำหรับการใช้งานทั่วไป</p>
            </div>
            <ul className="space-y-2.5 flex-1 mb-6">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                  <CheckCircle2 className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Button variant="outline" disabled className="w-full">
              {!isPro ? "แผนปัจจุบัน" : "Free"}
            </Button>
          </div>

          {/* Pro */}
          <div className="bg-white rounded-2xl border-2 border-blue-500 shadow-md p-6 flex flex-col relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge className="bg-blue-600 text-white px-3 py-1 text-xs font-semibold">แนะนำ</Badge>
            </div>
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-blue-600 text-white">Pro</Badge>
                <Zap className="w-4 h-4 text-blue-500" />
              </div>
              <h2 className="text-2xl font-bold">฿99 <span className="text-base font-normal text-muted-foreground">/ เดือน</span></h2>
              <p className="text-muted-foreground text-sm mt-1">สำหรับผู้ใช้งานขั้นสูง</p>
            </div>
            <ul className="space-y-2.5 flex-1 mb-6">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            {isPro ? (
              <Button
                className="w-full"
                variant="outline"
                onClick={() => portalMutation.mutate()}
                disabled={portalMutation.isPending}
              >
                {portalMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                จัดการ Subscription
              </Button>
            ) : (
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700"
                onClick={() => checkoutMutation.mutate()}
                disabled={checkoutMutation.isPending}
              >
                {checkoutMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                อัปเกรดเป็น Pro
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
