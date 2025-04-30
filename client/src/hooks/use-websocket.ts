import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Opens ONE WebSocket (no localhost fallback) and commits
 * bay/order updates straight into React-Query caches.
 */
export function useWebSocket() {
  const qc = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // same origin, just replace http -> ws and append /ws
    const base =
      window.location.origin.replace(/^http/, "ws") + "/ws?client=server-app";
    const ws = new WebSocket(base);
    wsRef.current = ws;

    ws.onmessage = (evt) => {
      const msg = JSON.parse(evt.data);

      switch (msg.type) {
        case "ordersUpdate":
          qc.setQueryData(["orders", "all"], msg.data);
          break;

        case "order_updated":
          qc.invalidateQueries({ queryKey: ["orders"] });
          break;

        /* --- NEW: keep bay cache in sync ------------------------- */
        case "bay_updated": {
          const bay = msg.data.bay;
          qc.setQueryData(["/api/bays"], (old: any[] | undefined) =>
            !old ? old : old.map((b) => (b.id === bay.id ? bay : b))
          );
          break;
        }
        /* --------------------------------------------------------- */
      }
    };

    return () => ws.close();
  }, [qc]);
}
