import { Separator } from "web";

export function Horizontal() {
  return (
    <div style={{ width: "300px", padding: "16px 0" }}>
      <p style={{ marginBottom: "12px", fontSize: "14px" }}>Room Details</p>
      <Separator />
      <p style={{ marginTop: "12px", fontSize: "14px", color: "var(--muted-foreground)" }}>
        Conference Room A · Floor 3
      </p>
    </div>
  );
}

export function Vertical() {
  return (
    <div style={{ display: "flex", height: "40px", alignItems: "center", gap: "12px" }}>
      <span style={{ fontSize: "14px" }}>Rooms</span>
      <Separator orientation="vertical" />
      <span style={{ fontSize: "14px" }}>Bookings</span>
      <Separator orientation="vertical" />
      <span style={{ fontSize: "14px" }}>Profile</span>
    </div>
  );
}
