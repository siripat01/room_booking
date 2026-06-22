import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Cpu } from "lucide-react";

export const Route = createFileRoute("/pair")({
  validateSearch: (search: Record<string, unknown>) => ({
    code: typeof search.code === "string" ? search.code : "",
  }),
  component: PairPage,
});

function PairPage() {
  const navigate = useNavigate();
  const { code: prefillCode } = Route.useSearch();
  const [code, setCode] = useState(prefillCode.replace(/\D/g, "").slice(0, 6));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handlePair(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/devices/pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Invalid pairing code");
      }

      const { deviceId, deviceKey } = await res.json();
      localStorage.setItem("kiosk_device_id", deviceId);
      localStorage.setItem("kiosk_device_key", deviceKey);

      navigate({ to: "/kiosk/$deviceId", params: { deviceId } });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 w-full max-w-sm shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
            <Cpu className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-white text-lg font-bold leading-tight">Pair Device</h1>
            <p className="text-gray-500 text-xs">Room Booking Kiosk</p>
          </div>
        </div>

        <p className="text-gray-400 text-sm mb-6">
          Enter the 6-digit pairing code shown in the admin panel. The code expires in 10 minutes.
        </p>

        <form onSubmit={handlePair} className="space-y-4">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={(e) => {
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
              setError("");
            }}
            placeholder="000000"
            autoFocus
            className="w-full text-center text-4xl tracking-[0.5em] font-mono bg-gray-800 text-white rounded-xl py-5 border border-gray-700 focus:border-blue-500 focus:outline-none placeholder:text-gray-700 placeholder:tracking-[0.5em]"
          />

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={code.length !== 6 || loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-600 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            {loading ? "Pairing…" : "Pair Device"}
          </button>
        </form>
      </div>
    </div>
  );
}
