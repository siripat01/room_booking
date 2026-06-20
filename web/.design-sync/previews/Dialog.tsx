import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "web";
import { Button } from "web";

export function BookingConfirmation() {
  return (
    <Dialog open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Booking</DialogTitle>
          <DialogDescription>
            Review your booking details before confirming. The room will be
            reserved for the selected time slot.
          </DialogDescription>
        </DialogHeader>
        <div style={{ fontSize: "14px", color: "var(--muted-foreground)", lineHeight: 1.6 }}>
          <p>Conference Room A · Floor 3</p>
          <p>Monday, June 23 · 9:00 AM – 10:00 AM</p>
          <p>5 attendees</p>
        </div>
        <DialogFooter>
          <Button variant="outline">Cancel</Button>
          <Button>Confirm Booking</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CancelBooking() {
  return (
    <Dialog open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel Booking?</DialogTitle>
          <DialogDescription>
            This action cannot be undone. The room will be freed for other users.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline">Keep Booking</Button>
          <Button variant="destructive">Cancel Booking</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
