import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { useTitle } from "../lib/useTitle";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "../lib/useCurrentUser";
import { roomQuery, roomAvailabilityQuery, sessionQuery, waitlistQuery } from "../lib/queries";
import { app } from "../lib/api";
import { Navbar } from "../components/Navbar";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Calendar } from "../components/ui/calendar";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Separator } from "../components/ui/separator";
import { Textarea } from "../components/ui/textarea";
import {
  ArrowLeft, Building2, Users, Monitor, PenSquare, Tv, Wind, Wifi,
  CalendarDays, Clock, CheckCircle2, Timer, Loader2, MapPin, ChevronLeft, ChevronRight, Bell,
} from "lucide-react";
import { LoadingCentered } from "../components/LoadingSpinner";
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
  { start: "16:00", end: "17:00" },
  { start: "17:00", end: "18:00" },
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
type CalendarBooking = { id: string; startTime: string; endTime: string; status: string; purpose: string | null };

function RoomDetailPage() {
  const { roomId } = Route.useParams();
  const { user } = useCurrentUser();
  const qc = useQueryClient();
  const { data: room, isLoading: roomLoading } = useQuery(roomQuery(roomId));
  const [booking, setBooking] = useState<BookingResult | null>(null);
  const [conflictAlts, setConflictAlts] = useState<{ startTime: string; endTime: string }[]>([]);
  const [waitlisted, setWaitlisted] = useState(false);
  const [conflictSlot, setConflictSlot] = useState<{ startTime: string; endTime: string } | null>(null);

  const today = new Date().toLocaleDateString("en-CA");
  const [form, setForm] = useState({
    date: today,
    slot: "" as string,
    attendees: "1",
    purpose: "",
  });

  const { data: availability } = useQuery({
    ...roomAvailabilityQuery(roomId, form.date),
    staleTime: 30_000,
  });

  const now = new Date();

  const bookedSlots = new Set<string>(
    SLOTS.filter((s) => {
      if (!availability?.bookings?.length) return false;
      const slotStart = new Date(`${form.date}T${s.start}:00`);
      const slotEnd = new Date(`${form.date}T${s.end}:00`);
      return availability.bookings.some((b) => new Date(b.startTime) < slotEnd && new Date(b.endTime) > slotStart);
    }).map((s) => s.start),
  );

  const pastSlots = new Set<string>(
    SLOTS.filter((s) => new Date(`${form.date}T${s.start}:00`) < now).map((s) => s.start),
  );

  // Clear selected slot if it becomes unavailable (e.g. date changed or someone else books it)
  useEffect(() => {
    if (form.slot && (bookedSlots.has(form.slot) || pastSlots.has(form.slot))) {
      setForm((f) => ({ ...f, slot: "" }));
    }
  }, [form.date, availability]);

  const bookMutation = useMutation({
    mutationFn: async () => {
      const slot = SLOTS.find((s) => s.start === form.slot)!;
      const startTime = new Date(`${form.date}T${slot.start}:00`).toISOString();
      const endTime = new Date(`${form.date}T${slot.end}:00`).toISOString();
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ roomId, startTime, endTime, attendees: parseInt(form.attendees), purpose: form.purpose }),
      });
      const data = await res.json();
      if (!res.ok) {
        const err: any = new Error(data?.error ?? "Booking failed");
        err.alternatives = data?.alternatives ?? [];
        throw err;
      }
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
    onError: (err: any) => {
      if (err?.alternatives?.length) {
        // Save the originally requested slot so waitlist mutation can use it
        const slot = SLOTS.find((s) => s.start === form.slot);
        if (slot) {
          setConflictSlot({
            startTime: new Date(`${form.date}T${slot.start}:00`).toISOString(),
            endTime: new Date(`${form.date}T${slot.end}:00`).toISOString(),
          });
        }
        setConflictAlts(err.alternatives);
      } else {
        toast.error(err?.message ?? "Booking failed. Please try again.");
      }
    },
  });

  const waitlistMutation = useMutation({
    mutationFn: async () => {
      if (!conflictSlot) throw new Error("No slot selected");
      const res = await fetch("/api/bookings/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          roomId,
          startTime: conflictSlot.startTime,
          endTime: conflictSlot.endTime,
          attendees: parseInt(form.attendees),
          purpose: form.purpose || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Failed to join waitlist");
      }
      return data;
    },
    onSuccess: () => {
      setWaitlisted(true);
      setConflictAlts([]);
      qc.invalidateQueries({ queryKey: ["waitlist"] });
    },
    onError: (err: any) => {
      if (err?.message?.includes("PRO")) {
        toast.error("ฟีเจอร์ Waitlist สำหรับผู้ใช้ PRO เท่านั้น");
      } else {
        toast.error(err?.message ?? "ไม่สามารถเข้าคิวรอได้");
      }
    },
  });

  function handleBooking(e: React.FormEvent) {
    e.preventDefault();
    if (!form.slot) { toast.error("Please select a time slot."); return; }
    if (pastSlots.has(form.slot)) { toast.error("Cannot book a time slot in the past."); return; }
    if (!form.purpose.trim()) { toast.error("Please enter a purpose."); return; }
    bookMutation.mutate();
  }

  useTitle(room?.name);
  const autoConfirm = user?.isTeacher || user?.isAdmin;
  const userRole = user?.isAdmin ? "adminRole" : user?.isTeacher ? "teacherRole" : "userRole";
  const canBook = !room || !room.allowedRoles?.length || room.allowedRoles.includes(userRole);

  if (roomLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar user={user} />
        <LoadingCentered />
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

            <WeeklyCalendar roomId={roomId} />
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
                {!canBook ? (
                  <div className="py-8 text-center space-y-3">
                    <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto">
                      <Users className="w-7 h-7 text-red-400" />
                    </div>
                    <p className="font-medium text-slate-800">ไม่สามารถจองได้</p>
                    <p className="text-sm text-muted-foreground">ห้องนี้เปิดให้จองเฉพาะ{" "}
                      {room?.allowedRoles?.map((r) =>
                        r === "teacherRole" ? "อาจารย์" : r === "adminRole" ? "แอดมิน" : "นักศึกษา"
                      ).join(", ")} เท่านั้น
                    </p>
                  </div>
                ) : waitlisted ? (
                  <div className="py-6 text-center space-y-4">
                    <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center bg-violet-50">
                      <Bell className="w-8 h-8 text-violet-500" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">อยู่ในคิวรอแล้ว!</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        เราจะแจ้งเตือนและยืนยันการจองอัตโนมัติเมื่อมีที่ว่าง
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 pt-1">
                      <Button onClick={() => { setWaitlisted(false); setConflictSlot(null); }} variant="outline">ลองจองเวลาอื่น</Button>
                      <Button asChild className="bg-blue-600 hover:bg-blue-700">
                        <Link to="/bookings">ดูรายการของฉัน</Link>
                      </Button>
                    </div>
                  </div>
                ) : booking ? (
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
                      <Label className="text-sm font-medium flex items-center gap-1.5">
                        <CalendarDays className="w-3.5 h-3.5 text-blue-600" /> วันที่
                      </Label>
                      <div className="border rounded-md flex justify-center">
                        <Calendar
                          mode="single"
                          selected={form.date ? new Date(form.date + "T00:00:00") : undefined}
                          onSelect={(d) => {
                            if (!d) return;
                            setForm((f) => ({ ...f, date: d.toLocaleDateString("en-CA"), slot: "" }));
                          }}
                          disabled={(d) => {
                            const day = d.getDay();
                            const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
                            return d < todayStart || day === 0 || day === 6;
                          }}
                          initialFocus
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-blue-600" /> Time Slot
                      </Label>
                      <div className="grid grid-cols-2 gap-2">
                        {SLOTS.map((s) => {
                          const booked = bookedSlots.has(s.start);
                          const past = pastSlots.has(s.start);
                          const unavailable = booked || past;
                          const selected = form.slot === s.start;
                          return (
                            <button
                              key={s.start}
                              type="button"
                              disabled={unavailable}
                              onClick={() => setForm((f) => ({ ...f, slot: s.start }))}
                              className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors text-left ${
                                booked
                                  ? "border-red-200 bg-red-50 text-red-400 cursor-not-allowed"
                                  : past
                                  ? "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
                                  : selected
                                  ? "bg-blue-600 text-white border-blue-600"
                                  : "border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-slate-700"
                              }`}
                            >
                              <div>{s.start}–{s.end}</div>
                              {booked && <div className="text-xs font-normal mt-0.5 text-red-400">จองแล้ว</div>}
                              {past && !booked && <div className="text-xs font-normal mt-0.5 text-slate-400">ผ่านไปแล้ว</div>}
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

                    {conflictAlts.length > 0 && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
                        <p className="text-xs font-medium text-amber-700">ช่วงเวลานี้ถูกจองแล้ว ลองช่วงเวลาอื่น:</p>
                        <div className="space-y-1.5">
                          {conflictAlts.map((alt) => {
                            const s = new Date(alt.startTime);
                            const e = new Date(alt.endTime);
                            const fmt = (d: Date) => d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", hour12: false });
                            return (
                              <button
                                key={alt.startTime}
                                type="button"
                                onClick={() => {
                                  const d = s.toLocaleDateString("en-CA");
                                  const start = `${s.getHours().toString().padStart(2,"0")}:${s.getMinutes().toString().padStart(2,"0")}`;
                                  setForm((f) => ({ ...f, date: d, slot: start }));
                                  setConflictAlts([]);
                                  setConflictSlot(null);
                                  toast.info(`เลือก ${fmt(s)}–${fmt(e)} แล้ว`);
                                }}
                                className="w-full text-left px-3 py-1.5 rounded-md border border-amber-200 bg-white hover:bg-amber-100 text-sm text-amber-800 transition-colors"
                              >
                                {fmt(s)} – {fmt(e)}
                              </button>
                            );
                          })}
                        </div>
                        {user?.plan === "PRO" && conflictSlot && (
                          <div className="pt-1.5 border-t border-amber-200">
                            <p className="text-xs text-amber-600 mb-1.5">หรือเข้าคิวรอสำหรับช่วงเวลานี้</p>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="w-full border-amber-300 text-amber-700 hover:bg-amber-100"
                              onClick={() => waitlistMutation.mutate()}
                              disabled={waitlistMutation.isPending}
                            >
                              {waitlistMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                              <Bell className="w-3.5 h-3.5 mr-1.5" />
                              เข้าคิวรอ (Waitlist)
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
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

// ── Weekly Calendar ───────────────────────────────────────────────────────────

const CAL_HOUR_START = 8;
const CAL_HOUR_END = 18;
const CAL_HOURS = Array.from({ length: CAL_HOUR_END - CAL_HOUR_START + 1 }, (_, i) => CAL_HOUR_START + i);
const DAYS = ["จ", "อ", "พ", "พฤ", "ศ"];
const STATUS_COLOR: Record<string, string> = {
  CONFIRMED: "bg-blue-500 text-white",
  PENDING: "bg-amber-400 text-white",
  CHECKED_IN: "bg-emerald-500 text-white",
};

function getMonday(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - ((day + 6) % 7));
  d.setHours(0, 0, 0, 0);
  return d;
}

const TOTAL_MINS = (CAL_HOUR_END - CAL_HOUR_START) * 60;

function WeeklyCalendar({ roomId }: { roomId: string }) {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));

  const dateStr = weekStart.toLocaleDateString("en-CA");
  const { data, isLoading } = useQuery({
    queryKey: ["room-calendar", roomId, dateStr],
    queryFn: async () => {
      const res = await fetch(`/api/rooms/${roomId}/calendar?date=${dateStr}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load calendar");
      return res.json() as Promise<{ weekStart: string; bookings: CalendarBooking[] }>;
    },
    staleTime: 60_000,
  });

  const days = useMemo(() => Array.from({ length: 5 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  }), [weekStart]);

  const bookingsByDay = useMemo(() => {
    const map = new Map<string, CalendarBooking[]>();
    for (const b of data?.bookings ?? []) {
      const key = new Date(b.startTime).toLocaleDateString("en-CA");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(b);
    }
    return map;
  }, [data]);

  const todayStr = new Date().toLocaleDateString("en-CA");

  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-slate-800 text-sm">ตารางสัปดาห์นี้</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setWeekStart((w) => { const d = new Date(w); d.setDate(d.getDate() - 7); return d; })}
            className="p-1 rounded hover:bg-slate-100 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-slate-500" />
          </button>
          <span className="text-xs text-muted-foreground px-1 min-w-32 text-center">
            {weekStart.toLocaleDateString("th-TH", { day: "numeric", month: "short" })} –{" "}
            {days[4].toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
          </span>
          <button
            onClick={() => setWeekStart((w) => { const d = new Date(w); d.setDate(d.getDate() + 7); return d; })}
            className="p-1 rounded hover:bg-slate-100 transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[420px]">
            {/* Hour header row */}
            <div className="flex mb-0.5">
              <div className="w-10 shrink-0" />
              <div className="flex-1 relative h-5">
                {CAL_HOURS.map((h) => (
                  <span
                    key={h}
                    className="absolute text-[10px] text-muted-foreground -translate-x-1/2"
                    style={{ left: `${((h - CAL_HOUR_START) / (CAL_HOUR_END - CAL_HOUR_START)) * 100}%` }}
                  >
                    {h.toString().padStart(2, "0")}
                  </span>
                ))}
              </div>
            </div>

            {/* Day rows */}
            <div className="space-y-1">
              {days.map((d, i) => {
                const key = d.toLocaleDateString("en-CA");
                const isToday = key === todayStr;
                const dayBookings = bookingsByDay.get(key) ?? [];
                return (
                  <div key={i} className="flex items-center gap-1.5">
                    {/* Day label */}
                    <div className="w-10 shrink-0 text-right pr-1.5">
                      <span className={`text-xs font-medium ${isToday ? "text-blue-600" : "text-slate-500"}`}>
                        {DAYS[i]}
                      </span>
                      <span className={`block text-[10px] leading-none ${isToday ? "text-blue-500" : "text-muted-foreground"}`}>
                        {d.getDate()}
                      </span>
                    </div>

                    {/* Time bar */}
                    <div className={`flex-1 relative h-7 rounded ${isToday ? "bg-blue-50" : "bg-slate-50"} border border-slate-100`}>
                      {/* Hour grid lines */}
                      {CAL_HOURS.slice(1, -1).map((h) => (
                        <div
                          key={h}
                          className="absolute top-0 bottom-0 border-l border-slate-200 border-dashed"
                          style={{ left: `${((h - CAL_HOUR_START) / (CAL_HOUR_END - CAL_HOUR_START)) * 100}%` }}
                        />
                      ))}

                      {/* Booking blocks */}
                      {dayBookings.map((b) => {
                        const start = new Date(b.startTime);
                        const end = new Date(b.endTime);
                        const startMin = Math.max(0, start.getHours() * 60 + start.getMinutes() - CAL_HOUR_START * 60);
                        const endMin = Math.min(TOTAL_MINS, end.getHours() * 60 + end.getMinutes() - CAL_HOUR_START * 60);
                        if (endMin <= 0 || startMin >= TOTAL_MINS) return null;
                        const left = (startMin / TOTAL_MINS) * 100;
                        const width = Math.max(1, ((endMin - startMin) / TOTAL_MINS) * 100);
                        const color = STATUS_COLOR[b.status] ?? "bg-slate-400 text-white";
                        return (
                          <div
                            key={b.id}
                            className={`absolute top-0.5 bottom-0.5 rounded text-[9px] px-1 overflow-hidden flex items-center ${color}`}
                            style={{ left: `${left}%`, width: `${width}%` }}
                            title={`${start.getHours().toString().padStart(2,"0")}:${start.getMinutes().toString().padStart(2,"0")}–${end.getHours().toString().padStart(2,"0")}:${end.getMinutes().toString().padStart(2,"0")} ${b.purpose ?? ""}`}
                          >
                            <span className="truncate">{b.purpose ?? b.status}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex gap-3 mt-2.5 pt-2 border-t border-slate-100">
              {[["bg-blue-500", "ยืนยันแล้ว"], ["bg-amber-400", "รออนุมัติ"], ["bg-emerald-500", "เช็คอินแล้ว"]].map(([bg, label]) => (
                <div key={label} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <span className={`w-2 h-2 rounded-sm shrink-0 ${bg}`} />{label}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
