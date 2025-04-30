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

        /* --- Bay updates (Aggressive: invalidate + replace in cache) ------------ */
        case "bay_updated": {
          console.log("WebSocket: Received bay update:", msg.data);
          const bay = msg.data.bay;
          
          // First update the specific bay in the cache
          qc.setQueryData(["/api/bays"], (old: any[] | undefined) => {
            if (!old) return old;
            console.log("WebSocket: Updating bay in cache:", bay.id, bay.status);
            return old.map((b) => (b.id === bay.id ? { ...b, ...bay } : b));
          });
          
          // Then force a complete API refresh to ensure we're in sync
          qc.invalidateQueries({ queryKey: ["/api/bays"] });
          
          // Also invalidate orders since they may have changed
          qc.invalidateQueries({ queryKey: ["/api/orders"] });
          
          break;
        }
        /* --------------------------------------------------------- */
      }
    };

    return () => ws.close();
  }, [qc]);
}
