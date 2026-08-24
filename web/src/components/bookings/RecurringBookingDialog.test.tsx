import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { RecurringBookingDialog } from "./RecurringBookingDialog";

afterEach(() => vi.unstubAllGlobals());

describe("RecurringBookingDialog", () => {
  test("requires a successful atomic preview before creating the Pro series", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        occurrenceCount: 5,
        validOccurrences: [],
        conflicts: [],
        canCreateAtomically: true,
      }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "series-1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={client}>
        <RecurringBookingDialog
          open
          onOpenChange={onOpenChange}
          roomId="room-1"
          startDate="2099-01-05"
          startTime="10:00"
          endTime="11:00"
          attendees={3}
          purpose="Weekly planning"
        />
      </QueryClientProvider>,
    );

    const createButton = screen.getByRole("button", { name: "Create series" });
    expect(createButton).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Preview conflicts" }));
    expect(await screen.findByText("5 occurrences")).toBeInTheDocument();
    expect(createButton).toBeEnabled();
    await user.click(createButton);

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/booking-series/preview",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/booking-series",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });
});
