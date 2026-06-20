import { Badge } from "web";

export function Variants() {
  return (
    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
      <Badge variant="default">Confirmed</Badge>
      <Badge variant="secondary">Pending</Badge>
      <Badge variant="outline">Draft</Badge>
      <Badge variant="destructive">Cancelled</Badge>
      <Badge variant="success">Available</Badge>
      <Badge variant="warning">Maintenance</Badge>
    </div>
  );
}

export function Default() {
  return <Badge>Confirmed</Badge>;
}
