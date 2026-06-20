import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { authClient } from "../lib/auth";
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
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/rooms/$roomId")({
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

type Room = {
  id: string;
  name: string;
  description?: string | null;
  capacity: number;
  floor: string;
  amenities: string[];
  isActive: boolean;
};

function RoomDetailPage() {
  const { roomId } = Route.useParams();
  const [user, setUser] = useState<{ name: string; email: string; image?: string | null } | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    date: today,
    startTime: "09:00",
    endTime: "10:00",
    attendees: "1",
    purpose: "",
  });

  useEffect(() => {
    authClient.getSession().then((s) => {
      if (!s.data?.user) {
        window.location.href = "/";
        return;
      }
      setUser(s.data.user as typeof user);
    });
  }, []);

  useEffect(() => {
    async function fetchRoom() {
      try {
        const { data } = await (app.api.rooms as any)[roomId].get();
        if (data) setRoom(data as Room);
      } catch {
        // fall back to demo data
        const demo = DEMO_ROOMS.find((r) => r.id === roomId);
        if (demo) setRoom(demo);
      } finally {
        setLoading(false);
      }
    }
    if (roomId) fetchRoom();
  }, [roomId]);

  async function handleBooking(e: React.FormEvent) {
    e.preventDefault();
    if (!form.purpose.trim()) {
      toast.error("Please enter a purpose for your booking.");
      return;
    }
    if (form.startTime >= form.endTime) {
      toast.error("End time must be after start time.");
      return;
    }
    setSubmitting(true);
    try {
      const startTime = new Date(`${form.date}T${form.startTime}:00`).toISOString();
      const endTime = new Date(`${form.date}T${form.endTime}:00`).toISOString();
      await (app.api.bookings as any).post({
        roomId,
        startTime,
        endTime,
        attendees: parseInt(form.attendees),
        purpose: form.purpose,
      });
      setSubmitted(true);
      toast.success("Booking submitted! Awaiting approval.");
    } catch {
      toast.error("Booking failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
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
          <Button variant="link" asChild className="mt-2">
            <Link to="/home">Back to rooms</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link to="/home" className="flex items-center gap-1 hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Rooms
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium">{room.name}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Left – room info */}
          <div className="lg:col-span-3 space-y-6">
            {/* Hero */}
            <div className="h-64 bg-gradient-to-br from-secondary to-muted rounded-xl flex items-center justify-center text-muted-foreground/20">
              <Building2 className="w-24 h-24" />
            </div>

            {/* Name + badges */}
            <div>
              <div className="flex items-start justify-between gap-3 mb-2">
                <h1 className="text-2xl font-bold">{room.name}</h1>
                <Badge variant="secondary">Floor {room.floor}</Badge>
              </div>
              {room.description && (
                <p className="text-muted-foreground">{room.description}</p>
              )}
            </div>

            <Separator />

            {/* Details */}
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

            {/* Amenities */}
            {room.amenities.length > 0 && (
              <div>
                <h2 className="font-semibold mb-3">Amenities</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {room.amenities.map((a) => (
                    <div
                      key={a}
                      className="flex items-center gap-2 p-3 rounded-lg border text-sm"
                    >
                      <span className="text-muted-foreground">{AMENITY_ICONS[a]}</span>
                      {AMENITY_LABELS[a] ?? a}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right – booking form */}
          <div className="lg:col-span-2">
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle className="text-lg">Book this room</CardTitle>
              </CardHeader>
              <CardContent>
                {submitted ? (
                  <div className="py-8 text-center space-y-3">
                    <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
                    <p className="font-semibold">Booking Submitted!</p>
                    <p className="text-sm text-muted-foreground">
                      Your request is pending approval. You'll be notified once it's confirmed.
                    </p>
                    <div className="flex flex-col gap-2 pt-2">
                      <Button onClick={() => setSubmitted(false)} variant="outline">
                        Book Again
                      </Button>
                      <Button asChild>
                        <Link to="/bookings">View My Bookings</Link>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleBooking} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="date" className="flex items-center gap-1.5">
                        <CalendarDays className="w-3.5 h-3.5" /> Date
                      </Label>
                      <Input
                        id="date"
                        type="date"
                        min={today}
                        value={form.date}
                        onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="startTime" className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" /> Start
                        </Label>
                        <Input
                          id="startTime"
                          type="time"
                          value={form.startTime}
                          onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="endTime">End</Label>
                        <Input
                          id="endTime"
                          type="time"
                          value={form.endTime}
                          onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="attendees" className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" /> Attendees
                      </Label>
                      <Input
                        id="attendees"
                        type="number"
                        min="1"
                        max={room.capacity}
                        value={form.attendees}
                        onChange={(e) => setForm((f) => ({ ...f, attendees: e.target.value }))}
                        required
                      />
                      <p className="text-xs text-muted-foreground">Max {room.capacity} people</p>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="purpose">Purpose / Topic</Label>
                      <Textarea
                        id="purpose"
                        placeholder="e.g. Weekly team standup, Client presentation…"
                        value={form.purpose}
                        onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
                        rows={3}
                        required
                      />
                    </div>

                    <Button type="submit" className="w-full" disabled={submitting}>
                      {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      {submitting ? "Submitting…" : "Request Booking"}
                    </Button>

                    <p className="text-xs text-muted-foreground text-center">
                      Bookings require admin approval before confirmation.
                    </p>
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

const DEMO_ROOMS: Room[] = [
  { id: "demo-1", name: "Conference Room A", description: "Spacious main conference room with full AV setup.", capacity: 20, floor: "3", amenities: ["projector", "whiteboard", "ac", "wifi"], isActive: true },
  { id: "demo-2", name: "Meeting Room B", description: "Cozy room ideal for small team discussions.", capacity: 8, floor: "2", amenities: ["tv", "whiteboard", "ac"], isActive: true },
  { id: "demo-3", name: "Board Room", description: "Executive board room with premium furniture.", capacity: 12, floor: "5", amenities: ["projector", "tv", "ac", "wifi"], isActive: true },
  { id: "demo-4", name: "Collaboration Hub", description: "Open collaboration space for creative sessions.", capacity: 6, floor: "1", amenities: ["whiteboard", "wifi"], isActive: true },
  { id: "demo-5", name: "Training Room", description: "Large room equipped for training and workshops.", capacity: 30, floor: "4", amenities: ["projector", "whiteboard", "ac", "wifi"], isActive: true },
  { id: "demo-6", name: "Focus Room", description: "Quiet private space for focused work or 1-on-1s.", capacity: 4, floor: "2", amenities: ["ac", "wifi"], isActive: true },
];
