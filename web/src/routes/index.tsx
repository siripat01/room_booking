import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { sessionQuery } from "../lib/queries";
import { authClient } from "../lib/auth";
import { Button } from "../components/ui/button";
import { useState } from "react";
import { toast } from "sonner";
import { Building2, CalendarDays, CheckCircle2, Users } from "lucide-react";

export const Route = createFileRoute("/")({
  beforeLoad: async ({ context: { queryClient }, search }) => {
    if (typeof window === "undefined") return;
    try {
      const user = await queryClient.ensureQueryData(sessionQuery());
      if (user) throw redirect({ to: (search as any).redirect ?? "/home" });
    } catch (e: any) {
      if (e?.isRedirect) throw e;
    }
  },
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof search.redirect === "string" && search.redirect.startsWith("/")
      ? search.redirect
      : undefined,
  }),
  component: LoginPage,
});

const FEATURES = [
  { icon: Building2, title: "Browse Rooms", desc: "Find the perfect space for any occasion" },
  { icon: CalendarDays, title: "Instant Booking", desc: "Reserve with a few clicks, no back-and-forth" },
  { icon: CheckCircle2, title: "Auto Confirm", desc: "Teachers & admins get instant confirmations" },
  { icon: Users, title: "Team Friendly", desc: "Manage attendees and purposes easily" },
];

function LoginPage() {
  const { redirect: redirectPath } = Route.useSearch();
  const [loading, setLoading] = useState(false);

  async function handleGoogleLogin() {
    setLoading(true);
    const callbackURL = `${import.meta.env.VITE_FRONTEND_URL}${redirectPath ?? "/home"}`;
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL,
      });
    } catch {
      toast.error("Login failed. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Left panel – branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 to-blue-800 flex-col justify-between p-12 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/5" />
          <div className="absolute -bottom-12 -left-12 w-64 h-64 rounded-full bg-white/5" />
        </div>

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow-md">
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-blue-600">
              <path d="M3 3h18v2H3V3zm0 4h18v2H3V7zm0 4h12v2H3v-2zm0 4h12v2H3v-2zm14 0h4v6h-4v-6z" />
            </svg>
          </div>
          <span className="text-white font-bold text-lg">Room Booking</span>
        </div>

        {/* Hero text */}
        <div className="relative">
          <h1 className="text-white text-4xl font-bold leading-tight mb-4">
            Reserve your perfect<br />meeting space
          </h1>
          <p className="text-blue-200 text-lg leading-relaxed">
            Simple, fast, and fair room booking for everyone at KMITL.
          </p>
        </div>

        {/* Feature list */}
        <div className="relative grid grid-cols-2 gap-4">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center mb-2.5">
                <Icon className="w-4 h-4 text-white" />
              </div>
              <p className="text-white text-sm font-semibold leading-tight">{title}</p>
              <p className="text-blue-200 text-xs mt-0.5 leading-snug">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel – login form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
                <path d="M3 3h18v2H3V3zm0 4h18v2H3V7zm0 4h12v2H3v-2zm0 4h12v2H3v-2zm14 0h4v6h-4v-6z" />
              </svg>
            </div>
            <span className="font-bold text-lg text-slate-900">Room Booking</span>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-1">Welcome back</h2>
          <p className="text-muted-foreground text-sm mb-8">Sign in with your KMITL Google account</p>

          <Button
            onClick={handleGoogleLogin}
            disabled={loading}
            variant="outline"
            className="w-full h-12 gap-3 text-sm font-medium border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            {loading ? "Signing in…" : "Continue with Google"}
          </Button>

          <p className="text-center text-muted-foreground text-xs mt-8">
            By signing in you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
