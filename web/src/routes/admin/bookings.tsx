import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  adminBookingsQuery,
  bookingTimelineQuery,
  type BookingStatus,
  type Booking,
} from "../../lib/queries";
import { app } from "../../lib/api";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "../../components/ui/dialog";
import { CalendarDays, Clock, Users, CheckCircle2, XCircle, Loader2, Search, ChevronLeft, ChevronRight, History } from "lucide-react";
import { LoadingCentered } from "../../components/LoadingSpinner";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/bookings")({
  loader: ({ context: { queryClient } }) => {
    if (typeof window === "undefined") return;
    return queryClient.ensureQueryData(adminBookingsQuery());
  },
  component: AdminBookingsPage,
});

const STATUS_CONFIG: Record<BookingStatus, { label: string; variant: any; cls: string }> = {
  PENDING:    { label: "Pending",    variant: "warning",     cls: "bg-amber-50 text-amber-700 border-amber-200" },
  CONFIRMED:  { label: "Confirmed",  variant: "success",     cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  CHECKED_IN: { label: "Checked In", variant: "success",     cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  COMPLETED:  { label: "Completed",  variant: "secondary",   cls: "" },
  CANCELLED:  { label: "Cancelled",  variant: "outline",     cls: "" },
  REJECTED:   { label: "Rejected",   variant: "destructive", cls: "bg-red-50 text-red-700 border-red-200" },
  EXPIRED:    { label: "Expired",    variant: "outline",     cls: "" },
};

const TABS: { label: string; statusQuery?: string }[] = [
  { label: "All",       statusQuery: undefined },
  { label: "Pending",   statusQuery: "PENDING" },
  { label: "Confirmed", statusQuery: "CONFIRMED,CHECKED_IN" },
  { label: "Done",      statusQuery: "COMPLETED,EXPIRED" },
  { label: "Cancelled", statusQuery: "CANCELLED,REJECTED" },
];

const LIMIT = 30;

function AdminBookingsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [timelineTarget, setTimelineTarget] = useState<Booking | null>(null);
  const tabTotals = useRef<Record<number, number>>({});

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading: loading } = useQuery(
    adminBookingsQuery({ status: TABS[tab].statusQuery, page, search: search || undefined }),
  );
  const bookings: Booking[] = (data as any)?.bookings ?? [];
  const total: number = (data as any)?.total ?? 0;
  const totalPages: number = (data as any)?.totalPages ?? 1;
  const { data: timeline = [], isLoading: timelineLoading, isError: timelineError } = useQuery(
    bookingTimelineQuery(timelineTarget?.id ?? null),
  );

  // Keep per-tab totals so inactive tabs still show a count badge
  useEffect(() => {
    if (!loading && total > 0) tabTotals.current[tab] = total;
  }, [loading, tab, total]);

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (app.api.bookings as any)[id].approve.patch();
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin"] }); toast.success("Booking approved"); },
    onError: () => toast.error("Failed to approve"),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await (app.api.bookings as any)[id].reject.patch({ reason });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin"] });
      toast.success("Booking rejected");
      setRejectTarget(null);
      setRejectReason("");
    },
    onError: () => toast.error("Failed to reject"),
  });

  const displayed = bookings;

  function switchTab(i: number) {
    setTab(i);
    setPage(1);
  }

  const from = total === 0 ? 0 : (page - 1) * LIMIT + 1;
  const to = Math.min(page * LIMIT, total);

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Bookings</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Review and manage all room booking requests</p>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {/* Search + tabs toolbar */}
        <div className="px-5 pt-4 pb-0 border-b">
          <div className="relative max-w-sm mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search by room, user, or purpose…" value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)} className="pl-9 border-slate-200 bg-slate-50" />
          </div>
          <div className="flex gap-0">
            {TABS.map(({ label }, i) => {
              const displayCount = tab === i ? total : (tabTotals.current[i] ?? 0);
              return (
                <button key={label} onClick={() => switchTab(i)}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    tab === i
                      ? "border-blue-600 text-blue-700"
                      : "border-transparent text-muted-foreground hover:text-slate-700"
                  }`}>
                  {label}
                  {displayCount > 0 && (
                    <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-xs ${
                      tab === i ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"
                    }`}>
                      {displayCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <LoadingCentered />
        ) : displayed.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <CalendarDays className="w-6 h-6 opacity-40" />
            </div>
            <p className="text-sm font-medium">No bookings found</p>
          </div>
        ) : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b">
                {["Room", "User", "Date & Time", "Purpose", "Attendees", "Status", "Actions"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {displayed.map((b) => {
                const start = new Date(b.startTime);
                const end = new Date(b.endTime);
                const cfg = STATUS_CONFIG[b.status];
                const isActing = (approveMutation.isPending && approveMutation.variables === b.id) ||
                  (rejectMutation.isPending && rejectMutation.variables?.id === b.id);
                return (
                  <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-slate-800 truncate max-w-32">{b.room?.name ?? "—"}</p>
                      {b.room?.floor && <p className="text-xs text-muted-foreground">Floor {b.room.floor}</p>}
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-slate-800 truncate max-w-36">{b.user?.name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-36">{b.user?.email}</p>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <p className="flex items-center gap-1 text-xs font-medium text-slate-700">
                        <CalendarDays className="w-3 h-3 text-blue-500" />
                        {start.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <Clock className="w-3 h-3" />
                        {start.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}–
                        {end.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 max-w-36">
                      <p className="truncate text-sm text-slate-600">{b.purpose ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="flex items-center gap-1 text-slate-600">
                        <Users className="w-3.5 h-3.5 text-muted-foreground" />{b.attendees}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.cls || "bg-slate-50 text-slate-600 border-slate-200"}`}>
                        {cfg.label}
                      </span>
                      {b.status === "REJECTED" && b.rejectedReason && (
                        <p className="text-xs text-muted-foreground mt-1 max-w-28 truncate" title={b.rejectedReason}>
                          {b.rejectedReason}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-1.5">
                        <Button size="sm" variant="outline" onClick={() => setTimelineTarget(b)}
                          className="h-7 text-xs px-2.5">
                          <History className="w-3 h-3 mr-1" />Timeline
                        </Button>
                        {b.status === "PENDING" && (
                          <>
                          <Button size="sm" onClick={() => approveMutation.mutate(b.id)} disabled={isActing}
                            className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 px-2.5">
                            {isActing ? <Loader2 className="w-3 h-3 animate-spin" /> : <><CheckCircle2 className="w-3 h-3 mr-1" />Approve</>}
                          </Button>
                          <Button size="sm" variant="outline"
                            onClick={() => { setRejectTarget(b.id); setRejectReason(""); }}
                            disabled={isActing}
                            className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50 px-2.5">
                            <XCircle className="w-3 h-3 mr-1" />Reject
                          </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t text-sm">
            <span className="text-muted-foreground text-xs">
              {from}–{to} จาก {total} รายการ
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-7 px-2"
                onClick={() => setPage((p) => p - 1)} disabled={page <= 1}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-xs text-muted-foreground tabular-nums">หน้า {page}/{totalPages}</span>
              <Button variant="outline" size="sm" className="h-7 px-2"
                onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={!!rejectTarget} onOpenChange={(open) => { if (!open) setRejectTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Reject Booking</DialogTitle></DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="reason">Reason for rejection</Label>
            <Textarea id="reason" placeholder="e.g. Room unavailable, conflicting event…"
              value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>Cancel</Button>
            <Button variant="destructive"
              onClick={() => { if (!rejectTarget || !rejectReason.trim()) { toast.error("Please enter a reason"); return; } rejectMutation.mutate({ id: rejectTarget, reason: rejectReason }); }}
              disabled={rejectMutation.isPending}>
              {rejectMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              Reject Booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!timelineTarget} onOpenChange={(open) => { if (!open) setTimelineTarget(null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Booking timeline</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {timelineTarget?.room?.name ?? "Room"} · {timelineTarget?.user?.name ?? "User"}
            </p>
          </DialogHeader>
          {timelineLoading ? (
            <div className="py-10"><LoadingCentered /></div>
          ) : timelineError ? (
            <p className="py-8 text-center text-sm text-red-600">Unable to load the audit timeline.</p>
          ) : timeline.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No audit events recorded.</p>
          ) : (
            <ol className="relative ml-2 border-l border-slate-200 space-y-6 py-2">
              {timeline.map((event) => (
                <li key={event.id} className="ml-5">
                  <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-blue-600" />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-sm text-slate-900">
                      {event.eventType.replaceAll("_", " ")}
                    </span>
                    {event.newStatus && (
                      <Badge variant="outline" className="text-[10px]">
                        {event.previousStatus ? `${event.previousStatus} → ` : ""}{event.newStatus}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(event.createdAt).toLocaleString("en-GB", {
                      timeZone: "Asia/Bangkok",
                      dateStyle: "medium",
                      timeStyle: "medium",
                    })} · {event.actorType}{event.actorId ? ` (${event.actorId})` : ""}
                  </p>
                  {event.metadata && Object.keys(event.metadata).length > 0 && (
                    <pre className="mt-2 overflow-x-auto rounded-md bg-slate-50 p-2 text-[11px] text-slate-600">
                      {JSON.stringify(event.metadata, null, 2)}
                    </pre>
                  )}
                  {event.correlationId && (
                    <p className="mt-1 break-all font-mono text-[10px] text-slate-400">
                      correlation: {event.correlationId}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
