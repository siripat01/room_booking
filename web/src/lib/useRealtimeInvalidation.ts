import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

type Options = {
  roomId?: string;
  queryKeys: readonly (readonly unknown[])[];
};

export function useRealtimeInvalidation({ roomId, queryKeys }: Options) {
  const queryClient = useQueryClient();
  const queryKeySignature = JSON.stringify(queryKeys);

  useEffect(() => {
    let source: EventSource | undefined;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined;
    let closed = false;
    let reconnectDelay = 1_000;
    let fallbackDelay = 5_000;
    const stableQueryKeys = JSON.parse(queryKeySignature) as unknown[][];

    const refresh = () => {
      for (const queryKey of stableQueryKeys) void queryClient.invalidateQueries({ queryKey });
    };

    const scheduleFallback = () => {
      if (closed || fallbackTimer) return;
      fallbackTimer = setTimeout(() => {
        fallbackTimer = undefined;
        refresh();
        fallbackDelay = Math.min(fallbackDelay * 2, 60_000);
        scheduleFallback();
      }, fallbackDelay);
    };

    const connect = () => {
      if (closed) return;
      const params = new URLSearchParams();
      if (roomId) params.set("roomId", roomId);
      source = new EventSource(`/api/realtime/events${params.size ? `?${params}` : ""}`, {
        withCredentials: true,
      });
      source.onopen = () => {
        reconnectDelay = 1_000;
        fallbackDelay = 5_000;
        if (fallbackTimer) clearTimeout(fallbackTimer);
        fallbackTimer = undefined;
      };
      source.onmessage = (message) => {
        try {
          const event = JSON.parse(message.data) as { type?: string };
          if (event.type && !["connected", "stream.degraded"].includes(event.type)) refresh();
          if (event.type === "stream.degraded") scheduleFallback();
        } catch {
          // A malformed frame is isolated; later database-backed events remain usable.
        }
      };
      source.onerror = () => {
        source?.close();
        scheduleFallback();
        reconnectTimer = setTimeout(connect, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, 30_000);
      };
    };

    connect();
    return () => {
      closed = true;
      source?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (fallbackTimer) clearTimeout(fallbackTimer);
    };
  }, [queryClient, queryKeySignature, roomId]);
}
