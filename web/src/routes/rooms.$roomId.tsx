import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState, useEffect } from "react";
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
  ArrowLeft, Building2, Users, Monitor, PenSquare, Tv, Wind, Wifi,
  CalendarDays, Clock, CheckCircle2, Timer, Loader2, MapPin,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/rooms/$roomId")({
  beforeLoad: async ({ context: { queryClient }, location }) => {
    if (typeof window === "undefined") return;
    try {
      const user = await queryClient.ensureQueryData(sessionQuery());
      if (!user) throw redirect({ to: "/", search: { redirect: location.pathname } });
    } catch (e: any) {
      if (e?.isRedirect) throw e;
      throw redirect({ to: "/", search: { redirect: location.pathname } });
    }
  },
  loader: ({ context: { queryClient }, params: { roomId } }) => {
    if (typeof window === "undefined") return;
    return queryClient.ensureQueryData(roomQuery(roomId));
  },
  component: RoomDetailPage,
});

const SLOTS = [
  { start: "08:00", end: "09:00" },
  { start: "09:00", end: "10:00" },
  { start: "10:00", end: "11:00" },
  { start: "11:00", end: "12:00" },
  { start: "12:00", end: "13:00" },
  { start: "13:00", end: "14:00" },
  { start: "14:00", end: "15:00" },
  { start: "15:00", end: "16:00" },
] as const;

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
    slot: "" as string,
    attendees: "1",
    purpose: "",
  });

  const { data: availability } = useQuery({
    queryKey: ["availability", roomId, form.date],
    queryFn: async () => {
      const res = await fetch(`/api/rooms/${roomId}/availability?date=${form.date}`);
      if (!res.ok) return null;
      return res.json() as Promise<{ bookings: Array<{ startTime: string; endTime: string }> }>;
    },
    staleTime: 30_000,
  });

  const bookedSlots = new Set<string>(
    SLOTS.filter((s) => {
      if (!availability?.bookings?.length) return false;
      const slotStart = new Date(`${form.date}T${s.start}:00`);
      const slotEnd = new Date(`${form.date}T${s.end}:00`);
      return availability.bookings.some((b) => new Date(b.startTime) < slotEnd && new Date(b.endTime) > slotStart);
    }).map((s) => s.start),
  );

  // Clear selected slot if it becomes booked (e.g. date changed or someone else books it)
  useEffect(() => {
    if (form.slot && bookedSlots.has(form.slot)) {
      setForm((f) => ({ ...f, slot: "" }));
    }
  }, [form.date, availability]);

  const bookMutation = useMutation({
    mutationFn: async () => {
      const slot = SLOTS.find((s) => s.start === form.slot)!;
      const startTime = new Date(`${form.date}T${slot.start}:00`).toISOString();
      const endTime = new Date(`${form.date}T${slot.end}:00`).toISOString();
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
    if (!form.slot) { toast.error("Please select a time slot."); return; }
    if (!form.purpose.trim()) { toast.error("Please enter a purpose."); return; }
    bookMutation.mutate();
  }

  const autoConfirm = user?.isTeacher || user?.isAdmin;

  if (roomLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar user={user} />
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar user={user} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20 text-center text-muted-foreground">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 opacity-40" />
          </div>
          <p className="font-semibold">Room not found</p>
          <Button variant="link" asChild className="mt-2 text-blue-600"><Link to="/home">Back to rooms</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar user={user} />

      {/* Room header banner */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <Link to="/home" className="inline-flex items-center gap-1.5 text-blue-200 hover:text-white text-sm mb-5 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to rooms
          </Link>
          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">{room.name}</h1>
              <div className="flex items-center gap-3 text-blue-200 text-sm">
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" /> Floor {room.floor}
                </span>
                <span className="flex items-center gap-1.5">
                  <Users className="w-4 h-4" /> Up to {room.capacity} people
                </span>
              </div>
            </div>
            <Badge className="bg-white/20 text-white border-white/30 text-sm px-3 py-1 backdrop-blur-sm">
              {room.isActive ? "Available" : "Unavailable"}
            </Badge>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Room info */}
          <div className="lg:col-span-3 space-y-6">
            {room.description && (
              <div className="bg-white rounded-xl border p-5">
                <h2 className="font-semibold text-slate-800 mb-2">About this room</h2>
                <p className="text-muted-foreground text-sm leading-relaxed">{room.description}</p>
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Capacity</p>
                  <p className="font-semibold text-slate-800">{room.capacity} people</p>
                </div>
              </div>
              <div className="bg-white rounded-xl border p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Location</p>
                  <p className="font-semibold text-slate-800">Floor {room.floor}</p>
                </div>
              </div>
            </div>

            {room.amenities.length > 0 && (
              <div className="bg-white rounded-xl border p-5">
                <h2 className="font-semibold text-slate-800 mb-4">Amenities</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {room.amenities.map((a) => (
                    <div key={a} className="flex items-center gap-2.5 p-3 rounded-lg bg-slate-50 border border-slate-100 text-sm">
                      <div className="w-7 h-7 rounded-md bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                        {AMENITY_ICONS[a]}
                      </div>
                      <span className="text-slate-700">{AMENITY_LABELS[a] ?? a}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Booking form */}
          <div className="lg:col-span-2">
            <Card className="sticky top-24 border shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">Book this room</CardTitle>
                  {autoConfirm ? (
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Instant
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs flex items-center gap-1 text-amber-600 border-amber-200">
                      <Timer className="w-3 h-3" /> Needs approval
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <Separator />
              <CardContent className="pt-5">
                {booking ? (
                  <div className="py-6 text-center space-y-4">
                    <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center ${
                      (booking as any).status === "CONFIRMED" ? "bg-emerald-50" : "bg-amber-50"
                    }`}>
                      {(booking as any).status === "CONFIRMED" ? (
                        <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                      ) : (
                        <Timer className="w-8 h-8 text-amber-500" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">
                        {(booking as any).status === "CONFIRMED" ? "Booking Confirmed!" : "Request Submitted!"}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {(booking as any).status === "CONFIRMED"
                          ? "Your room is reserved. Check My Bookings for details."
                          : "Your request is pending admin approval."}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 pt-1">
                      <Button onClick={() => setBooking(null)} variant="outline">Book Again</Button>
                      <Button asChild className="bg-blue-600 hover:bg-blue-700">
                        <Link to="/bookings">View My Bookings</Link>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleBooking} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="date" className="text-sm font-medium flex items-center gap-1.5">
                        <CalendarDays className="w-3.5 h-3.5 text-blue-600" /> Date
                      </Label>
                      <Input id="date" type="date" min={today} value={form.date}
                        onChange={(e) => setForm((f) => ({ ...f, date: e.target.value, slot: "" }))} required
                        className="border-slate-200" />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-blue-600" /> Time Slot
                      </Label>
                      <div className="grid grid-cols-2 gap-2">
                        {SLOTS.map((s) => {
                          const booked = bookedSlots.has(s.start);
                          const selected = form.slot === s.start;
                          return (
                            <button
                              key={s.start}
                              type="button"
                              disabled={booked}
                              onClick={() => setForm((f) => ({ ...f, slot: s.start }))}
                              className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors text-left ${
                                booked
                                  ? "border-red-200 bg-red-50 text-red-400 cursor-not-allowed"
                                  : selected
                                  ? "bg-blue-600 text-white border-blue-600"
                                  : "border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-slate-700"
                              }`}
                            >
                              <div>{s.start}–{s.end}</div>
                              {booked && <div className="text-xs font-normal mt-0.5 text-red-400">จองแล้ว</div>}
                            </button>
                          );
                        })}
                      </div>
                      {!form.slot && (
                        <p className="text-xs text-muted-foreground">เลือกช่วงเวลาที่ต้องการ</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="attendees" className="text-sm font-medium flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-blue-600" /> Attendees
                      </Label>
                      <Input id="attendees" type="number" min="1" max={room.capacity}
                        value={form.attendees}
                        onChange={(e) => setForm((f) => ({ ...f, attendees: e.target.value }))} required
                        className="border-slate-200" />
                      <p className="text-xs text-muted-foreground">Max {room.capacity} people</p>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="purpose" className="text-sm font-medium">Purpose / Topic</Label>
                      <Textarea id="purpose" placeholder="e.g. Team meeting, Lecture, Exam…"
                        value={form.purpose}
                        onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
                        rows={3} required className="border-slate-200 resize-none" />
                    </div>

                    <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white" disabled={bookMutation.isPending}>
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
