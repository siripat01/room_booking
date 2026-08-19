import { Device, DeviceStatus } from "@/types/device";

export function getDeviceStatus(device: Device): DeviceStatus {
  if (!device.isActive || device.revokedAt) return "offline";
  return device.onlineStatus;
}

export function formatRelativeTime(dateString: string | null): string {
  if (!dateString) {
    return "ยังไม่เคยเชื่อมต่อ";
  }

  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) {
    return "เมื่อสักครู่นี้";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} นาทีที่แล้ว`;
  }

  if (diffHours < 24) {
    return `ออฟไลน์ ${diffHours} ชั่วโมง`;
  }

  if (diffDays < 7) {
    return `ออฟไลน์ ${diffDays} วัน`;
  }

  return date.toLocaleDateString("th-TH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getStatusLabel(status: DeviceStatus): string {
  switch (status) {
    case "online":
      return "Online";
    case "offline":
      return "Offline";
    case "unknown":
      return "ไม่ทราบ";
    default:
      return "";
  }
}

export function getStatusBadgeVariant(status: DeviceStatus): "default" | "success" | "destructive" | "warning" {
  switch (status) {
    case "online":
      return "success";
    case "offline":
      return "destructive";
    case "unknown":
      return "warning";
    default:
      return "default";
  }
}

export function getAvailableRooms(rooms: Device["room"][]): (Device["room"] & { hasDevice: boolean })[] {
  return rooms
    .filter((room) => room && room.isActive)
    .map((room) => ({
      ...room!,
      hasDevice: !!room!.device,
    }));
}
