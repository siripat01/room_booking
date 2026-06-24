import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import jsQR from "jsqr";
import { RefreshCw, CheckCircle, XCircle } from "lucide-react";

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
};

type DeviceStatus = {
  device: { id: string; name: string; room?: { name: string; floor: string } | null };
  currentBooking: (Booking & { user?: { name: string; email: string } | null }) | null;
  nextBooking: (Booking & { user?: { name: string; email: string } | null }) | null;
};

type DeviceSchedule = {
  device: { id: string; name: string };
  bookings: Booking[];
};

type ScanResult = { ok: boolean; message: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function fmtDate() {
  return new Date().toLocaleDateString("th-TH", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
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

// ── QR Scanner (always-on strip) ──────────────────────────────────────────────

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
        <div className="w-32 h-32 border border-white/50 rounded-xl relative">
          <span className="absolute -top-0.5 -left-0.5 w-4 h-4 border-t-2 border-l-2 border-blue-400 rounded-tl-lg" />
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 border-t-2 border-r-2 border-blue-400 rounded-tr-lg" />
          <span className="absolute -bottom-0.5 -left-0.5 w-4 h-4 border-b-2 border-l-2 border-blue-400 rounded-bl-lg" />
          <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 border-b-2 border-r-2 border-blue-400 rounded-br-lg" />
        </div>
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
  const [loading, setLoading] = useState(true);
  const [scanPaused, setScanPaused] = useState(false);
  const cooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clock tick
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Load credentials from localStorage
  useEffect(() => {
    const storedId = localStorage.getItem("kiosk_device_id");
    const storedKey = localStorage.getItem("kiosk_device_key");
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
            localStorage.removeItem("kiosk_device_id");
            localStorage.removeItem("kiosk_device_key");
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

  // Heartbeat
  useEffect(() => {
    if (!deviceKey) return;
    const t = setInterval(() => {
      kioskFetch(`/devices/${deviceId}/heartbeat`, deviceKey, { method: "PATCH" });
    }, 60_000);
    return () => clearInterval(t);
  }, [deviceId, deviceKey]);

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
        setScanResult({ ok: false, message: data.message || "Check-in ล้มเหลว" });
      } else {
        setScanResult({ ok: true, message: `เช็คอินสำเร็จ! ยินดีต้อนรับ ${data.user?.name ?? ""}` });
        fetchData();
      }
    } catch {
      setScanResult({ ok: false, message: "เกิดข้อผิดพลาด กรุณาลองใหม่" });
    }
    setTimeout(() => setScanResult(null), 4000);
    // 3-second cooldown before scanning again
    cooldownRef.current = setTimeout(() => setScanPaused(false), 3000);
  }, [deviceId, deviceKey, fetchData]);

  useEffect(() => () => { if (cooldownRef.current) clearTimeout(cooldownRef.current); }, []);

  const isOccupied = !!status?.currentBooking;
  const roomName = status?.device?.room?.name ?? "No Room Assigned";
  const floor = status?.device?.room?.floor;

  // Camera is active only during check-in window: [startTime - 10min, startTime]
  const checkInWindow = (() => {
    const next = status?.nextBooking;
    if (!next) return null;
    const start = new Date(next.startTime);
    const opens = new Date(start.getTime() - 10 * 60 * 1000);
    if (now >= opens && now < start) return { opens, closes: start };
    return null;
  })();
  const cameraActive = !!checkInWindow;

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
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl text-sm font-medium ${scanResult.ok ? "bg-green-600" : "bg-red-600"}`}>
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
            {now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
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
            <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold mb-6 ${isOccupied ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"}`}>
              <span className={`w-2 h-2 rounded-full ${isOccupied ? "bg-red-400" : "bg-green-400 animate-pulse"}`} />
              {isOccupied ? "กำลังใช้งาน" : "ว่าง"}
            </div>

            {isOccupied && status?.currentBooking ? (
              <div className="space-y-3">
                <p className="text-4xl font-bold leading-tight">{status.currentBooking.purpose ?? "การประชุม"}</p>
                <p className="text-gray-400 text-lg">{fmt(status.currentBooking.startTime)} – {fmt(status.currentBooking.endTime)}</p>
                {status.currentBooking.user?.name && (
                  <p className="text-gray-500 text-sm">โดย {status.currentBooking.user.name}</p>
                )}
              </div>
            ) : (
              <p className="text-5xl font-bold text-green-400">ว่าง</p>
            )}
          </div>

          {/* Next booking */}
          {status?.nextBooking && (
            <div className="bg-white/5 rounded-2xl p-5">
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">ถัดไป</p>
              <p className="font-semibold text-lg">{status.nextBooking.purpose ?? "การประชุม"}</p>
              <p className="text-gray-400 text-sm mt-1">
                {fmt(status.nextBooking.startTime)} – {fmt(status.nextBooking.endTime)}
              </p>
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
              schedule.bookings.map((b) => {
                const isPast = new Date(b.endTime) < now;
                const isCurrent = new Date(b.startTime) <= now && new Date(b.endTime) > now;
                return (
                  <div
                    key={b.id}
                    className={`rounded-xl p-4 border transition-colors ${
                      isCurrent
                        ? "bg-red-500/10 border-red-500/30"
                        : isPast
                        ? "bg-white/3 border-white/5 opacity-40"
                        : "bg-white/5 border-white/10"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className={`font-medium truncate ${isCurrent ? "text-red-300" : "text-white"}`}>
                          {b.purpose ?? "การประชุม"}
                        </p>
                        {b.user?.name && (
                          <p className="text-xs text-gray-500 mt-0.5 truncate">{b.user.name}</p>
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

      {/* Camera strip */}
      <div className="border-t border-white/10 h-48 flex">
        <div className="flex-1 relative bg-black">
          {cameraActive ? (
            <>
              <QRScanner onScan={handleScan} paused={scanPaused} />
              <div className="absolute bottom-2 left-0 right-0 flex justify-center pointer-events-none">
                <p className="text-white/30 text-xs">ยื่น QR code ให้กล้อง เพื่อเช็คอิน</p>
              </div>
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-1">
              {status?.nextBooking ? (
                <>
                  <p className="text-gray-600 text-xs">กล้องจะเปิดเมื่อถึงเวลาเช็คอิน</p>
                  <p className="text-gray-500 text-sm font-medium">
                    {fmt(new Date(new Date(status.nextBooking.startTime).getTime() - 10 * 60 * 1000).toISOString())} น.
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
