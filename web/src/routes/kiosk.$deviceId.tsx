import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import jsQR from "jsqr";
import { RefreshCw, CheckCircle, XCircle, Camera, Plus, X } from "lucide-react";

export const Route = createFileRoute("/kiosk/$deviceId")({
  component: KioskPage,
});

// ── Types ────────────────────────────────────────────────────────────────────

type Booking = {
  id: string;
  startTime: string;
  endTime: string;
  purpose?: string | null;
  user?: { name: string } | null;
  status: string;
  walkInRequesterName?: string | null;
};

type DeviceStatus = {
  device: { id: string; name: string; room?: { name: string; floor: string } | null };
  currentBooking: (Booking & { user?: { name: string; email: string } | null }) | null;
  nextBooking: (Booking & { user?: { name: string; email: string } | null }) | null;
  checkInWindow: { bookingId: string; opensAt: string; closesAt: string } | null;
  nextCheckInWindow: { opensAt: string; closesAt: string } | null;
};

type DeviceSchedule = {
  device: { id: string; name: string };
  bookings: Booking[];
};

type ScanResult = { ok: boolean; message: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString("th-TH", {
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Bangkok",
  });
}

function fmtDate() {
  return new Date().toLocaleDateString("th-TH", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Bangkok",
  });
}

async function kioskFetch(path: string, deviceKey: string, options?: RequestInit) {
  return fetch(`/api${path}`, {
    ...options,
    headers: {
      "X-Device-Key": deviceKey,
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  });
}

// ── QR Scanner ────────────────────────────────────────────────────────────────

function QRScanner({ onScan, paused }: { onScan: (token: string) => void; paused: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const pausedRef = useRef(paused);
  const [error, setError] = useState("");

  useEffect(() => { pausedRef.current = paused; }, [paused]);

  useEffect(() => {
    let active = true;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (!active) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        scan();
      } catch {
        setError("ไม่สามารถเข้าถึงกล้องได้ กรุณาอนุญาตการใช้งานกล้อง");
      }
    }

    function scan() {
      if (!active) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
        rafRef.current = requestAnimationFrame(scan);
        return;
      }
      if (!pausedRef.current) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(video, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const result = jsQR(imageData.data, imageData.width, imageData.height);
        if (result?.data) {
          onScan(result.data);
          rafRef.current = requestAnimationFrame(scan);
          return;
        }
      }
      rafRef.current = requestAnimationFrame(scan);
    }

    start();

    return () => {
      active = false;
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [onScan]);

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
      <canvas ref={canvasRef} className="hidden" />
      {/* Viewfinder */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-32 h-32 border border-white/30 rounded-xl relative overflow-hidden">
          <span className="absolute -top-0.5 -left-0.5 w-4 h-4 border-t-2 border-l-2 border-blue-400 rounded-tl-lg" />
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 border-t-2 border-r-2 border-blue-400 rounded-tr-lg" />
          <span className="absolute -bottom-0.5 -left-0.5 w-4 h-4 border-b-2 border-l-2 border-blue-400 rounded-bl-lg" />
          <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 border-b-2 border-r-2 border-blue-400 rounded-br-lg" />
          {!paused && <div className="kiosk-scan-line" />}
        </div>
      </div>
      <div className="absolute bottom-2 left-0 right-0 flex justify-center pointer-events-none">
        <p className="text-white/30 text-xs">ยื่น QR code ให้กล้อง เพื่อเช็คอิน</p>
      </div>
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <p className="text-red-400 text-center px-4 text-xs">{error}</p>
        </div>
      )}
    </div>
  );
}

// ── Main Kiosk Component ──────────────────────────────────────────────────────

function KioskPage() {
  const { deviceId } = Route.useParams();
  const navigate = useNavigate();

  const [deviceKey, setDeviceKey] = useState<string | null>(null);
  const [status, setStatus] = useState<DeviceStatus | null>(null);
  const [schedule, setSchedule] = useState<DeviceSchedule | null>(null);
  const [now, setNow] = useState(new Date());
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [toastExiting, setToastExiting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scanPaused, setScanPaused] = useState(false);
  const [walkinOpen, setWalkinOpen] = useState(false);
  const [walkinForm, setWalkinForm] = useState({
    requesterName: "",
    requesterReference: "",
    purpose: "",
    attendees: "1",
    duration: 60,
  });
  const [walkinPending, setWalkinPending] = useState(false);
  const cooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clock tick
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Load credentials from sessionStorage
  useEffect(() => {
    const storedId = sessionStorage.getItem("kiosk_device_id");
    const storedKey = sessionStorage.getItem("kiosk_device_key");
    if (!storedId || !storedKey || storedId !== deviceId) {
      navigate({ to: "/pair" });
      return;
    }
    setDeviceKey(storedKey);
  }, [deviceId, navigate]);

  const fetchData = useCallback(async () => {
    if (!deviceKey) return;
    try {
      const [s, sc] = await Promise.all([
        kioskFetch(`/devices/${deviceId}/status`, deviceKey).then((r) => {
          if (r.status === 401 || r.status === 403) {
            sessionStorage.removeItem("kiosk_device_id");
            sessionStorage.removeItem("kiosk_device_key");
            navigate({ to: "/pair" });
            return null;
          }
          return r.json();
        }),
        kioskFetch(`/devices/${deviceId}/schedule`, deviceKey).then((r) => r.ok ? r.json() : null),
      ]);
      if (s) setStatus(s);
      if (sc) setSchedule(sc);
    } finally {
      setLoading(false);
    }
  }, [deviceId, deviceKey, navigate]);

  // Initial fetch + auto-refresh
  useEffect(() => {
    if (!deviceKey) return;
    fetchData();
    const t = setInterval(fetchData, 30_000);
    return () => clearInterval(t);
  }, [deviceKey, fetchData]);

  // SSE is the fast path. The 30-second refresh above remains the polling
  // fallback if a proxy or network interrupts streaming.
  useEffect(() => {
    if (!deviceKey) return;
    const controller = new AbortController();
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let reconnectDelay = 1_000;

    const connect = async () => {
      if (controller.signal.aborted) return;
      try {
        const response = await kioskFetch(`/devices/${deviceId}/events`, deviceKey, {
          signal: controller.signal,
        });
        if (!response.ok || !response.body) throw new Error("SSE unavailable");
        reconnectDelay = 1_000;
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (!controller.signal.aborted) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split("\n\n");
          buffer = frames.pop() ?? "";
          for (const frame of frames) {
            const data = frame.split("\n").find((line) => line.startsWith("data: "))?.slice(6);
            if (!data) continue;
            const event = JSON.parse(data) as { type?: string };
            if (event.type && !["connected", "stream.degraded"].includes(event.type)) {
              void fetchData();
            }
          }
        }
      } catch {
        // The periodic refresh stays active while the stream reconnects.
      }
      if (!controller.signal.aborted) {
        reconnectTimer = setTimeout(() => void connect(), reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, 30_000);
      }
    };

    void connect();
    return () => {
      controller.abort();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [deviceId, deviceKey, fetchData]);

  // Heartbeat
  useEffect(() => {
    if (!deviceKey) return;
    void kioskFetch(`/devices/${deviceId}/heartbeat`, deviceKey, { method: "PATCH" });
    const t = setInterval(() => {
      void kioskFetch(`/devices/${deviceId}/heartbeat`, deviceKey, { method: "PATCH" });
    }, 30_000);
    return () => clearInterval(t);
  }, [deviceId, deviceKey]);

  const showToast = useCallback((result: ScanResult) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastExiting(false);
    setScanResult(result);
    toastTimerRef.current = setTimeout(() => {
      setToastExiting(true);
      setTimeout(() => {
        setScanResult(null);
        setToastExiting(false);
      }, 220);
    }, 3800);
  }, []);

  const handleScan = useCallback(async (token: string) => {
    if (!deviceKey) return;
    setScanPaused(true);
    try {
      const res = await kioskFetch(`/devices/${deviceId}/scan`, deviceKey, {
        method: "POST",
        body: JSON.stringify({ qrToken: token }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast({ ok: false, message: data.message || "Check-in ล้มเหลว" });
      } else {
        showToast({ ok: true, message: `เช็คอินสำเร็จ! ยินดีต้อนรับ ${data.user?.name ?? ""}` });
        fetchData();
      }
    } catch {
      showToast({ ok: false, message: "เกิดข้อผิดพลาด กรุณาลองใหม่" });
    }
    cooldownRef.current = setTimeout(() => setScanPaused(false), 3000);
  }, [deviceId, deviceKey, fetchData, showToast]);

  const handleWalkin = useCallback(async () => {
    if (!deviceKey) return;
    setWalkinPending(true);
    try {
      const res = await kioskFetch(`/devices/${deviceId}/walkin`, deviceKey, {
        method: "POST",
        body: JSON.stringify({
          durationMinutes: walkinForm.duration,
          attendees: parseInt(walkinForm.attendees) || 1,
          purpose: walkinForm.purpose || "Walk-in Booking",
          requesterName: walkinForm.requesterName.trim(),
          requesterReference: walkinForm.requesterReference.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.status === "CHECKED_IN") {
        setWalkinOpen(false);
        setWalkinForm({ requesterName: "", requesterReference: "", purpose: "", attendees: "1", duration: 60 });
        showToast({ ok: true, message: "จองและเช็คอินสำเร็จ ห้องกำลังใช้งาน" });
        fetchData();
      } else {
        const message = data.status === "PENDING"
          ? "ส่งคำขอแล้ว แต่ยังรอผู้ดูแลอนุมัติ"
          : data?.error ?? "จองไม่สำเร็จ";
        showToast({ ok: false, message });
      }
    } catch {
      showToast({ ok: false, message: "เกิดข้อผิดพลาด กรุณาลองใหม่" });
    }
    setWalkinPending(false);
  }, [deviceId, deviceKey, walkinForm, fetchData, showToast]);

  useEffect(() => () => {
    if (cooldownRef.current) clearTimeout(cooldownRef.current);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  const isOccupied = !!status?.currentBooking;
  const roomName = status?.device?.room?.name ?? "No Room Assigned";
  const floor = status?.device?.room?.floor;

  // The backend owns the shared [-10, +12] minute check-in window.
  const checkInWindow = (() => {
    const window = status?.checkInWindow;
    if (!window) return null;
    const opens = new Date(window.opensAt);
    const closes = new Date(window.closesAt);
    if (now >= opens && now <= closes) return { opens, closes };
    return null;
  })();
  const cameraActive = !!checkInWindow;

  // Progress towards next booking (0–100)
  const nextProgress = (() => {
    const next = status?.nextBooking;
    if (!next) return null;
    const start = new Date(next.startTime);
    // Show progress from 1 hour before, or from now if closer
    const windowStart = new Date(start.getTime() - 60 * 60 * 1000);
    const total = start.getTime() - windowStart.getTime();
    const elapsed = now.getTime() - windowStart.getTime();
    return Math.max(0, Math.min(100, (elapsed / total) * 100));
  })();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-gray-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col select-none overflow-hidden">
      {/* Scan result toast */}
      {scanResult && (
        <div
          className={`fixed top-6 left-1/2 z-40 flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl text-sm font-medium ${
            scanResult.ok ? "bg-green-600" : "bg-red-600"
          } ${toastExiting ? "kiosk-toast-exit" : "kiosk-toast-enter"}`}
        >
          {scanResult.ok ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
          {scanResult.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-white/10">
        <div>
          <h1 className="text-2xl font-bold">{roomName}</h1>
          {floor && <p className="text-sm text-gray-400">ชั้น {floor}</p>}
        </div>
        <div className="text-right">
          <p className="text-3xl font-mono font-bold tabular-nums">
            {now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "Asia/Bangkok" })}
          </p>
          <p className="text-sm text-gray-400">{fmtDate()}</p>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* Left: Status */}
        <div className="flex flex-col justify-between w-1/2 border-r border-white/10 p-8">
          <div>
            {/* Status badge */}
            <div
              className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold mb-6 transition-all duration-700 ${
                isOccupied ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full transition-colors duration-700 ${
                  isOccupied ? "bg-red-400 animate-pulse" : "bg-green-400 animate-pulse"
                }`}
              />
              {isOccupied ? "กำลังใช้งาน" : "ว่าง"}
            </div>

            <div className="transition-all duration-700">
              {isOccupied && status?.currentBooking ? (
                <div className="space-y-3">
                  <p className="text-4xl font-bold leading-tight">{status.currentBooking.purpose ?? "การประชุม"}</p>
                  <p className="text-gray-400 text-lg">{fmt(status.currentBooking.startTime)} – {fmt(status.currentBooking.endTime)}</p>
                  {status.currentBooking.user?.name && (
                    <p className="text-gray-500 text-sm">โดย {status.currentBooking.walkInRequesterName ?? status.currentBooking.user.name}</p>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-5xl font-bold text-green-400">ว่าง</p>
                  <button
                    onClick={() => setWalkinOpen(true)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-300 rounded-xl text-sm font-medium transition-colors"
                  >
                    <Plus className="w-4 h-4" /> จองเดี๋ยวนี้
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Next booking with progress bar */}
          {status?.nextBooking && (
            <div className="bg-white/5 rounded-2xl p-5 overflow-hidden">
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">ถัดไป</p>
              <p className="font-semibold text-lg">{status.nextBooking.purpose ?? "การประชุม"}</p>
              <p className="text-gray-400 text-sm mt-1">
                {fmt(status.nextBooking.startTime)} – {fmt(status.nextBooking.endTime)}
              </p>
              {nextProgress !== null && (
                <div className="mt-3 h-0.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500/60 rounded-full transition-[width] duration-1000"
                    style={{ width: `${nextProgress}%` }}
                  />
                </div>
              )}
            </div>
          )}

          {!status?.nextBooking && !isOccupied && (
            <p className="text-gray-600 text-sm">ไม่มีการจองในวันนี้</p>
          )}
        </div>

        {/* Right: Schedule */}
        <div className="w-1/2 p-8 flex flex-col">
          <h2 className="text-xs text-gray-500 uppercase tracking-widest mb-4">ตารางวันนี้</h2>
          <div className="flex-1 overflow-y-auto space-y-2">
            {!schedule?.bookings.length ? (
              <p className="text-gray-600 text-sm">ไม่มีการจอง</p>
            ) : (
              schedule.bookings.map((b, i) => {
                const isPast = new Date(b.endTime) < now;
                const isCurrent = new Date(b.startTime) <= now && new Date(b.endTime) > now;
                return (
                  <div
                    key={b.id}
                    className={`kiosk-card-in rounded-xl p-4 border transition-colors ${
                      isCurrent
                        ? "bg-red-500/10 border-red-500/30"
                        : isPast
                        ? "bg-white/3 border-white/5 opacity-40"
                        : "bg-white/5 border-white/10"
                    }`}
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className={`font-medium truncate ${isCurrent ? "text-red-300" : "text-white"}`}>
                          {b.purpose ?? "การประชุม"}
                        </p>
                        {(b.walkInRequesterName || b.user?.name) && (
                          <p className="text-xs text-gray-500 mt-0.5 truncate">{b.walkInRequesterName ?? b.user?.name}</p>
                        )}
                      </div>
                      <p className="text-sm text-gray-400 shrink-0 tabular-nums">
                        {fmt(b.startTime)}–{fmt(b.endTime)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Walk-in booking modal */}
      {walkinOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-gray-900 border border-white/10 rounded-2xl p-8 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">จองเดี๋ยวนี้</h2>
              <button onClick={() => setWalkinOpen(false)} className="text-gray-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-widest mb-1.5 block">ชื่อผู้ขอใช้ห้อง</label>
                <input
                  type="text"
                  value={walkinForm.requesterName}
                  onChange={(e) => setWalkinForm((f) => ({ ...f, requesterName: e.target.value }))}
                  maxLength={120}
                  placeholder="ชื่อ–นามสกุล"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-widest mb-1.5 block">รหัสผู้ใช้ / ติดต่อ (ถ้ามี)</label>
                <input
                  type="text"
                  value={walkinForm.requesterReference}
                  onChange={(e) => setWalkinForm((f) => ({ ...f, requesterReference: e.target.value }))}
                  maxLength={120}
                  placeholder="เช่น รหัสนักศึกษา หรืออีเมล"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-widest mb-1.5 block">หัวข้อ / วัตถุประสงค์</label>
                <input
                  type="text"
                  value={walkinForm.purpose}
                  onChange={(e) => setWalkinForm((f) => ({ ...f, purpose: e.target.value }))}
                  placeholder="เช่น การประชุม, เรียน..."
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-widest mb-1.5 block">จำนวนคน</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={walkinForm.attendees}
                  onChange={(e) => setWalkinForm((f) => ({ ...f, attendees: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-widest mb-1.5 block">ระยะเวลา</label>
                <div className="grid grid-cols-4 gap-2">
                  {[30, 60, 90, 120].map((d) => (
                    <button
                      key={d}
                      onClick={() => setWalkinForm((f) => ({ ...f, duration: d }))}
                      className={`py-2 rounded-lg text-sm font-medium border transition-colors ${
                        walkinForm.duration === d
                          ? "bg-blue-600 border-blue-600 text-white"
                          : "border-white/10 text-gray-400 hover:border-white/30"
                      }`}
                    >
                      {d < 60 ? `${d}น.` : `${d / 60}ชม.`}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={handleWalkin}
                disabled={walkinPending || !walkinForm.requesterName.trim()}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
              >
                {walkinPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {walkinPending ? "กำลังจอง…" : "ยืนยันการจอง"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Camera strip */}
      <div className="border-t border-white/10 h-48 flex">
        <div className="flex-1 relative bg-black">
          {cameraActive ? (
            <QRScanner onScan={handleScan} paused={scanPaused} />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2">
              <Camera className="w-6 h-6 text-gray-700 animate-pulse" />
              {status?.nextBooking ? (
                <>
                  <p className="text-gray-600 text-xs">กล้องจะเปิดเมื่อถึงเวลาเช็คอิน</p>
                  <p className="text-gray-500 text-sm font-medium tabular-nums">
                    {status.nextCheckInWindow ? fmt(status.nextCheckInWindow.opensAt) : "–"} น.
                  </p>
                </>
              ) : (
                <p className="text-gray-700 text-xs">ไม่มีการจองในวันนี้</p>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center px-6 border-l border-white/10">
          <p className="text-xs text-gray-700 whitespace-nowrap" style={{ writingMode: "vertical-rl" }}>
            Room Booking Kiosk · {status?.device?.name ?? deviceId}
          </p>
        </div>
      </div>
    </div>
  );
}
