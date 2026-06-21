import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminUsersQuery, type AdminUser } from "../../lib/queries";
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
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(adminUsersQuery()),
  component: AdminUsersPage,
});

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "userRole", label: "Student" },
  { value: "teacherRole", label: "Teacher" },
  { value: "adminRole", label: "Admin" },
];

function AdminUsersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [banTarget, setBanTarget] = useState<AdminUser | null>(null);
  const [banReason, setBanReason] = useState("");

  const { data, isLoading: loading } = useQuery(adminUsersQuery());
  const users: AdminUser[] = (data as any)?.users ?? [];

  const roleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const { error } = await (app.api.users as any)[userId].role.patch({ role });
      if (error) throw error;
    },
    onSuccess: (_, { role }) => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success(`Role updated to ${roleLabel(role as UserRole)}`);
    },
    onError: () => toast.error("Failed to update role"),
  });

  const banMutation = useMutation({
    mutationFn: async ({ userId, reason }: { userId: string; reason: string }) => {
      const { error } = await (app.api.users as any)[userId].ban.patch({ reason });
      if (error) throw error;
    },
    onSuccess: (_, { userId }) => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      const u = users.find((u) => u.id === userId);
      toast.success(`${u?.name ?? "User"} has been banned`);
      setBanTarget(null);
      setBanReason("");
    },
    onError: () => toast.error("Failed to ban user"),
  });

  const unbanMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await (app.api.users as any)[userId].unban.patch();
      if (error) throw error;
    },
    onSuccess: (_, userId) => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      const u = users.find((u) => u.id === userId);
      toast.success(`${u?.name ?? "User"} has been unbanned`);
    },
    onError: () => toast.error("Failed to unban user"),
  });

  function handleBan() {
    if (!banTarget || !banReason.trim()) { toast.error("Please enter a reason"); return; }
    banMutation.mutate({ userId: banTarget.id, reason: banReason });
  }

  const displayed = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

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
                const currentRole = (u.role ?? "userRole") as UserRole;
                const isRoleActing = roleMutation.isPending && (roleMutation.variables as any)?.userId === u.id;
                const isBanActing = (banMutation.isPending && (banMutation.variables as any)?.userId === u.id) ||
                  (unbanMutation.isPending && unbanMutation.variables === u.id);

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
                        onChange={(e) => roleMutation.mutate({ userId: u.id, role: e.target.value })}
                        disabled={isRoleActing}
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
                        <Button size="sm" variant="outline" onClick={() => unbanMutation.mutate(u.id)}
                          disabled={isBanActing} className="h-7 text-xs">
                          {isBanActing ? <Loader2 className="w-3 h-3 animate-spin" /> : "Unban"}
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => { setBanTarget(u); setBanReason(""); }}
                          disabled={isBanActing}
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
            <Button variant="destructive" onClick={handleBan} disabled={banMutation.isPending}>
              {banMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Ban User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
