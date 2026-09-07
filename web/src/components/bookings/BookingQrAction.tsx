import { Loader2, QrCode, Timer } from "lucide-react";
import { formatCountdown, getBookingQrAvailability } from "../../lib/bookingQr";
import type { Booking } from "../../lib/queries";
import { Button } from "../ui/button";

type BookingQrActionProps = {
  booking: Booking;
  nowMs: number;
  loading: boolean;
  onShowQr: () => void;
};

export function BookingQrAction({ booking, nowMs, loading, onShowQr }: BookingQrActionProps) {
  if (booking.status !== "CONFIRMED") return null;

  const availability = getBookingQrAvailability(booking, nowMs);
  const opensAtMs = booking.checkInWindow
    ? new Date(booking.checkInWindow.opensAt).getTime()
    : Number.NaN;

  if (availability === "waiting") {
    return (
      <Button size="sm" variant="outline" disabled aria-label="QR code is not available yet">
        <Timer className="w-3.5 h-3.5 mr-1" />
        QR available in {formatCountdown(opensAtMs - nowMs)}
      </Button>
    );
  }

  if (availability === "closed") {
    return (
      <Button size="sm" variant="outline" disabled>
        Check-in closed
      </Button>
    );
  }

  if (availability === "unavailable") {
    return (
      <Button size="sm" variant="outline" disabled>
        QR unavailable
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={onShowQr}
      disabled={loading}
      className="text-blue-600 border-blue-200 hover:bg-blue-50"
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <>
          <QrCode className="w-3.5 h-3.5 mr-1" />
          QR Code
        </>
      )}
    </Button>
  );
}
