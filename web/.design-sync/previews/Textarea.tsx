import { Textarea } from "web";

export function Default() {
  return (
    <Textarea
      placeholder="Describe the purpose of your booking…"
      style={{ width: "300px" }}
    />
  );
}

export function Disabled() {
  return (
    <Textarea
      disabled
      placeholder="Field unavailable"
      style={{ width: "300px" }}
    />
  );
}
