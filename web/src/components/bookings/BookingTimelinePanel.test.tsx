import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { BookingTimelinePanel } from "./BookingTimelinePanel";

describe("BookingTimelinePanel", () => {
  test("renders loading, failure, and empty critical states", () => {
    const { rerender } = render(<BookingTimelinePanel events={[]} isLoading />);
    expect(screen.getByLabelText("Loading booking timeline")).toBeInTheDocument();

    rerender(<BookingTimelinePanel events={[]} isError />);
    expect(screen.getByText("Unable to load the audit timeline.")).toBeInTheDocument();

    rerender(<BookingTimelinePanel events={[]} />);
    expect(screen.getByText("No audit events recorded.")).toBeInTheDocument();
  });

  test("renders state transition, safe metadata, actor, and correlation context", () => {
    render(
      <BookingTimelinePanel
        events={[
          {
            id: "event-1",
            actorType: "ADMIN",
            actorId: "admin-1",
            eventType: "BOOKING_APPROVED",
            previousStatus: "PENDING",
            newStatus: "CONFIRMED",
            metadata: { source: "admin-review" },
            correlationId: "request-123",
            createdAt: "2026-08-24T03:00:00.000Z",
          },
        ]}
      />,
    );

    expect(screen.getByText("BOOKING APPROVED")).toBeInTheDocument();
    expect(screen.getByText("PENDING → CONFIRMED")).toBeInTheDocument();
    expect(screen.getByText(/ADMIN \(admin-1\)/)).toBeInTheDocument();
    expect(screen.getByText(/admin-review/)).toBeInTheDocument();
    expect(screen.getByText("correlation: request-123")).toBeInTheDocument();
  });
});
