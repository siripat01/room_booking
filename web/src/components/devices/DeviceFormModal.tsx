"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Device, Room } from "../../types/device";
import { cn } from "../../lib/utils";

interface DeviceFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { name: string; roomId: string | null }) => void;
  device?: Device | null;
  rooms: Room[];
  isLoading?: boolean;
}

export function DeviceFormModal({
  open,
  onOpenChange,
  onSubmit,
  device,
  rooms,
  isLoading = false,
}: DeviceFormModalProps) {
  const [name, setName] = useState(device?.name || "");
  const [roomId, setRoomId] = useState<string | null>(device?.roomId || null);

  const availableRooms = rooms.filter((r) => r.isActive);
  const occupiedRoomIds = new Set(
    rooms.filter((r) => r.device && r.device.id !== device?.id).map((r) => r.device?.roomId).filter(Boolean)
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), roomId });
    onOpenChange(false);
  };

  const handleClose = () => {
    setName(device?.name || "");
    setRoomId(device?.roomId || null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{device ? "แก้ไข Kiosk" : "เพิ่ม Kiosk ใหม่"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">ชื่อ Kiosk <span className="text-red-500">*</span></Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="เช่น Kiosk ห้อง A101"
                required
                disabled={isLoading}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="roomId">ห้องที่ผูก</Label>
              <select
                id="roomId"
                value={roomId || ""}
                onChange={(e) => setRoomId(e.target.value || null)}
                className={cn(
                  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                  isLoading && "opacity-50"
                )}
                disabled={isLoading}
              >
                <option value="">-- ไม่ผูกห้อง --</option>
                {availableRooms.map((room) => (
                  <option
                    key={room.id}
                    value={room.id}
                    disabled={occupiedRoomIds.has(room.id)}
                    title={occupiedRoomIds.has(room.id) ? "ห้องนี้มี Kiosk แล้ว" : undefined}
                  >
                    {room.name} ({room.floor}) - {room.capacity} คน
                    {occupiedRoomIds.has(room.id) && " (มี Kiosk แล้ว)"}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                เลือกห้องที่จะผูกกับ Kiosk นี้ (ไม่บังคับ)
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={handleClose} disabled={isLoading}>
              ยกเลิก
            </Button>
            <Button type="submit" disabled={isLoading || !name.trim()}>
              {isLoading ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
