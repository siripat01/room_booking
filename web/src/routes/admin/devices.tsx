import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { devicesQuery, roomsQuery, type AdminDevice } from "../../lib/queries";
import { app } from "../../lib/api";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../../components/ui/dialog";
import { Cpu, Plus, Loader2, Smartphone, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { DeviceFormModal } from "../../components/devices/DeviceFormModal";
import { DeviceDetailSheet } from "../../components/devices/DeviceDetailSheet";
import { DeviceKeyDisplayModal } from "../../components/devices/DeviceKeyDisplayModal";
import { RotateKeyConfirmModal } from "../../components/devices/RotateKeyConfirmModal";
import { DeleteConfirmModal } from "../../components/devices/DeleteConfirmModal";
import { getDeviceStatus, formatRelativeTime, getStatusBadgeVariant } from "../../lib/device-utils";
import type { Device, Room } from "../../types/device";

export const Route = createFileRoute("/admin/devices")({
  loader: ({ context: { queryClient } }) => {
    if (typeof window === "undefined") return;
    return Promise.all([
      queryClient.ensureQueryData(devicesQuery()),
      queryClient.ensureQueryData(roomsQuery()),
    ]);
  },
  component: AdminDevicesPage,
});

function computeStats(devices: AdminDevice[]) {
  const oneMinAgo = new Date(Date.now() - 60_000);
  let online = 0, offline = 0, unassigned = 0;
  for (const d of devices) {
    if (!d.roomId) unassigned++;
    if (!d.lastSeenAt) continue;
    new Date(d.lastSeenAt) > oneMinAgo ? online++ : offline++;
  }
  return { total: devices.length, online, offline, unassigned };
}

function AdminDevicesPage() {
  const qc = useQueryClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminDevice | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailDevice, setDetailDevice] = useState<AdminDevice | null>(null);
  const [keyModalOpen, setKeyModalOpen] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newKeyDeviceName, setNewKeyDeviceName] = useState("");
  const [rotateOpen, setRotateOpen] = useState(false);
  const [rotateTarget, setRotateTarget] = useState<AdminDevice | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminDevice | null>(null);
  const [pairOpen, setPairOpen] = useState(false);
  const [pairCode, setPairCode] = useState("");
  const [pairDevice, setPairDevice] = useState<AdminDevice | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);

  const { data: devices = [], isLoading: loadingDevices } = useQuery(devicesQuery());
  const { data: apiRooms = [] } = useQuery(roomsQuery());
  const loading = loadingDevices;

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; roomId: string | null }) => {
      const { data: res, error } = await (app.api as any).devices.post({ name: data.name, roomId: data.roomId });
      if (error) throw error;
      return res;
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["admin", "devices"] });
      if (res?.deviceKey) {
        setNewKey(res.deviceKey);
        setNewKeyDeviceName(res.device?.name ?? "");
        setKeyModalOpen(true);
      }
      toast.success("Kiosk created");
    },
    onError: () => toast.error("Failed to create Kiosk"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string; roomId: string | null } }) => {
      const { error } = await (app.api as any).devices[id].put(data);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "devices"] });
      toast.success("Kiosk updated");
    },
    onError: () => toast.error("Failed to update Kiosk"),
  });

  const rotateKeyMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await (app.api as any).devices[id]["rotate-key"].patch();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data?.deviceKey) {
        setNewKey(data.deviceKey);
        setNewKeyDeviceName(rotateTarget?.name ?? "");
        setKeyModalOpen(true);
      }
      toast.success("Device key rotated");
    },
    onError: () => toast.error("Failed to rotate key"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (app.api as any).devices[id].delete();
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "devices"] });
      if (detailDevice?.id === deleteTarget?.id) setDetailOpen(false);
      toast.success("Kiosk deleted");
      setDeleteTarget(null);
      setDeleteOpen(false);
    },
    onError: () => toast.error("Failed to delete Kiosk"),
  });

  const pairMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/devices/${id}/generate-pairing`, { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("Failed to generate pairing code");
      return res.json() as Promise<{ code: string; expiresAt: string }>;
    },
    onSuccess: (data, id) => {
      const device = (devices as AdminDevice[]).find((d) => d.id === id) ?? null;
      setPairDevice(device);
      setPairCode(data.code);
      setCodeCopied(false);
      setPairOpen(true);
    },
    onError: () => toast.error("Failed to generate pairing code"),
  });

  async function handleFormSubmit(data: { name: string; roomId: string | null }) {
    if (editTarget) {
      updateMutation.mutate({ id: editTarget.id, data });
    } else {
      createMutation.mutate(data);
    }
    setFormOpen(false);
  }

  const roomsForForm: Room[] = apiRooms.map((r) => ({
    ...r,
    description: r.description ?? null,
    createdAt: "",
    updatedAt: "",
    device: (devices as AdminDevice[]).find((d) => d.roomId === r.id)
      ? { id: "", name: "", roomId: r.id, isActive: true, lastSeenAt: null, createdAt: "", updatedAt: "", deviceKey: "", room: null }
      : null,
  }));

  const stats = computeStats(devices as AdminDevice[]);
  const STAT_CARDS = [
    { label: "Total", value: stats.total, color: "text-blue-600" },
    { label: "Online", value: stats.online, color: "text-green-600" },
    { label: "Offline", value: stats.offline, color: "text-red-600" },
    { label: "Unassigned", value: stats.unassigned, color: "text-yellow-600" },
  ];

  const toDevice = (d: AdminDevice): Device => ({
    id: d.id,
    name: d.name,
    roomId: d.roomId ?? null,
    isActive: d.isActive,
    lastSeenAt: d.lastSeenAt ?? null,
    createdAt: d.createdAt,
    updatedAt: "",
    deviceKey: "",
    room: d.room ? { ...d.room, description: null, capacity: 0, amenities: [], isActive: true, createdAt: "", updatedAt: "", device: null } : null,
  });

  return (
    <div className="p-4 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Devices</h1>
          <p className="text-muted-foreground">Manage room kiosk devices</p>
        </div>
        <Button onClick={() => { setEditTarget(null); setFormOpen(true); }} className="flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Kiosk
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {STAT_CARDS.map(({ label, value, color }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">{label}</p>
              {loading ? (
                <div className="h-7 w-10 bg-muted rounded animate-pulse" />
              ) : (
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : devices.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Cpu className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm mb-3">No kiosks yet</p>
          <Button onClick={() => { setEditTarget(null); setFormOpen(true); }} size="sm">Add your first kiosk</Button>
        </div>
      ) : (
        <div className="rounded-lg border bg-background overflow-hidden">
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="bg-secondary/50">
              <tr>
                {["Name", "Status", "Room", "Last Seen", "Actions"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {(devices as AdminDevice[]).map((device) => {
                const d = toDevice(device);
                const status = getDeviceStatus(d);
                return (
                  <tr key={device.id} className="hover:bg-secondary/20 transition-colors cursor-pointer"
                    onClick={() => { setDetailDevice(device); setDetailOpen(true); }}>
                    <td className="px-4 py-3 font-medium">{device.name}</td>
                    <td className="px-4 py-3">
                      <Badge variant={getStatusBadgeVariant(status)} className="gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
                        {status === "online" ? "Online" : status === "offline" ? "Offline" : "Unknown"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {device.room ? (
                        <span>
                          {device.room.name}{" "}
                          <span className="text-muted-foreground text-xs">({device.room.floor})</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {formatRelativeTime(device.lastSeenAt ?? null)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="outline" className="h-7 text-xs"
                          onClick={() => { setEditTarget(device); setFormOpen(true); }}>
                          Edit
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs"
                          onClick={() => pairMutation.mutate(device.id)}>
                          Pair
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs"
                          onClick={() => { setRotateTarget(device); setRotateOpen(true); }}>
                          Rotate Key
                        </Button>
                        <Button size="sm" variant="outline"
                          className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                          onClick={() => { setDeleteTarget(device); setDeleteOpen(true); }}>
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        </div>
      )}

      <DeviceFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={handleFormSubmit}
        device={editTarget ? toDevice(editTarget) : null}
        rooms={roomsForForm}
      />

      <DeviceDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        device={detailDevice ? { ...toDevice(detailDevice), connectionHistory: [] } : null}
        onEdit={() => { setDetailOpen(false); if (detailDevice) { setEditTarget(detailDevice); setFormOpen(true); } }}
        onRotateKey={() => { if (detailDevice) { setRotateTarget(detailDevice); setRotateOpen(true); } }}
        onDelete={() => { if (detailDevice) { setDeleteTarget(detailDevice); setDeleteOpen(true); } }}
        onOpenKiosk={() => {
          if (detailDevice?.roomId) window.open(`/display/${detailDevice.roomId}`, "_blank");
        }}
      />

      <DeviceKeyDisplayModal
        open={keyModalOpen}
        onOpenChange={setKeyModalOpen}
        deviceKey={newKey}
        deviceName={newKeyDeviceName}
        onConfirm={() => setKeyModalOpen(false)}
      />

      <RotateKeyConfirmModal
        open={rotateOpen}
        onOpenChange={setRotateOpen}
        deviceName={rotateTarget?.name ?? ""}
        onConfirm={() => rotateTarget && rotateKeyMutation.mutate(rotateTarget.id)}
      />

      <DeleteConfirmModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        deviceName={deleteTarget?.name ?? ""}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />

      <Dialog open={pairOpen} onOpenChange={setPairOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="w-5 h-5" /> Pair Device
            </DialogTitle>
            <DialogDescription>
              On your iPad, open a browser and go to the URL below, then enter this code.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="bg-muted rounded-lg p-3 text-sm font-mono break-all text-center text-muted-foreground">
              {window.location.origin}/pair
            </div>

            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-2">Pairing code (expires in 10 min)</p>
              <div className="flex items-center justify-center gap-3">
                <span className="text-5xl font-mono font-bold tracking-[0.2em]">{pairCode}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(pairCode);
                    setCodeCopied(true);
                    setTimeout(() => setCodeCopied(false), 2000);
                  }}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {codeCopied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
              {pairDevice && <p className="text-xs text-muted-foreground mt-2">{pairDevice.name}</p>}
            </div>
          </div>

          <Button onClick={() => setPairOpen(false)} className="w-full">Done</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
