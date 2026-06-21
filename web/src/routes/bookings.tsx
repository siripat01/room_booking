import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "../lib/useCurrentUser";
import { bookingsQuery, sessionQuery, type BookingStatus, type Booking } from "../lib/queries";
import { app } from "../lib/api";
import { Navbar } from "../components/Navbar";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  CalendarDays, Clock, Building2, Users, Loader2,
  XCircle, CheckCircle2, AlertCircle, Timer, MapPin,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/bookings")({
  beforeLoad: async ({ context: { queryClient } }) => {
    const user = await queryClient.ensureQueryData(sessionQuery());
    if (!user) throw redirect({ to: "/" });
  },
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(bookingsQuery()),
  component: BookingsPage,
});

const STATUS_CONFIG: Record<BookingStatus, {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning";
  icon: React.ReactNode;
  border: string;
  dot: string;
}> = {
  PENDING:    { label: "Pending Approval", variant: "warning",     icon: <Timer className="w-3.5 h-3.5" />,       border: "border-l-amber-400",  dot: "bg-amber-400" },
  CONFIRMED:  { label: "Confirmed",        variant: "success",     icon: <CheckCircle2 className="w-3.5 h-3.5" />, border: "border-l-emerald-400", dot: "bg-emerald-400" },
  CHECKED_IN: { label: "Checked In",       variant: "success",     icon: <CheckCircle2 className="w-3.5 h-3.5" />, border: "border-l-emerald-400", dot: "bg-emerald-400" },
  COMPLETED:  { label: "Completed",        variant: "secondary",   icon: <CheckCircle2 className="w-3.5 h-3.5" />, border: "border-l-slate-300",   dot: "bg-slate-300" },
  CANCELLED:  { label: "Cancelled",        variant: "outline",     icon: <XCircle className="w-3.5 h-3.5" />,      border: "border-l-slate-300",   dot: "bg-slate-300" },
  REJECTED:   { label: "Rejected",         variant: "destructive", icon: <XCircle className="w-3.5 h-3.5" />,      border: "border-l-red-400",     dot: "bg-red-400" },
  EXPIRED:    { label: "Expired",          variant: "outline",     icon: <AlertCircle className="w-3.5 h-3.5" />,  border: "border-l-slate-300",   dot: "bg-slate-300" },
};

const TAB_FILTERS: { label: string; statuses: BookingStatus[] | null }[] = [
  { label: "Upcoming",  statuses: ["PENDING", "CONFIRMED", "CHECKED_IN"] },
  { label: "Past",      statuses: ["COMPLETED", "EXPIRED"] },
  { label: "Cancelled", statuses: ["CANCELLED", "REJECTED"] },
  { label: "All",       statuses: null },
];

function BookingsPage() {
  const { user } = useCurrentUser();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState(0);

  const { data, isLoading: loading } = useQuery(bookingsQuery());
  const bookings: Booking[] = (data as any)?.bookings ?? [];

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (app.api.bookings as any)[id].cancel.patch();
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookings"] });
      toast.success("Booking cancelled.");
    },
    onError: () => toast.error("Could not cancel booking."),
  });

  const activeStatuses = TAB_FILTERS[activeTab].statuses;
  const displayed = activeStatuses
    ? bookings.filter((b) => (activeStatuses as string[]).includes(b.status))
    : bookings;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar user={user} />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">My Bookings</h1>
          <p className="text-muted-foreground text-sm mt-1">Track and manage your room reservations</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white rounded-lg border p-1">
          {TAB_FILTERS.map((tab, i) => {
            const count = tab.statuses
              ? bookings.filter((b) => (tab.statuses as string[]).includes(b.status)).length
              : bookings.length;
            return (
              <button
                key={tab.label}
                onClick={() => setActiveTab(i)}
                className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activeTab === i
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-muted-foreground hover:text-slate-700"
                }`}
              >
                {tab.label}
                {count > 0 && (
                  <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-xs ${
                    activeTab === i ? "bg-white/20 text-white" : "bg-slate-100"
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Booking list */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <CalendarDays className="w-8 h-8 opacity-40" />
            </div>
            <p className="font-semibold text-slate-700">No bookings here</p>
            <p className="text-sm mt-1">Your {TAB_FILTERS[activeTab].label.toLowerCase()} bookings will appear here</p>
            <Button asChild variant="link" className="mt-2 text-blue-600">
              <Link to="/home">Browse rooms</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {displayed.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                onCancel={(id) => cancelMutation.mutate(id)}
                cancelling={cancelMutation.isPending && cancelMutation.variables === booking.id}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function BookingCard({
  booking, onCancel, cancelling,
}: {
  booking: Booking;
  onCancel: (id: string) => void;
  cancelling: boolean;
}) {
  const cfg = STATUS_CONFIG[booking.status];
  const start = new Date(booking.startTime);
  const end = new Date(booking.endTime);
  const canCancel = ["PENDING", "CONFIRMED"].includes(booking.status);

  const formatDate = (d: Date) =>
    d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  const formatTime = (d: Date) =>
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className={`bg-white rounded-xl border border-l-4 ${cfg.border} shadow-sm overflow-hidden`}>
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Room name + status */}
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <h3 className="font-semibold text-slate-900">
                {booking.room?.name ?? `Room ${booking.roomId.slice(0, 6)}`}
              </h3>
              <Badge variant={cfg.variant} className="flex items-center gap-1 text-xs">
                {cfg.icon}
                {cfg.label}
              </Badge>
            </div>

            {/* Date & time */}
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground mb-2">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-blue-500" />
                {formatDate(start)}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-500" />
                {formatTime(start)} – {formatTime(end)}
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-500" />
                {booking.attendees} attendee{booking.attendees !== 1 ? "s" : ""}
              </span>
              {booking.room?.floor && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-blue-500" />
                  Floor {booking.room.floor}
                </span>
              )}
            </div>

            {booking.purpose && (
              <p className="text-sm text-muted-foreground line-clamp-1">
                <span className="font-medium text-slate-600">Purpose:</span> {booking.purpose}
              </p>
            )}

            {booking.status === "REJECTED" && booking.rejectedReason && (
              <p className="mt-1.5 text-sm text-red-600 bg-red-50 rounded-md px-2.5 py-1.5 inline-block">
                Reason: {booking.rejectedReason}
              </p>
            )}
          </div>

          {canCancel && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onCancel(booking.id)}
              disabled={cancelling}
              className="shrink-0 text-red-600 border-red-200 hover:bg-red-50"
            >
              {cancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Cancel"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
