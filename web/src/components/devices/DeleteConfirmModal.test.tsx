import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { DeleteConfirmModal } from "./DeleteConfirmModal";

describe("DeleteConfirmModal", () => {
  test("requires an exact kiosk name before destructive confirmation", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <DeleteConfirmModal
        open
        deviceName="Kiosk A-101"
        onConfirm={onConfirm}
        onOpenChange={onOpenChange}
      />,
    );

    const deleteButton = screen.getByRole("button", { name: "ลบ Kiosk" });
    expect(deleteButton).toBeDisabled();
    await user.type(screen.getByLabelText("พิมพ์ชื่อ Kiosk เพื่อยืนยันการลบ"), "Kiosk A-10");
    expect(deleteButton).toBeDisabled();
    await user.type(screen.getByLabelText("พิมพ์ชื่อ Kiosk เพื่อยืนยันการลบ"), "1");
    expect(deleteButton).toBeEnabled();
    await user.click(deleteButton);
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
