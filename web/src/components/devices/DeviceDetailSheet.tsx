"use client";

import { useState } from "react";
import { Copy, Eye, EyeOff, ExternalLink, Edit, Trash2, RefreshCw } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Device, DeviceDetail } from "@/types/device";
import { getDeviceStatus, formatRelativeTime, maskDeviceKey, getStatusBadgeVariant } from "@/lib/device-utils";
import { cn } from "@/lib/utils";

interface DeviceDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  device: DeviceDetail | null;
  onEdit: () => void;
  onRotateKey: () => void;
  onDelete: () => void;
  onOpenKiosk: () => void;
  isLoading?: boolean;
}

export function DeviceDetailSheet({
  open,
  onOpenChange,
  device,
  onEdit,
  onRotateKey,
  onDelete,
  onOpenKiosk,
  isLoading = false,
}: DeviceDetailSheetProps) {
  const [showKey, setShowKey] = useState(false);

  if (!device) return null;

  const status = getDeviceStatus(device);
  const statusVariant = getStatusBadgeVariant(status);
  const maskedKey = maskDeviceKey(device.deviceKey);

  const connectionHistory = device.connectionHistory || [
    { timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(), status: "connected" },
    { timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), status: "disconnected" },
    { timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), status: "connected" },
    { timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), status: "disconnected" },
    { timestamp: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), status: "connected" },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[480px] max-w-[90vw]">
        <SheetHeader>
          <SheetTitle>{device.name}</SheetTitle>
          <SheetDescription>รายละเอียดและการจัดการ Kiosk</SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-4">
          <Separator />

          <section>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">ข้อมูลทั่วไป</h3>
            <dl className="space-y-3 text-sm">
              <div className="grid grid-cols-[100px_1fr] gap-x-4 gap-y-2">
                <dt className="text-muted-foreground">ชื่อ Kiosk</dt>
                <dd className="font-medium">{device.name}</dd>

                <dt className="text-muted-foreground">ห้องที่ผูก</dt>
                <dd className="font-medium flex items-center gap-2">
                  {device.room ? (
                    <>
                      <span>{device.room.name}</span>
                      <Badge variant="secondary" className="text-xs">{device.room.floor}</Badge>
                    </>
                  ) : (
                    <span className="text-muted-foreground">ยังไม่ผูกห้อง</span>
                  )}
                </dd>

                <dt className="text-muted-foreground">สถานะ</dt>
                <dd>
                  <Badge variant={statusVariant} className="gap-1.5">
                    {status === "online" && <span className="h-1.5 w-1.5 rounded-full bg-green-500" />}
                    {status === "offline" && <span className="h-1.5 w-1.5 rounded-full bg-red-500" />}
                    {status === "unknown" && <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />}
                    {status === "online" && "Online"}
                    {status === "offline" && "Offline"}
                    {status === "unknown" && "ไม่ทราบ"}
                  </Badge>
                </dd>

                <dt className="text-muted-foreground">วันที่สร้าง</dt>
                <dd>{new Date(device.createdAt).toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</dd>

                <dt className="text-muted-foreground">เห็นล่าสุด</dt>
                <dd>{formatRelativeTime(device.lastSeenAt)}</dd>
              </div>
            </dl>
          </section>

          <Separator />

          <section>
            <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center justify-between">
              Device Key
              <Button variant="ghost" size="icon" onClick={() => setShowKey(!showKey)} aria-label={showKey ? "ซ่อน key" : "แสดง key"}>
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </h3>
            <div className="space-y-2">
              <div className="relative">
                <code className={cn(
                  "font-mono text-sm bg-gray-100 border rounded-md px-3 py-2 block break-all",
                  !showKey && "text-transparent bg-clip-text bg-gradient-to-r from-gray-400 to-gray-500"
                )}>
                  {showKey ? device.deviceKey : "••••••••••••••••••••••••••••••••"}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-2"
                  onClick={() => navigator.clipboard.writeText(device.deviceKey)}
                  aria-label="Copy device key"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {showKey ? "กดไอคอนลูกตาเพื่อซ่อน key" : "กดไอคอนลูกตาเพื่อแสดง key"}
              </p>
            </div>
          </section>

          <Separator />

          <section>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">ประวัติการเชื่อมต่อ (ล่าสุด 5 รายการ)</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {connectionHistory.slice(0, 5).map((item, index) => (
                <div key={index} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded">
                  <span className={cn(
                    "font-medium",
                    item.status === "connected" ? "text-green-600" : "text-red-600"
                  )}>
                    {item.status === "connected" ? "🟢 Connected" : "🔴 Disconnected"}
                  </span>
                  <span className="text-muted-foreground">
                    {new Date(item.timestamp).toLocaleString("th-TH", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <Separator />

          <section>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Quick Actions</h3>
            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={onOpenKiosk}
                disabled={!device.roomId || isLoading}
              >
                <ExternalLink className="h-4 w-4" />
                เปิดหน้า Kiosk
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={onEdit}
                disabled={isLoading}
              >
                <Edit className="h-4 w-4" />
                แก้ไข Kiosk
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={onRotateKey}
                disabled={isLoading}
              >
                <RefreshCw className="h-4 w-4" />
                Rotate Key
              </Button>
              <Button
                variant="destructive"
                className="w-full justify-start gap-2"
                onClick={onDelete}
                disabled={isLoading}
              >
                <Trash2 className="h-4 w-4" />
                ลบ Kiosk
              </Button>
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
