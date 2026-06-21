import { createFileRoute, Link, Outlet, redirect, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { authClient } from "../lib/auth";
import { roleLabel } from "../lib/useCurrentUser";
import { sessionQuery } from "../lib/queries";
import {
  LayoutDashboard, CalendarDays, Building2, Users,
  Cpu, ArrowLeft, LogOut,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  beforeLoad: async ({ location }) => {
    if (typeof window === "undefined") return;
    try {
      const session = await authClient.getSession();
      if (!session.data?.user) throw redirect({ to: "/", search: { redirect: location.pathname } });
      if ((session.data.user as any).role !== "adminRole") throw redirect({ to: "/home" });
    } catch (e: any) {
      if (e?.isRedirect) throw e;
      throw redirect({ to: "/", search: { redirect: location.pathname } });
    }
  },
  component: AdminLayout,
});

const NAV_ITEMS = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/bookings", label: "Bookings", icon: CalendarDays, exact: false },
  { to: "/admin/rooms", label: "Rooms", icon: Building2, exact: false },
  { to: "/admin/devices", label: "Devices", icon: Cpu, exact: false },
  { to: "/admin/users", label: "Users", icon: Users, exact: false },
];

function AdminLayout() {
  const router = useRouter();
  const { data: user } = useQuery(sessionQuery());

  async function handleSignOut() {
    await authClient.signOut();
    toast.success("Signed out");
    router.navigate({ to: "/" });
  }

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "A";

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 bg-white border-r flex flex-col">
        {/* Logo */}
        <div className="px-5 py-5 border-b">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
                <path d="M3 3h18v2H3V3zm0 4h18v2H3V7zm0 4h12v2H3v-2zm0 4h12v2H3v-2zm14 0h4v6h-4v-6z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold leading-tight text-slate-900">Room Booking</p>
              <p className="text-[10px] text-muted-foreground leading-tight">Admin Panel</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV_ITEMS.map(({ to, label, icon: Icon, exact }) => (
            <Link
              key={to}
              to={to as any}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              activeProps={{ className: "text-blue-700 bg-blue-50 font-medium hover:bg-blue-50 hover:text-blue-700" }}
              activeOptions={{ exact }}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        {/* User + footer */}
        <div className="px-3 pb-4 border-t pt-4 space-y-1">
          {user && (
            <div className="flex items-center gap-2.5 px-3 py-2 mb-2">
              {user.image ? (
                <img src={user.image} alt={user.name} className="w-7 h-7 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-semibold shrink-0">
                  {initials}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-800 truncate">{user.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{roleLabel(user.role)}</p>
              </div>
            </div>
          )}
          <Link
            to="/home"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to App
          </Link>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}
