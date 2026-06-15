"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DeleteConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deviceName: string;
  onConfirm: () => void;
  isLoading?: boolean;
}

export function DeleteConfirmModal({
  open,
  onOpenChange,
  deviceName,
  onConfirm,
  isLoading = false,
}: DeleteConfirmModalProps) {
  const [confirmationText, setConfirmationText] = useState("");
  const isValid = confirmationText === deviceName;

  const handleConfirm = () => {
    if (!isValid) return;
    onConfirm();
    onOpenChange(false);
    setConfirmationText("");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setConfirmationText(""); onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-red-500 mb-2">
            <AlertCircle className="h-6 w-6" />
            <DialogTitle className="text-lg">ลบ Kiosk?</DialogTitle>
          </div>
          <DialogDescription className="text-left">
            <p className="whitespace-pre-line">
              ลบ {deviceName} ออกจากระบบ
              ห้องที่ผูกอยู่จะไม่ได้รับผลกระทบ
            </p>
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="space-y-2">
            <Label htmlFor="delete-confirmation" className="text-sm font-medium">
              พิมพ์ชื่อ Kiosk เพื่อยืนยันการลบ
            </Label>
            <Input
              id="delete-confirmation"
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value)}
              placeholder={`พิมพ์ "${deviceName}"`}
              disabled={isLoading}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              ต้องพิมพ์ชื่อให้ตรงกันทุกตัวอักษร
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isLoading}>
            ยกเลิก
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!isValid || isLoading}
          >
            {isLoading ? "กำลังลบ..." : "ลบ Kiosk"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
