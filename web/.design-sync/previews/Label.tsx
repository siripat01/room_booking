import { Label } from "web";
import { Input } from "web";

export function Default() {
  return <Label>Room Name</Label>;
}

export function WithInput() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", width: "260px" }}>
      <Label htmlFor="room-name">Room Name</Label>
      <Input id="room-name" placeholder="Conference Room A" />
    </div>
  );
}

export function Disabled() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", width: "260px" }}>
      <Label htmlFor="disabled-input" className="opacity-70 cursor-not-allowed">
        Unavailable Field
      </Label>
      <Input id="disabled-input" disabled placeholder="N/A" />
    </div>
  );
}
