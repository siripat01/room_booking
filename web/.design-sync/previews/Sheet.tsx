import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "web";
import { Button } from "web";
import { Input } from "web";
import { Label } from "web";

export function BookingPanel() {
  return (
    <Sheet open>
      <SheetTrigger asChild>
        <Button variant="outline">Open Booking Panel</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Book Conference Room A</SheetTitle>
          <SheetDescription>
            Fill in the details below to request your booking.
          </SheetDescription>
        </SheetHeader>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "16px 0" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" />
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
              <Label htmlFor="start">Start</Label>
              <Input id="start" type="time" defaultValue="09:00" />
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
              <Label htmlFor="end">End</Label>
              <Input id="end" type="time" defaultValue="10:00" />
            </div>
          </div>
        </div>
        <SheetFooter>
          <Button variant="outline" style={{ flex: 1 }}>Cancel</Button>
          <Button style={{ flex: 1 }}>Request Booking</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
