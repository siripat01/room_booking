import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "../lib/useCurrentUser";
import { roomQuery, sessionQuery } from "../lib/queries";
import { app } from "../lib/api";
import { Navbar } from "../components/Navbar";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Separator } from "../components/ui/separator";
import { Textarea } from "../components/ui/textarea";
import {
  ArrowLeft,
  Building2,
  Users,
  Monitor,
  PenSquare,
  Tv,
  Wind,
  Wifi,
  CalendarDays,
  Clock,
  CheckCircle2,
  Timer,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/rooms/$roomId")({
  beforeLoad: async ({ context: { queryClient } }) => {
    const user = await queryClient.ensureQueryData(sessionQuery());
    if (!user) throw redirect({ to: "/" });
  },
  loader: ({ context: { queryClient }, params: { roomId } }) =>
    queryClient.ensureQueryData(roomQuery(roomId)),
  component: RoomDetailPage,
});

const AMENITY_ICONS: Record<string, React.ReactNode> = {
  projector: <Monitor className="w-4 h-4" />,
  whiteboard: <PenSquare className="w-4 h-4" />,
  tv: <Tv className="w-4 h-4" />,
  ac: <Wind className="w-4 h-4" />,
  wifi: <Wifi className="w-4 h-4" />,
};

const AMENITY_LABELS: Record<string, string> = {
  projector: "Projector",
  whiteboard: "Whiteboard",
  tv: "TV",
  ac: "Air Conditioning",
  wifi: "Wi-Fi",
};

type BookingResult = { status: string };

function RoomDetailPage() {
  const { roomId } = Route.useParams();
  const { user } = useCurrentUser();
  const qc = useQueryClient();
  const { data: room, isLoading: roomLoading } = useQuery(roomQuery(roomId));
  const [booking, setBooking] = useState<BookingResult | null>(null);

  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    date: today,
    startTime: "09:00",
    endTime: "10:00",
    attendees: "1",
    purpose: "",
  });

  const bookMutation = useMutation({
    mutationFn: async () => {
      const startTime = new Date(`${form.date}T${form.startTime}:00`).toISOString();
      const endTime = new Date(`${form.date}T${form.endTime}:00`).toISOString();
      const { data, error } = await (app.api.bookings as any).post({
        roomId,
        startTime,
        endTime,
        attendees: parseInt(form.attendees),
        purpose: form.purpose,
      });
      if (error) throw new Error((error as any)?.message ?? "Booking failed");
      return data as BookingResult;
    },
    onSuccess: (data) => {
      setBooking(data);
      qc.invalidateQueries({ queryKey: ["bookings"] });
      const msg = (data as any)?.status === "CONFIRMED"
        ? "Booking confirmed!"
        : "Booking submitted — awaiting admin approval.";
      toast.success(msg);
    },
    onError: (err: any) => toast.error(err?.message ?? "Booking failed. Please try again."),
  });

  function handleBooking(e: React.FormEvent) {
    e.preventDefault();
    if (!form.purpose.trim()) { toast.error("Please enter a purpose."); return; }
    if (form.startTime >= form.endTime) { toast.error("End time must be after start time."); return; }
    bookMutation.mutate();
  }

  const autoConfirm = user?.isTeacher || user?.isAdmin;

  if (roomLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar user={user} />
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar user={user} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20 text-center text-muted-foreground">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Room not found</p>
          <Button variant="link" asChild className="mt-2"><Link to="/home">Back to rooms</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link to="/home" className="flex items-center gap-1 hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />Rooms
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium">{room.name}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Room info */}
          <div className="lg:col-span-3 space-y-6">
            <div className="h-64 bg-gradient-to-br from-secondary to-muted rounded-xl flex items-center justify-center text-muted-foreground/20">
              <Building2 className="w-24 h-24" />
            </div>

            <div>
              <div className="flex items-start justify-between gap-3 mb-2">
                <h1 className="text-2xl font-bold">{room.name}</h1>
                <Badge variant="secondary">Floor {room.floor}</Badge>
              </div>
              {room.description && <p className="text-muted-foreground">{room.description}</p>}
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-4 rounded-lg border bg-secondary/30">
                <Users className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Capacity</p>
                  <p className="font-semibold">{room.capacity} people</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-lg border bg-secondary/30">
                <Building2 className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Floor</p>
                  <p className="font-semibold">Floor {room.floor}</p>
                </div>
              </div>
            </div>

            {room.amenities.length > 0 && (
              <div>
                <h2 className="font-semibold mb-3">Amenities</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {room.amenities.map((a) => (
                    <div key={a} className="flex items-center gap-2 p-3 rounded-lg border text-sm">
                      <span className="text-muted-foreground">{AMENITY_ICONS[a]}</span>
                      {AMENITY_LABELS[a] ?? a}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Booking form */}
          <div className="lg:col-span-2">
            <Card className="sticky top-24">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Book this room</CardTitle>
                  {autoConfirm && (
                    <Badge variant="success" className="flex items-center gap-1 text-xs">
                      <CheckCircle2 className="w-3 h-3" /> Instant confirm
                    </Badge>
                  )}
                </div>
                {!autoConfirm && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Timer className="w-3 h-3" /> Requires admin approval
                  </p>
                )}
              </CardHeader>
              <CardContent>
                {booking ? (
                  <div className="py-8 text-center space-y-3">
                    {(booking as any).status === "CONFIRMED" ? (
                      <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
                    ) : (
                      <Timer className="w-12 h-12 text-yellow-500 mx-auto" />
                    )}
                    <p className="font-semibold">
                      {(booking as any).status === "CONFIRMED" ? "Booking Confirmed!" : "Booking Submitted!"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {(booking as any).status === "CONFIRMED"
                        ? "Your room is reserved. See it in My Bookings."
                        : "Your request is pending admin approval."}
                    </p>
                    <div className="flex flex-col gap-2 pt-2">
                      <Button onClick={() => setBooking(null)} variant="outline">Book Again</Button>
                      <Button asChild><Link to="/bookings">View My Bookings</Link></Button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleBooking} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="date" className="flex items-center gap-1.5">
                        <CalendarDays className="w-3.5 h-3.5" /> Date
                      </Label>
                      <Input id="date" type="date" min={today} value={form.date}
                        onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} required />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="startTime" className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" /> Start
                        </Label>
                        <Input id="startTime" type="time" value={form.startTime}
                          onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} required />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="endTime">End</Label>
                        <Input id="endTime" type="time" value={form.endTime}
                          onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} required />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="attendees" className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" /> Attendees
                      </Label>
                      <Input id="attendees" type="number" min="1" max={room.capacity}
                        value={form.attendees}
                        onChange={(e) => setForm((f) => ({ ...f, attendees: e.target.value }))} required />
                      <p className="text-xs text-muted-foreground">Max {room.capacity} people</p>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="purpose">Purpose / Topic</Label>
                      <Textarea id="purpose" placeholder="e.g. Team meeting, Lecture, Exam…"
                        value={form.purpose}
                        onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
                        rows={3} required />
                    </div>

                    <Button type="submit" className="w-full" disabled={bookMutation.isPending}>
                      {bookMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      {bookMutation.isPending ? "Submitting…" : autoConfirm ? "Book Now" : "Request Booking"}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

