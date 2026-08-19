import { useTitle } from "../lib/useTitle";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "../lib/useCurrentUser";
import { sessionQuery, waitlistQuery, type BookingStatus, type Booking, type BookingListResponse, type WaitlistEntry } from "../lib/queries";
import { app } from "../lib/api";
import { Navbar } from "../components/Navbar";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../components/ui/dialog";
import { QRCodeSVG } from "qrcode.react";
import {
  CalendarDays, Clock, Users, Loader2,
  XCircle, CheckCircle2, AlertCircle, Timer, MapPin, QrCode, Bell,
} from "lucide-react";
import { LoadingCentered } from "../components/LoadingSpinner";
import { toast } from "sonner";

export const Route = createFileRoute("/bookings")({
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
  EXPIRED:    { label: "ไม่ได้เช็คอิน",     variant: "outline",     icon: <AlertCircle className="w-3.5 h-3.5" />,  border: "border-l-slate-300",   dot: "bg-slate-300" },
};

const TAB_FILTERS: { label: string; statuses: BookingStatus[] | null }[] = [
  { label: "Upcoming",  statuses: ["PENDING", "CONFIRMED", "CHECKED_IN"] },
  { label: "Past",      statuses: ["COMPLETED", "EXPIRED"] },
  { label: "Cancelled", statuses: ["CANCELLED", "REJECTED"] },
  { label: "All",       statuses: null },
];

const WAITLIST_TAB = TAB_FILTERS.length; // index 4

type QRState = { bookingId: string; token: string; expiresAt: string; roomName: string } | null;

function BookingsPage() {
  useTitle("My Bookings");
  const { user } = useCurrentUser();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState(0);
  const [qrState, setQrState] = useState<QRState>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);

  const isWaitlistTab = activeTab === WAITLIST_TAB;

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: bookingsLoading,
  } = useInfiniteQuery({
    queryKey: ["bookings", "list", activeTab],
    enabled: !isWaitlistTab,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await (app.api.bookings as any).get({
        query: { page: String(pageParam), limit: "20", forSelf: "true" },
      });
      if (error) throw error;
      return data as BookingListResponse;
    },
    getNextPageParam: (lastPage: BookingListResponse) =>
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
  });

  const { data: waitlistEntries = [], isLoading: waitlistLoading } = useQuery({
    ...waitlistQuery(),
    enabled: isWaitlistTab,
  });

  const bookings: Booking[] = data?.pages.flatMap((p) => p.bookings) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (app.api.bookings as any)[id].cancel.patch();
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookings", "list", activeTab] });
      toast.success("Booking cancelled.");
    },
    onError: () => toast.error("Could not cancel booking."),
  });

  const leaveWaitlistMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/bookings/waitlist/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to leave waitlist");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["waitlist"] });
      toast.success("ออกจากคิวรอแล้ว");
    },
    onError: () => toast.error("ไม่สามารถออกจากคิวรอได้"),
  });

  const qrMutation = useMutation({
    mutationFn: async (booking: Booking) => {
      const res = await fetch(`/api/bookings/${booking.id}/qr`, { method: "POST", credentials: "include" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to generate QR code");
      }
      return { ...(await res.json()), roomName: booking.room?.name ?? "Room" };
    },
    onSuccess: (data, booking) => {
      setQrState({ bookingId: booking.id, token: data.qrToken, expiresAt: data.expiresAt, roomName: data.roomName });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not generate QR code."),
  });

  const activeStatuses = isWaitlistTab ? null : TAB_FILTERS[activeTab].statuses;
  const displayed = activeStatuses
    ? bookings.filter((b) => (activeStatuses as string[]).includes(b.status))
    : bookings;

  const loading = isWaitlistTab ? waitlistLoading : bookingsLoading;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar user={user} />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">My Bookings</h1>
          <p className="text-muted-foreground text-sm mt-1">Track and manage your room reservations</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white rounded-lg border p-1 overflow-x-auto">
          {TAB_FILTERS.map((tab, i) => {
            const count = tab.statuses
              ? bookings.filter((b) => (tab.statuses as string[]).includes(b.status)).length
              : bookings.length;
            return (
              <button
                key={tab.label}
                onClick={() => setActiveTab(i)}
                className={`flex-1 min-w-fit px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
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
          {/* Waitlist tab — only shown to PRO users */}
          {user?.plan === "PRO" && (
            <button
              onClick={() => setActiveTab(WAITLIST_TAB)}
              className={`flex-1 min-w-fit px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap flex items-center justify-center gap-1 ${
                activeTab === WAITLIST_TAB
                  ? "bg-violet-600 text-white shadow-sm"
                  : "text-muted-foreground hover:text-slate-700"
              }`}
            >
              <Bell className="w-3 h-3" />
              Waitlist
              {waitlistEntries.length > 0 && (
                <span className={`ml-0.5 rounded-full px-1.5 py-0.5 text-xs ${
                  activeTab === WAITLIST_TAB ? "bg-white/20 text-white" : "bg-violet-100 text-violet-700"
                }`}>
                  {waitlistEntries.length}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <LoadingCentered />
        ) : isWaitlistTab ? (
          waitlistEntries.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <Bell className="w-8 h-8 opacity-40" />
              </div>
              <p className="font-semibold text-slate-700">ไม่มีรายการคิวรอ</p>
              <p className="text-sm mt-1">เมื่อจองห้องที่เต็มแล้ว คุณสามารถเข้าคิวรอได้</p>
              <Button asChild variant="link" className="mt-2 text-blue-600">
                <Link to="/home">ดูห้องทั้งหมด</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {waitlistEntries.map((entry) => (
                <WaitlistCard
                  key={entry.id}
                  entry={entry}
                  onLeave={(id) => leaveWaitlistMutation.mutate(id)}
                  leaving={leaveWaitlistMutation.isPending && leaveWaitlistMutation.variables === entry.id}
                />
              ))}
            </div>
          )
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
                onCancel={(id) => setConfirmCancelId(id)}
                cancelling={cancelMutation.isPending && cancelMutation.variables === booking.id}
                onShowQR={() => qrMutation.mutate(booking)}
                qrLoading={qrMutation.isPending && qrMutation.variables?.id === booking.id}
              />
            ))}

            {/* Load More */}
            {hasNextPage && (
              <Button
                variant="outline"
                className="w-full mt-2"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage
                  ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />กำลังโหลด…</>
                  : "โหลดเพิ่ม"}
              </Button>
            )}

            {/* Count info */}
            {total > 0 && (
              <p className="text-xs text-center text-muted-foreground pt-1">
                แสดง {bookings.length} จาก {total} รายการ
              </p>
            )}
          </div>
        )}
      </main>

      {/* Cancel confirmation */}
      <Dialog open={!!confirmCancelId} onOpenChange={(o) => { if (!o) setConfirmCancelId(null); }}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Cancel this booking?</DialogTitle>
            <DialogDescription>This can't be undone. The time slot will open up for others.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end mt-2">
            <Button variant="outline" onClick={() => setConfirmCancelId(null)}>Keep it</Button>
            <Button
              variant="destructive"
              disabled={cancelMutation.isPending}
              onClick={() => {
                if (confirmCancelId) cancelMutation.mutate(confirmCancelId);
                setConfirmCancelId(null);
              }}
            >
              {cancelMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Cancel booking"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!qrState} onOpenChange={(o) => { if (!o) setQrState(null); }}>
        <DialogContent className="max-w-xs text-center">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-center gap-2">
              <QrCode className="w-5 h-5" /> Check-in QR Code
            </DialogTitle>
            <DialogDescription>
              Show this to the kiosk at <span className="font-medium text-foreground">{qrState?.roomName}</span>
            </DialogDescription>
          </DialogHeader>

          {qrState && (
            <div className="flex flex-col items-center gap-4 py-2">
              <div className="p-4 bg-white rounded-2xl border shadow-sm">
                <QRCodeSVG value={qrState.token} size={200} level="M" />
              </div>
              <p className="text-xs text-muted-foreground">
                Expires at {new Date(qrState.expiresAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                {" "}· valid for 10 minutes
              </p>
              <Button variant="outline" size="sm" onClick={() => qrMutation.mutate(bookings.find((b) => b.id === qrState.bookingId)!)}>
                Refresh QR
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WaitlistCard({
  entry, onLeave, leaving,
}: {
  entry: WaitlistEntry;
  onLeave: (id: string) => void;
  leaving: boolean;
}) {
  const start = new Date(entry.startTime);
  const end = new Date(entry.endTime);
  const isPast = end < new Date();

  const formatDate = (d: Date) =>
    d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  const formatTime = (d: Date) =>
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="bg-white rounded-xl border border-l-4 border-l-violet-400 shadow-sm overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <h3 className="font-semibold text-slate-900">
                {entry.room.name}
              </h3>
              <Badge className="bg-violet-50 text-violet-700 border-violet-200 flex items-center gap-1 text-xs">
                <Bell className="w-3 h-3" /> คิวรอ
              </Badge>
              {isPast && (
                <Badge variant="outline" className="text-xs text-slate-400">หมดเวลาแล้ว</Badge>
              )}
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground mb-2">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-violet-500" />
                {formatDate(start)}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-violet-500" />
                {formatTime(start)} – {formatTime(end)}
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-violet-500" />
                {entry.attendees} attendee{entry.attendees !== 1 ? "s" : ""}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-violet-500" />
                Floor {entry.room.floor}
              </span>
            </div>

            {entry.purpose && (
              <p className="text-sm text-muted-foreground line-clamp-1">
                <span className="font-medium text-slate-600">Purpose:</span> {entry.purpose}
              </p>
            )}
          </div>

          {!isPast && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onLeave(entry.id)}
              disabled={leaving}
              className="text-red-600 border-red-200 hover:bg-red-50 shrink-0"
            >
              {leaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "ออกจากคิว"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function BookingCard({
  booking, onCancel, cancelling, onShowQR, qrLoading,
}: {
  booking: Booking;
  onCancel: (id: string) => void;
  cancelling: boolean;
  onShowQR: () => void;
  qrLoading: boolean;
}) {
  const cfg = STATUS_CONFIG[booking.status];
  const start = new Date(booking.startTime);
  const end = new Date(booking.endTime);
  const isPast = new Date(booking.endTime) < new Date();
  const canCancel = ["PENDING", "CONFIRMED"].includes(booking.status) && !isPast;
  const now = new Date();
  const canShowQR = booking.status === "CONFIRMED"
    && !!booking.checkInWindow
    && now >= new Date(booking.checkInWindow.opensAt)
    && now <= new Date(booking.checkInWindow.closesAt);

  const formatDate = (d: Date) =>
    d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Bangkok" });
  const formatTime = (d: Date) =>
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });

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

          <div className="flex flex-col gap-2 shrink-0">
            {canShowQR && (
              <Button
                size="sm"
                variant="outline"
                onClick={onShowQR}
                disabled={qrLoading}
                className="text-blue-600 border-blue-200 hover:bg-blue-50"
              >
                {qrLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><QrCode className="w-3.5 h-3.5 mr-1" />QR Code</>}
              </Button>
            )}
            {canCancel && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onCancel(booking.id)}
                disabled={cancelling}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                {cancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Cancel"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
