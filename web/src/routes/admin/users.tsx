import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { app } from "../../lib/api";
import { roleLabel, type UserRole } from "../../lib/useCurrentUser";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import { Users, Search, Loader2, ShieldAlert, CalendarDays } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsersPage,
});

type User = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  role?: string | null;
  banned?: boolean | null;
  banReason?: string | null;
  createdAt: string;
  _count?: { bookings: number };
};

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "userRole", label: "Student" },
  { value: "teacherRole", label: "Teacher" },
  { value: "adminRole", label: "Admin" },
];

function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [acting, setActing] = useState<string | null>(null);
  const [banTarget, setBanTarget] = useState<User | null>(null);
  const [banReason, setBanReason] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const { data } = await (app.api.users as any).get();
      if (data) setUsers(data as User[]);
    } catch {
      setUsers(DEMO_USERS);
    } finally {
      setLoading(false);
    }
  }

  const displayed = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  async function changeRole(userId: string, role: string) {
    setActing(userId);
    try {
      await (app.api.users as any)[userId].role.patch({ role });
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role } : u));
      toast.success(`Role updated to ${roleLabel(role as UserRole)}`);
    } catch {
      toast.error("Failed to update role");
    } finally {
      setActing(null);
    }
  }

  async function ban() {
    if (!banTarget || !banReason.trim()) { toast.error("Please enter a reason"); return; }
    setActing(banTarget.id);
    try {
      await (app.api.users as any)[banTarget.id].ban.patch({ reason: banReason });
      setUsers((prev) => prev.map((u) => u.id === banTarget.id ? { ...u, banned: true, banReason } : u));
      toast.success(`${banTarget.name} has been banned`);
      setBanTarget(null);
      setBanReason("");
    } catch {
      toast.error("Failed to ban user");
    } finally {
      setActing(null);
    }
  }

  async function unban(user: User) {
    setActing(user.id);
    try {
      await (app.api.users as any)[user.id].unban.patch();
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, banned: false, banReason: null } : u));
      toast.success(`${user.name} has been unbanned`);
    } catch {
      toast.error("Failed to unban user");
    } finally {
      setActing(null);
    }
  }

  const initials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="text-muted-foreground">Manage user roles and access</p>
      </div>

      <div className="relative max-w-sm mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search by name or email…" value={search}
          onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : displayed.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No users found</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-background overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50">
              <tr>
                {["User", "Email", "Role", "Bookings", "Joined", "Status", "Actions"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {displayed.map((u) => {
                const isActing = acting === u.id;
                const currentRole = (u.role ?? "userRole") as UserRole;

                return (
                  <tr key={u.id} className={`hover:bg-secondary/20 transition-colors ${u.banned ? "opacity-60" : ""}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        {u.image ? (
                          <img src={u.image} alt={u.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center text-xs font-semibold shrink-0">
                            {initials(u.name)}
                          </div>
                        )}
                        <span className="font-medium truncate max-w-32">{u.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground truncate max-w-44">{u.email}</td>
                    <td className="px-4 py-3">
                      <select
                        value={currentRole}
                        onChange={(e) => changeRole(u.id, e.target.value)}
                        disabled={isActing}
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                      >
                        {ROLE_OPTIONS.map(({ value, label }) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="flex items-center gap-1 justify-center text-muted-foreground">
                        <CalendarDays className="w-3.5 h-3.5" />
                        {u._count?.bookings ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {new Date(u.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3">
                      {u.banned ? (
                        <div>
                          <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                            <ShieldAlert className="w-3 h-3" /> Banned
                          </Badge>
                          {u.banReason && <p className="text-xs text-muted-foreground mt-0.5 max-w-28 truncate">{u.banReason}</p>}
                        </div>
                      ) : (
                        <Badge variant="success">Active</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {u.banned ? (
                        <Button size="sm" variant="outline" onClick={() => unban(u)} disabled={isActing}
                          className="h-7 text-xs">
                          {isActing ? <Loader2 className="w-3 h-3 animate-spin" /> : "Unban"}
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => { setBanTarget(u); setBanReason(""); }}
                          disabled={isActing}
                          className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/10">
                          Ban
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Ban dialog */}
      <Dialog open={!!banTarget} onOpenChange={(open) => { if (!open) setBanTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ban User</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            You are about to ban <strong>{banTarget?.name}</strong>. They will no longer be able to sign in.
          </p>
          <div className="space-y-1.5 py-2">
            <Label htmlFor="banreason">Reason</Label>
            <Input id="banreason" placeholder="e.g. Repeated misuse of booking system"
              value={banReason} onChange={(e) => setBanReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBanTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={ban} disabled={!!acting}>
              {acting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Ban User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const DEMO_USERS: User[] = [
  { id: "u1", name: "Somchai Petcharat", email: "s.petcharat@kmitl.ac.th", role: "userRole", banned: false, createdAt: "2025-09-01", _count: { bookings: 12 } },
  { id: "u2", name: "Malee Kaewsai", email: "m.kaewsai@kmitl.ac.th", role: "teacherRole", banned: false, createdAt: "2025-08-20", _count: { bookings: 34 } },
  { id: "u3", name: "Arisa Wongsuwan", email: "a.wongsuwan@kmitl.ac.th", role: "userRole", banned: false, createdAt: "2025-09-10", _count: { bookings: 5 } },
  { id: "u4", name: "Niran Thongchai", email: "n.thongchai@kmitl.ac.th", role: "adminRole", banned: false, createdAt: "2025-07-01", _count: { bookings: 8 } },
  { id: "u5", name: "Pimrak Srisuk", email: "p.srisuk@kmitl.ac.th", role: "userRole", banned: true, banReason: "Repeated no-shows", createdAt: "2025-09-15", _count: { bookings: 2 } },
];
