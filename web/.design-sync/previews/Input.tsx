import { Input } from "web";

export function Default() {
  return <Input placeholder="Enter room name" style={{ width: "260px" }} />;
}

export function WithType() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px", width: "260px" }}>
      <Input type="text" placeholder="Search rooms…" />
      <Input type="date" />
      <Input type="time" defaultValue="09:00" />
      <Input type="number" placeholder="Number of attendees" min={1} />
    </div>
  );
}

export function Disabled() {
  return <Input disabled placeholder="Unavailable" style={{ width: "260px" }} />;
}
