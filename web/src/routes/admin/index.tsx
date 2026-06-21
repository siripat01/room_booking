import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  adminStatsQuery,
  adminBookingsQuery,
  reportsOverviewQuery,
  reportsBookingsSummaryQuery,
  reportsPeakHoursQuery,
} from "../../lib/queries";
import { app } from "../../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  Building2, CalendarDays, Users, CheckCircle2,
  Loader2, Timer, ArrowRight, TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/admin/")({
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(adminStatsQuery()),
      queryClient.ensureQueryData(adminBookingsQuery({ status: "PENDING" })),
      queryClient.ensureQueryData(reportsOverviewQuery()),
      queryClient.ensureQueryData(reportsBookingsSummaryQuery()),
      queryClient.ensureQueryData(reportsPeakHoursQuery()),
    ]),
  component: AdminDashboard,
});

type Booking = {
  id: string;
  status: string;
  startTime: string;
  endTime: string;
  purpose?: string | null;
  attendees: number;
  room?: { name: string; floor: string } | null;
  user?: { name: string; email: string } | null;
};

const STAT_CARDS = [
  { key: "totalRooms", label: "Active Rooms", icon: Building2, color: "text-blue-600", bg: "bg-blue-50" },
  { key: "pendingBookings", label: "Pending Approval", icon: Timer, color: "text-amber-600", bg: "bg-amber-50" },
  { key: "totalUsers", label: "Total Users", icon: Users, color: "text-violet-600", bg: "bg-violet-50" },
  { key: "confirmedToday", label: "Confirmed Today", icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
] as const;

function AdminDashboard() {
  const qc = useQueryClient();
  const { data: stats } = useQuery(adminStatsQuery());
  const { data: bookingsData } = useQuery(adminBookingsQuery({ status: "PENDING" }));
  const { data: overview } = useQuery(reportsOverviewQuery());
  const { data: summary } = useQuery(reportsBookingsSummaryQuery());
  const { data: peakHours } = useQuery(reportsPeakHoursQuery());

  const pendingBookings: Booking[] = ((bookingsData as any)?.bookings ?? []).slice(0, 5);

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (app.api.bookings as any)[id].approve.patch();
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin"] }); toast.success("Booking approved"); },
    onError: () => toast.error("Failed to approve"),
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (app.api.bookings as any)[id].reject.patch({ reason: "Rejected by admin" });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin"] }); toast.success("Booking rejected"); },
    onError: () => toast.error("Failed to reject"),
  });

  const displayStats = stats ?? { totalRooms: 0, pendingBookings: 0, totalUsers: 0, confirmedToday: 0 };

  // chart data
  const dailyData = summary?.daily?.slice(-14) ?? [];
  const popularRoomsData = (overview?.popularRooms ?? []).map((r) => ({
    name: r.room?.name?.replace(/^(Conference |Meeting |Training |Focus |Board )/i, "").slice(0, 14) ?? "Room",
    bookings: r.bookingCount,
  }));
  const peakData = (peakHours ?? []).filter((h) => h.hour >= 7 && h.hour <= 20);

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Overview of your room booking system</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CARDS.map(({ key, label, icon: Icon, color, bg }) => (
          <Card key={key} className="border shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground font-medium">{label}</p>
                <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center`}>
                  <Icon className={`w-4.5 h-4.5 ${color}`} />
                </div>
              </div>
              <p className="text-3xl font-bold">{displayStats[key]}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Daily bookings area chart */}
        <Card className="lg:col-span-2 border shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Booking Trend</CardTitle>
              <span className="text-xs text-muted-foreground">Last 14 days</span>
            </div>
          </CardHeader>
          <CardContent>
            {dailyData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                <TrendingUp className="w-5 h-5 mr-2 opacity-40" /> No data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={dailyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                    labelStyle={{ fontWeight: 600 }}
                  />
                  <Area type="monotone" dataKey="count" name="Bookings" stroke="#2563eb" strokeWidth={2} fill="url(#blueGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Popular rooms bar chart */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Popular Rooms</CardTitle>
          </CardHeader>
          <CardContent>
            {popularRoomsData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                <Building2 className="w-5 h-5 mr-2 opacity-40" /> No data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={popularRoomsData} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
                  <Bar dataKey="bookings" name="Bookings" fill="#2563eb" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Peak hours */}
      {peakData.length > 0 && (
        <Card className="border shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Peak Hours</CardTitle>
              <span className="text-xs text-muted-foreground">07:00 – 20:00</span>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={peakData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
                <Bar dataKey="count" name="Bookings" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Pending bookings */}
      <Card className="border shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm font-semibold">Pending Bookings</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin/bookings" className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700">
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {pendingBookings.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              </div>
              <p className="text-sm font-medium">All caught up!</p>
              <p className="text-xs mt-0.5">No pending bookings right now</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pendingBookings.map((b) => (
                <PendingRow
                  key={b.id}
                  booking={b}
                  onApprove={(id) => approveMutation.mutate(id)}
                  onReject={(id) => rejectMutation.mutate(id)}
                  acting={(approveMutation.isPending && approveMutation.variables === b.id) ||
                    (rejectMutation.isPending && rejectMutation.variables === b.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PendingRow({
  booking, onApprove, onReject, acting,
}: {
  booking: Booking;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  acting: boolean;
}) {
  const start = new Date(booking.startTime);
  const end = new Date(booking.endTime);
  return (
    <div className="flex items-center justify-between gap-4 p-3 rounded-lg border bg-white hover:bg-slate-50 transition-colors">
      <div className="min-w-0 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
          <Timer className="w-4 h-4 text-amber-500" />
        </div>
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">
            {booking.room?.name ?? "Unknown room"}
            <span className="text-muted-foreground font-normal"> · {booking.user?.name ?? "Unknown"}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}{" "}
            · {start.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}–
            {end.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
            {booking.purpose && ` · ${booking.purpose}`}
          </p>
        </div>
      </div>
      <div className="flex gap-2 shrink-0">
        <Button size="sm" onClick={() => onApprove(booking.id)} disabled={acting}
          className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 px-3">
          {acting ? <Loader2 className="w-3 h-3 animate-spin" /> : "Approve"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => onReject(booking.id)} disabled={acting}
          className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/10 px-3">
          Reject
        </Button>
      </div>
    </div>
  );
}
