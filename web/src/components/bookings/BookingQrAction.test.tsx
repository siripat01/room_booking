import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import type { Booking } from "../../lib/queries";
import { BookingQrAction } from "./BookingQrAction";

const opensAt = "2026-09-07T03:50:00.000Z";
const closesAt = "2026-09-07T04:12:00.000Z";

function booking(status: Booking["status"] = "CONFIRMED"): Booking {
  return {
    id: "booking-1",
    roomId: "room-1",
    userId: "user-1",
    room: { name: "Meeting Room", floor: "2" },
    startTime: "2026-09-07T04:00:00.000Z",
    endTime: "2026-09-07T05:00:00.000Z",
    attendees: 2,
    status,
    checkInWindow: { opensAt, closesAt },
    createdAt: "2026-09-01T00:00:00.000Z",
  };
}

describe("BookingQrAction", () => {
  test("does not offer a QR code while approval is pending", () => {
    render(
      <BookingQrAction
        booking={booking("PENDING")}
        nowMs={Date.parse(opensAt)}
        loading={false}
        onShowQr={() => {}}
      />,
    );
    expect(screen.queryByRole("button", { name: /qr/i })).not.toBeInTheDocument();
  });

  test("shows a countdown before the check-in window", () => {
    render(
      <BookingQrAction
        booking={booking()}
        nowMs={Date.parse(opensAt) - 65_000}
        loading={false}
        onShowQr={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /qr code is not available yet/i })).toHaveTextContent(
      "QR available in 1m 5s",
    );
    expect(screen.getByRole("button", { name: /qr code is not available yet/i })).toBeDisabled();
  });

  test("enables at the opening boundary without needing new booking data", () => {
    const onShowQr = vi.fn();
    const { rerender } = render(
      <BookingQrAction
        booking={booking()}
        nowMs={Date.parse(opensAt) - 1_000}
        loading={false}
        onShowQr={onShowQr}
      />,
    );

    rerender(
      <BookingQrAction
        booking={booking()}
        nowMs={Date.parse(opensAt)}
        loading={false}
        onShowQr={onShowQr}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "QR Code" }));
    expect(onShowQr).toHaveBeenCalledOnce();
  });

  test("shows that check-in is closed after the closing boundary", () => {
    render(
      <BookingQrAction
        booking={booking()}
        nowMs={Date.parse(closesAt) + 1}
        loading={false}
        onShowQr={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "Check-in closed" })).toBeDisabled();
  });
});
