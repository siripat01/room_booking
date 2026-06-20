import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { app } from "../../lib/api";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import {
  CalendarDays, Clock, Users, Building2,
  CheckCircle2, XCircle, Timer, Loader2, Search,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/bookings")({
  component: AdminBookingsPage,
});

type BookingStatus = "PENDING" | "CONFIRMED" | "CHECKED_IN" | "COMPLETED" | "CANCELLED" | "REJECTED" | "EXPIRED";

type Booking = {
  id: string;
  status: BookingStatus;
  startTime: string;
  endTime: string;
  attendees: number;
  purpose?: string | null;
  rejectedReason?: string | null;
  createdAt: string;
  room?: { name: string; floor: string } | null;
  user?: { name: string; email: string; image?: string | null } | null;
};

const STATUS_CONFIG: Record<BookingStatus, { label: string; variant: any }> = {
  PENDING:    { label: "Pending",    variant: "warning" },
  CONFIRMED:  { label: "Confirmed",  variant: "success" },
  CHECKED_IN: { label: "Checked In", variant: "success" },
  COMPLETED:  { label: "Completed",  variant: "secondary" },
  CANCELLED:  { label: "Cancelled",  variant: "outline" },
  REJECTED:   { label: "Rejected",   variant: "destructive" },
  EXPIRED:    { label: "Expired",    variant: "outline" },
};

const TABS: { label: string; statuses: BookingStatus[] | null }[] = [
  { label: "All",       statuses: null },
  { label: "Pending",   statuses: ["PENDING"] },
  { label: "Confirmed", statuses: ["CONFIRMED", "CHECKED_IN"] },
  { label: "Done",      statuses: ["COMPLETED", "EXPIRED"] },
  { label: "Cancelled", statuses: ["CANCELLED", "REJECTED"] },
];

function AdminBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState("");
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const { data } = await (app.api.bookings as any).get();
      if (data) setBookings(data as Booking[]);
    } catch {
      setBookings(DEMO_BOOKINGS);
    } finally {
      setLoading(false);
    }
  }

  const activeStatuses = TABS[tab].statuses;
  const displayed = bookings
    .filter((b) => !activeStatuses || (activeStatuses as string[]).includes(b.status))
    .filter((b) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        b.room?.name?.toLowerCase().includes(q) ||
        b.user?.name?.toLowerCase().includes(q) ||
        b.user?.email?.toLowerCase().includes(q) ||
        b.purpose?.toLowerCase().includes(q)
      );
    });

  async function approve(id: string) {
    setActing(id);
    try {
      const { data } = await (app.api.bookings as any)[id].approve.patch();
      setBookings((prev) => prev.map((b) => b.id === id ? { ...b, status: "CONFIRMED" } : b));
      toast.success("Booking approved");
    } catch { toast.error("Failed to approve"); }
    finally { setActing(null); }
  }

  async function reject() {
    if (!rejectTarget || !rejectReason.trim()) { toast.error("Please enter a reason"); return; }
    setActing(rejectTarget);
    try {
      await (app.api.bookings as any)[rejectTarget].reject.patch({ reason: rejectReason });
      setBookings((prev) => prev.map((b) => b.id === rejectTarget ? { ...b, status: "REJECTED", rejectedReason: rejectReason } : b));
      toast.success("Booking rejected");
      setRejectTarget(null);
      setRejectReason("");
    } catch { toast.error("Failed to reject"); }
    finally { setActing(null); }
  }

  const tabCount = (statuses: BookingStatus[] | null) =>
    bookings.filter((b) => !statuses || (statuses as string[]).includes(b.status)).length;

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Bookings</h1>
        <p className="text-muted-foreground">Review and manage all room booking requests</p>
      </div>

      {/* Search */}
      <div className="relative max-w-sm mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search by room, user, or purpose…" value={search}
          onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b mb-5">
        {TABS.map(({ label, statuses }, i) => (
          <button key={label} onClick={() => setTab(i)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === i ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            {label}
            <span className="ml-1.5 rounded-full bg-secondary px-1.5 py-0.5 text-xs">{tabCount(statuses)}</span>
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : displayed.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <CalendarDays className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No bookings found</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-background overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50">
              <tr>
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
                const isActing = acting === b.id;

                return (
                  <tr key={b.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium truncate max-w-32">{b.room?.name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">Floor {b.room?.floor}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium truncate max-w-36">{b.user?.name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-36">{b.user?.email}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="flex items-center gap-1 text-xs">
                        <CalendarDays className="w-3 h-3" />
                        {start.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <Clock className="w-3 h-3" />
                        {start.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}–
                        {end.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </td>
                    <td className="px-4 py-3 max-w-40">
                      <p className="truncate text-sm">{b.purpose ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="flex items-center gap-1 justify-center">
                        <Users className="w-3 h-3 text-muted-foreground" />{b.attendees}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={cfg.variant}>{cfg.label}</Badge>
                      {b.status === "REJECTED" && b.rejectedReason && (
                        <p className="text-xs text-muted-foreground mt-1 max-w-28 truncate" title={b.rejectedReason}>
                          {b.rejectedReason}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {b.status === "PENDING" && (
                        <div className="flex gap-1.5">
                          <Button size="sm" onClick={() => approve(b.id)} disabled={isActing}
                            className="h-7 text-xs bg-green-600 hover:bg-green-700 px-2">
                            {isActing ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { setRejectTarget(b.id); setRejectReason(""); }}
                            disabled={isActing} className="h-7 text-xs text-destructive border-destructive/30 px-2">
                            <XCircle className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Reject dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={(open) => { if (!open) setRejectTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Booking</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="reason">Reason for rejection</Label>
            <Textarea id="reason" placeholder="e.g. Room unavailable, conflicting event…"
              value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={reject} disabled={!!acting}>
              {acting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Reject Booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const now = new Date();
const addH = (h: number) => new Date(now.getTime() + h * 3600000).toISOString();
const subH = (h: number) => new Date(now.getTime() - h * 3600000).toISOString();
const DEMO_BOOKINGS: Booking[] = [
  { id: "b1", status: "PENDING", startTime: addH(2), endTime: addH(3), attendees: 5, purpose: "Team standup", createdAt: subH(1), room: { name: "Conference Room A", floor: "3" }, user: { name: "Somchai P.", email: "s.p@kmitl.ac.th" } },
  { id: "b2", status: "PENDING", startTime: addH(5), endTime: addH(7), attendees: 12, purpose: "Lecture: Data Structures", createdAt: subH(2), room: { name: "Training Room", floor: "4" }, user: { name: "Malee K.", email: "m.k@kmitl.ac.th" } },
  { id: "b3", status: "CONFIRMED", startTime: addH(1), endTime: addH(2), attendees: 4, purpose: "Project review", createdAt: subH(5), room: { name: "Meeting Room B", floor: "2" }, user: { name: "Arisa W.", email: "a.w@kmitl.ac.th" } },
  { id: "b4", status: "COMPLETED", startTime: subH(3), endTime: subH(2), attendees: 8, purpose: "Workshop", createdAt: subH(48), room: { name: "Board Room", floor: "5" }, user: { name: "Niran T.", email: "n.t@kmitl.ac.th" } },
  { id: "b5", status: "REJECTED", startTime: addH(10), endTime: addH(12), attendees: 3, purpose: "Study session", rejectedReason: "Room unavailable for maintenance", createdAt: subH(6), room: { name: "Focus Room", floor: "2" }, user: { name: "Pimrak S.", email: "p.s@kmitl.ac.th" } },
];
