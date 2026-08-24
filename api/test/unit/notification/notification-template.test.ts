import { describe, expect, test } from "bun:test";
import { renderNotification } from "../../../src/notification/notification-template";

describe("notification templates", () => {
  test("renders booking instants in Asia/Bangkok and escapes HTML", () => {
    const rendered = renderNotification("BOOKING_APPROVED", {
      userName: "<Admin>",
      roomName: "A&B <101>",
      roomFloor: "1",
      startTime: "2026-08-21T03:00:00.000Z",
      endTime: "2026-08-21T04:00:00.000Z",
      purpose: "Review <script>alert(1)</script>",
    });

    expect(rendered.text).toContain("10:00");
    expect(rendered.html).toContain("&lt;Admin&gt;");
    expect(rendered.html).toContain("A&amp;B &lt;101&gt;");
    expect(rendered.html).not.toContain("<script>");
  });

  test("requires the booking context used by a template", () => {
    expect(() => renderNotification("REMINDER_30", { userName: "User" })).toThrow(/roomName/);
  });

  test("uses the shared 12-minute check-in grace in user-facing copy", () => {
    const rendered = renderNotification("CHECKIN_REMINDER", {
      userName: "User",
      roomName: "A101",
      startTime: "2026-08-21T03:00:00.000Z",
      endTime: "2026-08-21T04:00:00.000Z",
    });
    expect(rendered.html).toContain("12 นาที");
  });
});
