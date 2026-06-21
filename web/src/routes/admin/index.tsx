import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminStatsQuery, adminBookingsQuery } from "../../lib/queries";
import { app } from "../../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  Building2,
  CalendarDays,
  Users,
  CheckCircle2,
  Loader2,
  Timer,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/")({
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(adminStatsQuery()),
      queryClient.ensureQueryData(adminBookingsQuery({ status: "PENDING" })),
    ]),
  component: AdminDashboard,
});

type Stats = {
  totalRooms: number;
  pendingBookings: number;
  totalUsers: number;
  confirmedToday: number;
};

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
  { key: "totalRooms", label: "Active Rooms", icon: Building2, color: "text-blue-600" },
  { key: "pendingBookings", label: "Pending Approval", icon: Timer, color: "text-yellow-600" },
  { key: "totalUsers", label: "Total Users", icon: Users, color: "text-purple-600" },
  { key: "confirmedToday", label: "Confirmed Today", icon: CheckCircle2, color: "text-green-600" },
] as const;

const DEMO_STATS: Stats = { totalRooms: 6, pendingBookings: 3, totalUsers: 42, confirmedToday: 5 };

function AdminDashboard() {
  const qc = useQueryClient();
  const { data: stats } = useQuery(adminStatsQuery());
  const { data: bookingsData } = useQuery(adminBookingsQuery({ status: "PENDING" }));
  const pendingBookings: Booking[] = ((bookingsData as any)?.bookings ?? []).slice(0, 5);

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (app.api.bookings as any)[id].approve.patch();
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin"] });
      toast.success("Booking approved");
    },
    onError: () => toast.error("Failed to approve"),
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (app.api.bookings as any)[id].reject.patch({ reason: "Rejected by admin" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin"] });
      toast.success("Booking rejected");
    },
    onError: () => toast.error("Failed to reject"),
  });

  const displayStats = stats ?? DEMO_STATS;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your room booking system</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {STAT_CARDS.map(({ key, label, icon: Icon, color }) => (
          <Card key={key}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-muted-foreground">{label}</p>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <p className="text-3xl font-bold">{displayStats[key]}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pending bookings */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Pending Bookings</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin/bookings" className="flex items-center gap-1 text-xs">
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {pendingBookings.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No pending bookings</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingBookings.map((b) => (
                <PendingRow
                  key={b.id}
                  booking={b}
                  onApprove={(id) => approveMutation.mutate(id)}
                  onReject={(id) => rejectMutation.mutate(id)}
                  acting={(approveMutation.isPending || rejectMutation.isPending) &&
                    (approveMutation.variables === b.id || rejectMutation.variables === b.id)}
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
  booking,
  onApprove,
  onReject,
  acting,
}: {
  booking: Booking;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  acting: boolean;
}) {
  const start = new Date(booking.startTime);
  const end = new Date(booking.endTime);

  return (
    <div className="flex items-center justify-between gap-4 p-3 rounded-lg border bg-background">
      <div className="min-w-0">
        <p className="font-medium text-sm truncate">
          {booking.room?.name ?? "Unknown room"} — {booking.user?.name ?? "Unknown user"}
        </p>
        <p className="text-xs text-muted-foreground">
          {start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}{" "}
          · {start.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}–
          {end.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
          {booking.purpose && ` · ${booking.purpose}`}
        </p>
      </div>
      <div className="flex gap-2 shrink-0">
        <Button size="sm" onClick={() => onApprove(booking.id)} disabled={acting}
          className="h-7 text-xs bg-green-600 hover:bg-green-700">
          {acting ? <Loader2 className="w-3 h-3 animate-spin" /> : "Approve"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => onReject(booking.id)} disabled={acting}
          className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/10">
          Reject
        </Button>
      </div>
    </div>
  );
}

const now = new Date();
const addH = (h: number) => new Date(now.getTime() + h * 3600000).toISOString();
const DEMO_BOOKINGS: Booking[] = [
  { id: "b1", status: "PENDING", startTime: addH(2), endTime: addH(3), attendees: 5, purpose: "Team standup", room: { name: "Conference Room A", floor: "3" }, user: { name: "Somchai P.", email: "s.p@kmitl.ac.th" } },
  { id: "b2", status: "PENDING", startTime: addH(5), endTime: addH(7), attendees: 12, purpose: "Lecture: Data Structures", room: { name: "Training Room", floor: "4" }, user: { name: "Malee K.", email: "m.k@kmitl.ac.th" } },
  { id: "b3", status: "PENDING", startTime: addH(24), endTime: addH(25), attendees: 3, purpose: "Study group", room: { name: "Focus Room", floor: "2" }, user: { name: "Niran T.", email: "n.t@kmitl.ac.th" } },
];
