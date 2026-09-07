import type { Booking } from "./queries";

export type BookingQrAvailability = "unavailable" | "waiting" | "available" | "closed";

export function getBookingQrAvailability(booking: Booking, nowMs: number): BookingQrAvailability {
  if (booking.status !== "CONFIRMED" || !booking.checkInWindow) return "unavailable";

  const opensAtMs = new Date(booking.checkInWindow.opensAt).getTime();
  const closesAtMs = new Date(booking.checkInWindow.closesAt).getTime();
  if (!Number.isFinite(opensAtMs) || !Number.isFinite(closesAtMs)) return "unavailable";
  if (nowMs < opensAtMs) return "waiting";
  if (nowMs > closesAtMs) return "closed";
  return "available";
}

export function formatCountdown(durationMs: number) {
  const totalSeconds = Math.max(0, Math.ceil(durationMs / 1_000));
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}
