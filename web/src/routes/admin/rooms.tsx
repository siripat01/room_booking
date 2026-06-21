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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import { Building2, Pencil, Trash2, Plus, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/rooms")({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(roomsQuery()),
  component: AdminRoomsPage,
});

const AMENITY_OPTIONS = [
  { value: "projector", label: "Projector" },
  { value: "whiteboard", label: "Whiteboard" },
  { value: "tv", label: "TV" },
  { value: "ac", label: "Air Conditioning" },
  { value: "wifi", label: "Wi-Fi" },
];

const EMPTY_FORM = { name: "", description: "", capacity: "10", floor: "", amenities: [] as string[] };

function AdminRoomsPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Room | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Room | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: rooms = [], isLoading: loading } = useQuery(roomsQuery());

  const saveMutation = useMutation({
    mutationFn: async (payload: { name: string; description?: string; capacity: number; floor: string; amenities: string[] }) => {
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

  function openCreate() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(room: Room) {
    setEditTarget(room);
    setForm({
      name: room.name,
      description: room.description ?? "",
      capacity: String(room.capacity),
      floor: room.floor,
      amenities: [...room.amenities],
    });
    setModalOpen(true);
  }

  function toggleAmenity(val: string) {
    setForm((f) => ({
      ...f,
      amenities: f.amenities.includes(val)
        ? f.amenities.filter((a) => a !== val)
        : [...f.amenities, val],
    }));
  }

  function handleSave() {
    if (!form.name.trim() || !form.floor.trim()) { toast.error("Name and floor are required"); return; }
    saveMutation.mutate({
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      capacity: parseInt(form.capacity) || 10,
      floor: form.floor.trim(),
      amenities: form.amenities,
    });
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Rooms</h1>
          <p className="text-muted-foreground">Manage meeting rooms and their details</p>
        </div>
        <Button onClick={openCreate} className="flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Room
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : rooms.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Building2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm mb-3">No rooms yet</p>
          <Button onClick={openCreate} size="sm">Add your first room</Button>
        </div>
      ) : (
        <div className="rounded-lg border bg-background overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50">
              <tr>
                {["Room", "Floor", "Capacity", "Amenities", "Status", "Actions"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rooms.map((room) => (
                <tr key={room.id} className="hover:bg-secondary/20 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium">{room.name}</p>
                    {room.description && (
                      <p className="text-xs text-muted-foreground truncate max-w-48">{room.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">Floor {room.floor}</td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5 text-muted-foreground" />{room.capacity}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {room.amenities.slice(0, 3).map((a) => (
                        <Badge key={a} variant="secondary" className="text-xs capitalize">{a}</Badge>
                      ))}
                      {room.amenities.length > 3 && (
                        <Badge variant="outline" className="text-xs">+{room.amenities.length - 3}</Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={room.isActive ? "success" : "secondary"}>
                      {room.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => openEdit(room)} className="h-7 w-7 p-0">
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setDeleteTarget(room)}
                        className="h-7 w-7 p-0 text-destructive border-destructive/30 hover:bg-destructive/10">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Edit Room" : "Add New Room"}</DialogTitle>
          </DialogHeader>
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
                  {AMENITY_OPTIONS.map(({ value, label }) => (
                    <label key={value} className="flex items-center gap-2 cursor-pointer text-sm">
                      <Checkbox checked={form.amenities.includes(value)} onCheckedChange={() => toggleAmenity(value)} />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editTarget ? "Save Changes" : "Create Room"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Room</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This will also remove all associated bookings and cannot be undone.
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
