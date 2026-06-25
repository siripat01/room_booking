import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { roomsQuery, type Room } from "../../lib/queries";
import { app } from "../../lib/api";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Checkbox } from "../../components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "../../components/ui/dialog";
import { Building2, Pencil, Trash2, Plus, Users, Loader2, Wifi, Monitor, Wind, PenSquare, Tv } from "lucide-react";
import { LoadingCentered } from "../../components/LoadingSpinner";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/rooms")({
  loader: ({ context: { queryClient } }) => {
    if (typeof window === "undefined") return;
    return queryClient.ensureQueryData(roomsQuery());
  },
  component: AdminRoomsPage,
});

const AMENITY_OPTIONS = [
  { value: "projector", label: "Projector", icon: Monitor },
  { value: "whiteboard", label: "Whiteboard", icon: PenSquare },
  { value: "tv", label: "TV", icon: Tv },
  { value: "ac", label: "Air Conditioning", icon: Wind },
  { value: "wifi", label: "Wi-Fi", icon: Wifi },
];

const ROLE_OPTIONS = [
  { value: "userRole", label: "นักศึกษา" },
  { value: "teacherRole", label: "อาจารย์" },
  { value: "adminRole", label: "แอดมิน" },
];

const EMPTY_FORM = { name: "", description: "", capacity: "10", floor: "", amenities: [] as string[], allowedRoles: [] as string[], autoApprove: false };

function AdminRoomsPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Room | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Room | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: rooms = [], isLoading: loading } = useQuery(roomsQuery());

  const saveMutation = useMutation({
    mutationFn: async (payload: { name: string; description?: string; capacity: number; floor: string; amenities: string[]; allowedRoles: string[]; autoApprove: boolean }) => {
      if (editTarget) {
        const { error } = await (app.api.rooms as any)[editTarget.id].put(payload);
        if (error) throw error;
      } else {
        const { error } = await app.api.rooms.post(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rooms"] });
      toast.success(editTarget ? "Room updated" : "Room created");
      setModalOpen(false);
    },
    onError: () => toast.error(editTarget ? "Failed to update room" : "Failed to create room"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (app.api.rooms as any)[id].delete();
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rooms"] });
      toast.success("Room deleted");
      setDeleteTarget(null);
    },
    onError: () => toast.error("Failed to delete room"),
  });

  function openCreate() { setEditTarget(null); setForm(EMPTY_FORM); setModalOpen(true); }

  function openEdit(room: Room) {
    setEditTarget(room);
    setForm({ name: room.name, description: room.description ?? "", capacity: String(room.capacity), floor: room.floor, amenities: [...room.amenities], allowedRoles: [...(room.allowedRoles ?? [])], autoApprove: room.autoApprove ?? false });
    setModalOpen(true);
  }

  function toggleAmenity(val: string) {
    setForm((f) => ({ ...f, amenities: f.amenities.includes(val) ? f.amenities.filter((a) => a !== val) : [...f.amenities, val] }));
  }

  function toggleRole(val: string) {
    setForm((f) => ({ ...f, allowedRoles: f.allowedRoles.includes(val) ? f.allowedRoles.filter((r) => r !== val) : [...f.allowedRoles, val] }));
  }

  function handleSave() {
    if (!form.name.trim() || !form.floor.trim()) { toast.error("Name and floor are required"); return; }
    saveMutation.mutate({ name: form.name.trim(), description: form.description.trim() || undefined, capacity: parseInt(form.capacity) || 10, floor: form.floor.trim(), amenities: form.amenities, allowedRoles: form.allowedRoles, autoApprove: form.autoApprove });
  }

  return (
    <div className="p-4 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Rooms</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage meeting rooms and their details</p>
        </div>
        <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 gap-2">
          <Plus className="w-4 h-4" /> Add Room
        </Button>
      </div>

      {loading ? (
        <LoadingCentered />
      ) : rooms.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <Building2 className="w-7 h-7 opacity-40" />
          </div>
          <p className="font-medium">No rooms yet</p>
          <Button onClick={openCreate} size="sm" className="mt-3 bg-blue-600 hover:bg-blue-700">Add your first room</Button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b">
                {["Room", "Floor", "Capacity", "Amenities", "จองได้", "Auto-approve", "Status", "Actions"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rooms.map((room) => (
                <tr key={room.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3.5">
                    <p className="font-medium text-slate-800">{room.name}</p>
                    {room.description && <p className="text-xs text-muted-foreground truncate max-w-52">{room.description}</p>}
                  </td>
                  <td className="px-4 py-3.5 text-slate-600">Floor {room.floor}</td>
                  <td className="px-4 py-3.5">
                    <span className="flex items-center gap-1.5 text-slate-600">
                      <Users className="w-3.5 h-3.5 text-muted-foreground" />{room.capacity}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex flex-wrap gap-1">
                      {room.amenities.slice(0, 3).map((a) => (
                        <span key={a} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-md border border-blue-100 capitalize">{a}</span>
                      ))}
                      {room.amenities.length > 3 && (
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-xs rounded-md border">+{room.amenities.length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex flex-wrap gap-1">
                      {!(room as any).allowedRoles?.length ? (
                        <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 text-xs rounded-md border border-emerald-100">ทุกคน</span>
                      ) : (room as any).allowedRoles.map((r: string) => (
                        <span key={r} className="px-1.5 py-0.5 bg-violet-50 text-violet-700 text-xs rounded-md border border-violet-100">
                          {r === "teacherRole" ? "อาจารย์" : r === "adminRole" ? "แอดมิน" : "นักศึกษา"}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    {room.autoApprove ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-emerald-50 text-emerald-700 border-emerald-200">On</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-slate-100 text-slate-500 border-slate-200">Off</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                      room.isActive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-500 border-slate-200"
                    }`}>
                      {room.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => openEdit(room)} className="h-7 w-7 p-0 hover:border-blue-300 hover:text-blue-600">
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setDeleteTarget(room)}
                        className="h-7 w-7 p-0 text-red-500 border-red-200 hover:bg-red-50">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editTarget ? "Edit Room" : "Add New Room"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="rname">Room Name</Label>
                <Input id="rname" placeholder="e.g. Conference Room A" value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="floor">Floor</Label>
                <Input id="floor" placeholder="e.g. 3" value={form.floor}
                  onChange={(e) => setForm((f) => ({ ...f, floor: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cap">Capacity</Label>
                <Input id="cap" type="number" min="1" placeholder="10" value={form.capacity}
                  onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="desc">Description</Label>
                <Textarea id="desc" placeholder="Optional description…" rows={2} value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Amenities</Label>
                <div className="grid grid-cols-2 gap-2">
                  {AMENITY_OPTIONS.map(({ value, label, icon: Icon }) => (
                    <label key={value} className={`flex items-center gap-2.5 cursor-pointer text-sm p-2.5 rounded-lg border transition-colors ${
                      form.amenities.includes(value) ? "border-blue-300 bg-blue-50 text-blue-700" : "border-slate-200 hover:border-slate-300"
                    }`}>
                      <Checkbox checked={form.amenities.includes(value)} onCheckedChange={() => toggleAmenity(value)} />
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="col-span-2 space-y-2">
                <Label>ใครจองได้</Label>
                <p className="text-xs text-muted-foreground -mt-1">ไม่เลือก = ทุกคนจองได้</p>
                <div className="flex gap-2 flex-wrap">
                  {ROLE_OPTIONS.map(({ value, label }) => (
                    <label key={value} className={`flex items-center gap-2 cursor-pointer text-sm px-3 py-2 rounded-lg border transition-colors ${
                      form.allowedRoles.includes(value) ? "border-blue-300 bg-blue-50 text-blue-700" : "border-slate-200 hover:border-slate-300"
                    }`}>
                      <Checkbox checked={form.allowedRoles.includes(value)} onCheckedChange={() => toggleRole(value)} />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="col-span-2">
                <label className={`flex items-center gap-3 cursor-pointer text-sm px-3 py-2.5 rounded-lg border transition-colors ${
                  form.autoApprove ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 hover:border-slate-300"
                }`}>
                  <Checkbox checked={form.autoApprove} onCheckedChange={(v) => setForm((f) => ({ ...f, autoApprove: !!v }))} />
                  <div>
                    <p className="font-medium">Auto-approve bookings</p>
                    <p className="text-xs text-muted-foreground">การจองทุกรายการจะได้รับการยืนยันทันที ไม่ต้องรออนุมัติ</p>
                  </div>
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
              {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editTarget ? "Save Changes" : "Create Room"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Delete Room</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}>
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete Room
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
