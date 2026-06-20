import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { authClient } from "../lib/auth";
import { app } from "../lib/api";
import { Navbar } from "../components/Navbar";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import {
  CalendarDays,
  Clock,
  Building2,
  Users,
  Loader2,
  XCircle,
  CheckCircle2,
  AlertCircle,
  Timer,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/bookings")({
  component: BookingsPage,
});

type BookingStatus =
  | "PENDING"
  | "CONFIRMED"
  | "CHECKED_IN"
  | "COMPLETED"
  | "CANCELLED"
  | "REJECTED"
  | "EXPIRED";

type Booking = {
  id: string;
  roomId: string;
  room?: { name: string; floor: string };
  startTime: string;
  endTime: string;
  attendees: number;
  purpose?: string | null;
  status: BookingStatus;
  cancelReason?: string | null;
  rejectedReason?: string | null;
  createdAt: string;
};

const STATUS_CONFIG: Record<
  BookingStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning"; icon: React.ReactNode }
> = {
  PENDING: { label: "Pending Approval", variant: "warning", icon: <Timer className="w-3.5 h-3.5" /> },
  CONFIRMED: { label: "Confirmed", variant: "success", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  CHECKED_IN: { label: "Checked In", variant: "success", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  COMPLETED: { label: "Completed", variant: "secondary", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  CANCELLED: { label: "Cancelled", variant: "outline", icon: <XCircle className="w-3.5 h-3.5" /> },
  REJECTED: { label: "Rejected", variant: "destructive", icon: <XCircle className="w-3.5 h-3.5" /> },
  EXPIRED: { label: "Expired", variant: "outline", icon: <AlertCircle className="w-3.5 h-3.5" /> },
};

const TAB_FILTERS: { label: string; statuses: BookingStatus[] | null }[] = [
  { label: "Upcoming", statuses: ["PENDING", "CONFIRMED", "CHECKED_IN"] },
  { label: "Past", statuses: ["COMPLETED", "EXPIRED"] },
  { label: "Cancelled", statuses: ["CANCELLED", "REJECTED"] },
  { label: "All", statuses: null },
];

function BookingsPage() {
  const [user, setUser] = useState<{ name: string; email: string; image?: string | null } | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [cancelling, setCancelling] = useState<string | null>(null);

  useEffect(() => {
    authClient.getSession().then((s) => {
      if (!s.data?.user) {
        window.location.href = "/";
        return;
      }
      setUser(s.data.user as typeof user);
    });
  }, []);

  useEffect(() => {
    async function fetchBookings() {
      try {
        const { data } = await (app.api.bookings as any).get();
        if (data) setBookings(data as Booking[]);
      } catch {
        setBookings(DEMO_BOOKINGS);
      } finally {
        setLoading(false);
      }
    }
    fetchBookings();
  }, []);

  const activeStatuses = TAB_FILTERS[activeTab].statuses;
  const displayed = activeStatuses
    ? bookings.filter((b) => (activeStatuses as string[]).includes(b.status))
    : bookings;

  async function cancelBooking(id: string) {
    setCancelling(id);
    try {
      await (app.api.bookings as any)[id].delete();
      setBookings((prev) =>
        prev.map((b) => (b.id === id ? { ...b, status: "CANCELLED" as BookingStatus } : b))
      );
      toast.success("Booking cancelled.");
    } catch {
      toast.error("Could not cancel booking.");
    } finally {
      setCancelling(null);
    }
  }

  const isDemo = loading === false && bookings === DEMO_BOOKINGS;

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-1">My Bookings</h1>
          <p className="text-muted-foreground">Track and manage your room reservations</p>
        </div>

        {isDemo && (
          <div className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
            Showing demo data — connect your backend to see your bookings.
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b">
          {TAB_FILTERS.map((tab, i) => (
            <button
              key={tab.label}
              onClick={() => setActiveTab(i)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === i
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              {tab.statuses && (
                <span className="ml-1.5 rounded-full bg-secondary px-1.5 py-0.5 text-xs">
                  {bookings.filter((b) => (tab.statuses as string[]).includes(b.status)).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Booking list */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No bookings here</p>
            <Button asChild variant="link" className="mt-1">
              <Link to="/home">Browse rooms</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {displayed.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                onCancel={cancelBooking}
                cancelling={cancelling === booking.id}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function BookingCard({
  booking,
  onCancel,
  cancelling,
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
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Room name + status */}
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <h3 className="font-semibold text-base">
                {booking.room?.name ?? `Room ${booking.roomId.slice(0, 6)}`}
              </h3>
              <Badge variant={cfg.variant} className="flex items-center gap-1">
                {cfg.icon}
                {cfg.label}
              </Badge>
            </div>

            {/* Date & time */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mb-2">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5" />
                {formatDate(start)}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                {formatTime(start)} – {formatTime(end)}
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                {booking.attendees} attendee{booking.attendees !== 1 ? "s" : ""}
              </span>
              {booking.room?.floor && (
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" />
                  Floor {booking.room.floor}
                </span>
              )}
            </div>

            {/* Purpose */}
            {booking.purpose && (
              <p className="text-sm text-muted-foreground line-clamp-1">
                <span className="font-medium text-foreground">Purpose:</span> {booking.purpose}
              </p>
            )}

            {/* Rejection reason */}
            {booking.status === "REJECTED" && booking.rejectedReason && (
              <p className="mt-1 text-sm text-destructive">
                Reason: {booking.rejectedReason}
              </p>
            )}
          </div>

          {/* Actions */}
          {canCancel && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onCancel(booking.id)}
              disabled={cancelling}
              className="shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10"
            >
              {cancelling ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                "Cancel"
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

const now = new Date();
const addHours = (h: number) => new Date(now.getTime() + h * 3600000).toISOString();
const subHours = (h: number) => new Date(now.getTime() - h * 3600000).toISOString();

const DEMO_BOOKINGS: Booking[] = [
  {
    id: "b1",
    roomId: "demo-1",
    room: { name: "Conference Room A", floor: "3" },
    startTime: addHours(2),
    endTime: addHours(3),
    attendees: 8,
    purpose: "Weekly team standup",
    status: "CONFIRMED",
    createdAt: subHours(24),
  },
  {
    id: "b2",
    roomId: "demo-3",
    room: { name: "Board Room", floor: "5" },
    startTime: addHours(26),
    endTime: addHours(28),
    attendees: 10,
    purpose: "Q3 strategy review with stakeholders",
    status: "PENDING",
    createdAt: subHours(2),
  },
  {
    id: "b3",
    roomId: "demo-2",
    room: { name: "Meeting Room B", floor: "2" },
    startTime: subHours(5),
    endTime: subHours(4),
    attendees: 4,
    purpose: "Product demo",
    status: "COMPLETED",
    createdAt: subHours(48),
  },
  {
    id: "b4",
    roomId: "demo-4",
    room: { name: "Collaboration Hub", floor: "1" },
    startTime: subHours(72),
    endTime: subHours(71),
    attendees: 3,
    purpose: "Design brainstorm",
    status: "CANCELLED",
    createdAt: subHours(100),
  },
];
