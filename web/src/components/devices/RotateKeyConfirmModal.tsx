"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface RotateKeyConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deviceName: string;
  onConfirm: () => void;
  isLoading?: boolean;
}

export function RotateKeyConfirmModal({
  open,
  onOpenChange,
  deviceName,
  onConfirm,
  isLoading = false,
}: RotateKeyConfirmModalProps) {
  const [confirmed, setConfirmed] = useState(false);

  const handleConfirm = () => {
    if (!confirmed) return;
    onConfirm();
    onOpenChange(false);
    setConfirmed(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setConfirmed(false); onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-red-500 mb-2">
            <RefreshCw className="h-6 w-6" />
            <DialogTitle className="text-lg">ยืนยันการสร้าง Key ใหม่?</DialogTitle>
          </div>
          <DialogDescription className="text-left">
            <p className="whitespace-pre-line">
              Device Key เดิมของ {deviceName}
              จะถูกยกเลิกทันทีและใช้งานไม่ได้อีก
              Kiosk จะออฟไลน์จนกว่าจะนำ Key ใหม่ไปตั้งค่า
            </p>
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="flex items-start space-x-2">
            <Checkbox
              id="confirm-rotate"
              checked={confirmed}
              onCheckedChange={setConfirmed}
              disabled={isLoading}
            />
            <Label htmlFor="confirm-rotate" className="text-sm text-foreground mt-0.5">
              ฉันเข้าใจแล้ว
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isLoading}>
            ยกเลิก
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!confirmed || isLoading}
          >
            {isLoading ? "กำลังสร้าง..." : "สร้าง Key ใหม่"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
