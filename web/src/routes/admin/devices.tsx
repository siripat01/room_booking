import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { app } from "../../lib/api";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Cpu, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { DeviceFormModal } from "../../components/devices/DeviceFormModal";
import { DeviceDetailSheet } from "../../components/devices/DeviceDetailSheet";
import { DeviceKeyDisplayModal } from "../../components/devices/DeviceKeyDisplayModal";
import { RotateKeyConfirmModal } from "../../components/devices/RotateKeyConfirmModal";
import { DeleteConfirmModal } from "../../components/devices/DeleteConfirmModal";
import { getDeviceStatus, formatRelativeTime, getStatusBadgeVariant } from "../../lib/device-utils";
import { getMockDevices, getMockRooms } from "../../data/mock-devices";
import type { Device, Room } from "../../types/device";

export const Route = createFileRoute("/admin/devices")({
  component: AdminDevicesPage,
});

type ApiRoom = {
  id: string;
  name: string;
  description?: string | null;
  capacity: number;
  floor: string;
  amenities: string[];
  isActive: boolean;
};

function computeStats(devices: Device[]) {
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
  const [devices, setDevices] = useState<Device[]>([]);
  const [rooms, setRooms] = useState<ApiRoom[]>([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Device | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailDevice, setDetailDevice] = useState<Device | null>(null);

  const [keyModalOpen, setKeyModalOpen] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newKeyDeviceName, setNewKeyDeviceName] = useState("");

  const [rotateOpen, setRotateOpen] = useState(false);
  const [rotateTarget, setRotateTarget] = useState<Device | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Device | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const [devicesRes, roomsRes] = await Promise.all([
        (app.api as any).devices.get(),
        app.api.rooms.get(),
      ]);
      if (devicesRes.data) setDevices(devicesRes.data as Device[]);
      if (roomsRes.data) setRooms(roomsRes.data as ApiRoom[]);
    } catch {
      setDevices(getMockDevices());
      setRooms(getMockRooms() as unknown as ApiRoom[]);
    } finally {
      setLoading(false);
    }
  }

  const roomsForForm: Room[] = rooms.map((r) => ({
    ...r,
    description: r.description ?? null,
    createdAt: "",
    updatedAt: "",
    device: devices.find((d) => d.roomId === r.id) ?? null,
  }));

  async function handleFormSubmit(data: { name: string; roomId: string | null }) {
    try {
      if (editTarget) {
        const { data: updated } = await (app.api as any).devices[editTarget.id].put({
          name: data.name,
          roomId: data.roomId,
        });
        if (updated) setDevices((prev) => prev.map((d) => d.id === editTarget.id ? (updated as Device) : d));
        toast.success("อัปเดต Kiosk แล้ว");
      } else {
        const { data: res } = await (app.api as any).devices.post({ name: data.name, roomId: data.roomId });
        if (res) {
          setDevices((prev) => [...prev, res.device as Device]);
          setNewKey(res.deviceKey);
          setNewKeyDeviceName(data.name);
          setKeyModalOpen(true);
        }
        toast.success("สร้าง Kiosk แล้ว");
      }
    } catch {
      toast.error(editTarget ? "อัปเดต Kiosk ไม่สำเร็จ" : "สร้าง Kiosk ไม่สำเร็จ");
    }
  }

  async function handleRotateKey() {
    if (!rotateTarget) return;
    try {
      const { data } = await (app.api as any).devices[rotateTarget.id]["rotate-key"].patch();
      if (data?.deviceKey) {
        setNewKey(data.deviceKey);
        setNewKeyDeviceName(rotateTarget.name);
        setKeyModalOpen(true);
      }
      toast.success("สร้าง Device Key ใหม่แล้ว");
    } catch {
      toast.error("ไม่สามารถ Rotate Key ได้");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await (app.api as any).devices[deleteTarget.id].delete();
      setDevices((prev) => prev.filter((d) => d.id !== deleteTarget.id));
      if (detailDevice?.id === deleteTarget.id) setDetailOpen(false);
      toast.success("ลบ Kiosk แล้ว");
    } catch {
      toast.error("ลบ Kiosk ไม่สำเร็จ");
    }
  }

  function openCreate() {
    setEditTarget(null);
    setFormOpen(true);
  }

  function openEdit(device: Device) {
    setEditTarget(device);
    setFormOpen(true);
  }

  function openDetail(device: Device) {
    setDetailDevice(device);
    setDetailOpen(true);
  }

  function openRotate(device: Device) {
    setDetailOpen(false);
    setRotateTarget(device);
    setRotateOpen(true);
  }

  function openDelete(device: Device) {
    setDetailOpen(false);
    setDeleteTarget(device);
    setDeleteOpen(true);
  }

  const stats = computeStats(devices);

  const STAT_CARDS = [
    { label: "ทั้งหมด", value: stats.total, color: "text-blue-600" },
    { label: "Online", value: stats.online, color: "text-green-600" },
    { label: "Offline", value: stats.offline, color: "text-red-600" },
    { label: "ยังไม่ผูกห้อง", value: stats.unassigned, color: "text-yellow-600" },
  ];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Devices</h1>
          <p className="text-muted-foreground">จัดการ Kiosk หน้าห้องประชุม</p>
        </div>
        <Button onClick={openCreate} className="flex items-center gap-2">
          <Plus className="w-4 h-4" /> เพิ่ม Kiosk
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
          <p className="text-sm mb-3">ยังไม่มี Kiosk</p>
          <Button onClick={openCreate} size="sm">เพิ่ม Kiosk แรก</Button>
        </div>
      ) : (
        <div className="rounded-lg border bg-background overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50">
              <tr>
                {["ชื่อ Kiosk", "สถานะ", "ห้องที่ผูก", "เห็นล่าสุด", "Actions"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {devices.map((device) => {
                const status = getDeviceStatus(device);
                return (
                  <tr
                    key={device.id}
                    className="hover:bg-secondary/20 transition-colors cursor-pointer"
                    onClick={() => openDetail(device)}
                  >
                    <td className="px-4 py-3 font-medium">{device.name}</td>
                    <td className="px-4 py-3">
                      <Badge variant={getStatusBadgeVariant(status)} className="gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
                        {status === "online" ? "Online" : status === "offline" ? "Offline" : "ไม่ทราบ"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {device.room ? (
                        <span>
                          {device.room.name}{" "}
                          <span className="text-muted-foreground text-xs">({device.room.floor})</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">ยังไม่ผูกห้อง</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {formatRelativeTime(device.lastSeenAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="outline" className="h-7 text-xs"
                          onClick={() => openEdit(device)}>
                          แก้ไข
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs"
                          onClick={() => openRotate(device)}>
                          Rotate Key
                        </Button>
                        <Button size="sm" variant="outline"
                          className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                          onClick={() => openDelete(device)}>
                          ลบ
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <DeviceFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={handleFormSubmit}
        device={editTarget}
        rooms={roomsForForm}
      />

      <DeviceDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        device={detailDevice ? { ...detailDevice, connectionHistory: [] } : null}
        onEdit={() => { setDetailOpen(false); if (detailDevice) openEdit(detailDevice); }}
        onRotateKey={() => { if (detailDevice) openRotate(detailDevice); }}
        onDelete={() => { if (detailDevice) openDelete(detailDevice); }}
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
        onConfirm={handleRotateKey}
      />

      <DeleteConfirmModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        deviceName={deleteTarget?.name ?? ""}
        onConfirm={handleDelete}
      />
    </div>
  );
}
