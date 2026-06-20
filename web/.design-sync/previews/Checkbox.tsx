import { Checkbox } from "web";
import { Label } from "web";

export function Default() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <Checkbox id="agree" />
      <Label htmlFor="agree">I agree to the booking policy</Label>
    </div>
  );
}

export function Checked() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <Checkbox id="checked" defaultChecked />
      <Label htmlFor="checked">Room confirmed</Label>
    </div>
  );
}

export function Disabled() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <Checkbox id="disabled" disabled />
      <Label htmlFor="disabled">Unavailable option</Label>
    </div>
  );
}
