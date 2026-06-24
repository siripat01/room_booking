import { useNavigate } from "@tanstack/react-router";
import { useCurrentUser } from "../lib/useCurrentUser";
import { Button } from "./ui/button";
import { AlertTriangle, Home, LogIn, ShieldAlert, SearchX } from "lucide-react";

export type ErrorPageProps = {
  type?: "not-found" | "unauthorized" | "forbidden" | "auth-domain" | "server" | "generic";
  title?: string;
  description?: string;
  statusCode?: number;
};

const PRESETS: Record<string, { icon: typeof AlertTriangle; title: string; description: string; code: string }> = {
  "not-found": {
    icon: SearchX,
    title: "Page Not Found",
    description: "ไม่พบหน้าที่คุณกำลังมองหา ลองตรวจสอบ URL อีกครั้ง",
    code: "404",
  },
  unauthorized: {
    icon: ShieldAlert,
    title: "กรุณาเข้าสู่ระบบ",
    description: "คุณต้องเข้าสู่ระบบก่อนถึงจะเข้าถึงหน้านี้ได้",
    code: "401",
  },
  forbidden: {
    icon: ShieldAlert,
    title: "ไม่มีสิทธิ์เข้าถึง",
    description: "คุณไม่มีสิทธิ์เข้าถึงหน้านี้",
    code: "403",
  },
  "auth-domain": {
    icon: ShieldAlert,
    title: "อีเมลไม่ถูกต้อง",
    description: "ระบบอนุญาตเฉพาะอีเมลของมหาวิทยาลัยเท่านั้น กรุณาใช้อีเมล @kmitl.ac.th",
    code: "403",
  },
  server: {
    icon: AlertTriangle,
    title: "เกิดข้อผิดพลาด",
    description: "เซิร์ฟเวอร์เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง",
    code: "500",
  },
  generic: {
    icon: AlertTriangle,
    title: "เกิดข้อผิดพลาด",
    description: "บางอย่างผิดพลาด กรุณาลองใหม่อีกครั้ง",
    code: "ERR",
  },
};

export function ErrorPage({ type = "generic", title, description, statusCode }: ErrorPageProps) {
  const navigate = useNavigate();
  const { user, loading } = useCurrentUser();
  const preset = PRESETS[type] ?? PRESETS.generic;
  const Icon = preset.icon;

  const displayTitle = title ?? preset.title;
  const displayDesc = description ?? preset.description;
  const displayCode = statusCode ? String(statusCode) : preset.code;

  function handleBack() {
    if (!loading && user) {
      navigate({ to: "/home" });
    } else {
      navigate({ to: "/" });
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md text-center">
        <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-6 border border-red-100">
          <Icon className="w-9 h-9 text-red-500" />
        </div>

        <div className="text-6xl font-black text-slate-200 mb-2 leading-none">{displayCode}</div>

        <h1 className="text-xl font-bold text-slate-800 mb-2">{displayTitle}</h1>
        <p className="text-muted-foreground text-sm mb-8 leading-relaxed">{displayDesc}</p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={handleBack} className="bg-blue-600 hover:bg-blue-700 gap-2">
            {!loading && user ? (
              <><Home className="w-4 h-4" /> กลับหน้าหลัก</>
            ) : (
              <><LogIn className="w-4 h-4" /> ไปหน้า Login</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
