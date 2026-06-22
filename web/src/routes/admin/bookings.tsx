import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminBookingsQuery, type BookingStatus, type Booking } from "../../lib/queries";
import { app } from "../../lib/api";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "../../components/ui/dialog";
import { CalendarDays, Clock, Users, CheckCircle2, XCircle, Loader2, Search } from "lucide-react";
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

const TABS: { label: string; statuses: BookingStatus[] | null }[] = [
  { label: "All",       statuses: null },
  { label: "Pending",   statuses: ["PENDING"] },
  { label: "Confirmed", statuses: ["CONFIRMED", "CHECKED_IN"] },
  { label: "Done",      statuses: ["COMPLETED", "EXPIRED"] },
  { label: "Cancelled", statuses: ["CANCELLED", "REJECTED"] },
];

function AdminBookingsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState("");
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data, isLoading: loading } = useQuery(adminBookingsQuery());
  const bookings: Booking[] = (data as any)?.bookings ?? [];

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

  const activeStatuses = TABS[tab].statuses;
  const displayed = bookings
    .filter((b) => !activeStatuses || (activeStatuses as string[]).includes(b.status))
    .filter((b) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return b.room?.name?.toLowerCase().includes(q) || b.user?.name?.toLowerCase().includes(q) ||
        b.user?.email?.toLowerCase().includes(q) || b.purpose?.toLowerCase().includes(q);
    });

  const tabCount = (s: BookingStatus[] | null) =>
    bookings.filter((b) => !s || (s as string[]).includes(b.status)).length;

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
            <Input placeholder="Search by room, user, or purpose…" value={search}
              onChange={(e) => setSearch(e.target.value)} className="pl-9 border-slate-200 bg-slate-50" />
          </div>
          <div className="flex gap-0">
            {TABS.map(({ label, statuses }, i) => (
              <button key={label} onClick={() => setTab(i)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  tab === i
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-muted-foreground hover:text-slate-700"
                }`}>
                {label}
                <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-xs ${
                  tab === i ? "bg-blue-100 text-blue-700" : "bg-slate-100"
                }`}>{tabCount(statuses)}</span>
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
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
                      {b.status === "PENDING" && (
                        <div className="flex gap-1.5">
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
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
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
    </div>
  );
}
