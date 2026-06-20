import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "web";
import { Button } from "web";

export function Default() {
  return (
    <Card style={{ width: "320px" }}>
      <CardHeader>
        <CardTitle>Conference Room A</CardTitle>
        <CardDescription>Floor 3 · Capacity 20 people</CardDescription>
      </CardHeader>
      <CardContent>
        <p style={{ fontSize: "14px", color: "var(--muted-foreground)" }}>
          Spacious room with full AV setup, whiteboard, and video conferencing.
        </p>
      </CardContent>
      <CardFooter>
        <Button style={{ width: "100%" }}>Book Now</Button>
      </CardFooter>
    </Card>
  );
}

export function Simple() {
  return (
    <Card style={{ width: "280px" }}>
      <CardHeader>
        <CardTitle>Meeting Room B</CardTitle>
        <CardDescription>Small team discussions</CardDescription>
      </CardHeader>
      <CardContent>
        <p style={{ fontSize: "14px" }}>8 people · Floor 2</p>
      </CardContent>
    </Card>
  );
}
