import { createFileRoute, Link, Outlet, redirect, useRouter } from "@tanstack/react-router";
import { authClient } from "../lib/auth";
import { roleLabel } from "../lib/useCurrentUser";
import { Button } from "../components/ui/button";
import {
  LayoutDashboard,
  CalendarDays,
  Building2,
  Users,
  ArrowLeft,
  LogOut,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data?.user) throw redirect({ to: "/" });
    if ((session.data.user as any).role !== "adminRole") throw redirect({ to: "/home" });
  },
  component: AdminLayout,
});

const NAV_ITEMS = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/bookings", label: "Bookings", icon: CalendarDays, exact: false },
  { to: "/admin/rooms", label: "Rooms", icon: Building2, exact: false },
  { to: "/admin/users", label: "Users", icon: Users, exact: false },
];

function AdminLayout() {
  const router = useRouter();

  async function handleSignOut() {
    await authClient.signOut();
    toast.success("Signed out");
    router.navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-foreground text-background flex flex-col">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-background/10">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-background rounded-md flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-foreground">
                <path d="M3 3h18v2H3V3zm0 4h18v2H3V7zm0 4h12v2H3v-2zm0 4h12v2H3v-2zm14 0h4v6h-4v-6z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight">Room Booking</p>
              <p className="text-[10px] text-background/50 leading-tight">Admin Panel</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon, exact }) => (
            <Link
              key={to}
              to={to as any}
              className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-background/70 hover:text-background hover:bg-background/10 transition-colors"
              activeProps={{ className: "text-background bg-background/15 font-medium" }}
              activeOptions={{ exact }}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-3 py-4 border-t border-background/10 space-y-1">
          <Link
            to="/home"
            className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-background/60 hover:text-background hover:bg-background/10 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to App
          </Link>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-background/60 hover:text-background hover:bg-background/10 transition-colors"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 bg-secondary/30">
        <Outlet />
      </div>
    </div>
  );
}
