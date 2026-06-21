"use client";

import { useState } from "react";
import { AlertTriangle, Check, Copy, Eye, EyeOff } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface DeviceKeyDisplayModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deviceKey: string;
  deviceName: string;
  onConfirm: () => void;
}

export function DeviceKeyDisplayModal({
  open,
  onOpenChange,
  deviceKey,
  deviceName,
  onConfirm,
}: DeviceKeyDisplayModalProps) {
  const [copied, setCopied] = useState(false);
  const [showKey, setShowKey] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(deviceKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("Failed to copy:", e);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-yellow-500 mb-2">
            <AlertTriangle className="h-6 w-6" />
            <DialogTitle className="text-lg">บันทึก Device Key ไว้ก่อน!</DialogTitle>
          </div>
          <DialogDescription className="text-left">
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-md text-sm">
              Device Key นี้จะแสดงเพียงครั้งเดียวเท่านั้น<br />
              หลังปิด modal นี้จะไม่สามารถดูได้อีก<br />
              กรุณา copy ไปเก็บไว้ก่อน
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Device Key สำหรับ {deviceName}</Label>
            <div className="relative">
              <div
                className={cn(
                  "font-mono text-lg bg-gray-100 border-2 border-dashed border-gray-300 rounded-md p-4 break-all",
                  !showKey && "text-transparent bg-clip-text bg-gradient-to-r from-gray-400 to-gray-500"
                )}
              >
                {showKey ? deviceKey : "••••••••••••••••••••••••••••••••"}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-2"
                onClick={() => setShowKey(!showKey)}
                aria-label={showKey ? "ซ่อน key" : "แสดง key"}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <Button
            className="w-full"
            variant="outline"
            onClick={handleCopy}
            disabled={copied}
          >
            {copied ? (
              <>
                <Check className="mr-2 h-4 w-4 text-green-500" />
                ✅ Copied!
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" />
                Copy Device Key
              </>
            )}
          </Button>

          <details className="group border border-gray-200 rounded-md">
            <summary className="flex items-center justify-between p-3 cursor-pointer list-none">
              <span className="text-sm font-medium">วิธีใช้งาน</span>
              <svg className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="p-3 border-t border-gray-200 bg-gray-50 text-sm text-gray-600">
              <p className="mb-2">นำ Device Key ไปตั้งค่าบน Raspberry Pi โดยเพิ่มใน environment variable:</p>
              <pre className="font-mono text-xs bg-gray-100 p-2 rounded overflow-x-auto">
DEVICE_KEY={deviceKey}
              </pre>
              <p className="mt-2">จากนั้น restart kiosk app</p>
            </div>
          </details>
        </div>

        <DialogFooter className="flex-col">
          <Button
            className="w-full"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            ฉัน copy แล้ว ปิดหน้าต่าง
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
