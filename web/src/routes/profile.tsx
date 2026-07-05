import { useTitle } from "../lib/useTitle";
import { createFileRoute, useRouter, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authClient } from "../lib/auth";
import { useCurrentUser, roleLabel } from "../lib/useCurrentUser";
import { sessionQuery, bookingsQuery } from "../lib/queries";
import { Navbar } from "../components/Navbar";
import { Button } from "../components/ui/button";
import { Separator } from "../components/ui/separator";
import { Badge } from "../components/ui/badge";
import {
  Mail, Shield, LogOut, CalendarDays, Loader2,
  CheckCircle2, Clock, XCircle, Building2,
} from "lucide-react";
import { LoadingCentered } from "../components/LoadingSpinner";
import { toast } from "sonner";

export const Route = createFileRoute("/profile")({
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
  loader: ({ context: { queryClient } }) => {
    if (typeof window === "undefined") return;
    return queryClient.ensureQueryData(bookingsQuery());
  },
  component: ProfilePage,
});

function ProfilePage() {
  useTitle("Profile");
  const router = useRouter();
  const { user, loading } = useCurrentUser();
  const [signingOut, setSigningOut] = useState(false);
  const { data: bookingsData } = useQuery(bookingsQuery());
  const bookings = (bookingsData as any)?.bookings ?? [];

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await authClient.signOut();
      toast.success("Signed out successfully");
      router.navigate({ to: "/" });
    } catch {
      toast.error("Sign out failed.");
      setSigningOut(false);
    }
  }

  const initials = user?.name
    ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  const stats = {
    total: bookings.length,
    confirmed: bookings.filter((b: any) => ["CONFIRMED", "CHECKED_IN", "COMPLETED"].includes(b.status)).length,
    pending: bookings.filter((b: any) => b.status === "PENDING").length,
    cancelled: bookings.filter((b: any) => ["CANCELLED", "REJECTED"].includes(b.status)).length,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar user={null} />
        <LoadingCentered />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar user={user} />

      {/* Header */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
          <div className="flex items-center gap-5">
            {user?.image ? (
              <img src={user.image} alt={user.name}
                className="w-20 h-20 rounded-full object-cover ring-4 ring-white/30" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-white/20 text-white flex items-center justify-center text-2xl font-bold ring-4 ring-white/30">
                {initials}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold">{user?.name}</h1>
              <div className="flex items-center gap-2 mt-1.5">
                <Badge className="bg-white/20 text-white border-white/30 text-xs">
                  <Shield className="w-3 h-3 mr-1" />
                  {roleLabel(user?.role)}
                </Badge>
              </div>
              <p className="text-blue-200 text-sm mt-1.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" /> {user?.email}
              </p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Booking stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total", value: stats.total, icon: CalendarDays, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "Confirmed", value: stats.confirmed, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "Pending", value: stats.pending, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
            { label: "Cancelled", value: stats.cancelled, icon: XCircle, color: "text-red-500", bg: "bg-red-50" },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <Link key={label} to="/bookings" className="bg-white rounded-xl border p-4 text-center shadow-sm hover:shadow-md transition-shadow block">
              <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center mx-auto mb-2`}>
                <Icon className={`w-4.5 h-4.5 ${color}`} />
              </div>
              <p className="text-2xl font-bold text-slate-800">{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label} Bookings</p>
            </Link>
          ))}
        </div>

        {/* Account info */}
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b">
            <h2 className="font-semibold text-slate-800">Account Details</h2>
          </div>
          <div className="divide-y">
            <div className="flex items-center justify-between px-5 py-3.5">
              <span className="text-sm text-muted-foreground">Full name</span>
              <span className="text-sm font-medium text-slate-800">{user?.name}</span>
            </div>
            <div className="flex items-center justify-between px-5 py-3.5">
              <span className="text-sm text-muted-foreground">Email</span>
              <span className="text-sm font-medium text-slate-800">{user?.email}</span>
            </div>
            <div className="flex items-center justify-between px-5 py-3.5">
              <span className="text-sm text-muted-foreground">Role</span>
              <Badge variant={user?.isAdmin ? "default" : user?.isTeacher ? "secondary" : "outline"} className="text-xs">
                {roleLabel(user?.role)}
              </Badge>
            </div>
            <div className="flex items-center justify-between px-5 py-3.5">
              <span className="text-sm text-muted-foreground">Sign-in method</span>
              <span className="text-sm font-medium text-slate-800 flex items-center gap-1.5">
                <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Google
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-white rounded-xl border shadow-sm p-5 space-y-3">
          <h2 className="font-semibold text-slate-800 mb-3">Quick Actions</h2>
          <Button asChild variant="outline" className="w-full justify-start gap-2">
            <Link to="/bookings">
              <CalendarDays className="w-4 h-4 text-blue-600" /> View All Bookings
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full justify-start gap-2">
            <Link to="/home">
              <Building2 className="w-4 h-4 text-blue-600" /> Browse Rooms
            </Link>
          </Button>
          <Separator />
          <Button
            variant="outline"
            className="w-full text-red-600 border-red-200 hover:bg-red-50 justify-start gap-2"
            onClick={handleSignOut}
            disabled={signingOut}
          >
            {signingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
            {signingOut ? "Signing out…" : "Sign Out"}
          </Button>
        </div>
      </main>
    </div>
  );
}
