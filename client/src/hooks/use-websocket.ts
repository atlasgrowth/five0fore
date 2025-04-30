import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Opens ONE WebSocket (no localhost fallback) and directly updates 
 * React Query cache with real-time updates for improved performance.
 */
export function useWebSocket() {
  const qc = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const [lastMessage, setLastMessage] = useState<any>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const maxReconnectAttempts = 5;
  const reconnectDelay = 2000; // 2 seconds

  useEffect(() => {
    let reconnectTimeout: NodeJS.Timeout | null = null;
    const connectWebSocket = () => {
      // Use provided environment variable if available, otherwise fallback to origin-based URL
      const base = 
        import.meta.env.VITE_WS_BASE_URL || 
        window.location.origin.replace(/^http/, "ws") + "/ws";
      
      // Append client parameter
      const wsUrl = `${base}${base.includes('?') ? '&' : '?'}client=kitchen-app`;
      
      console.log("Connecting to WebSocket:", wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      // Connection event handlers
      ws.onopen = () => {
        console.log("WebSocket connected");
        setReconnectAttempts(0); // Reset reconnect attempts on successful connection
      };

      ws.onclose = (event) => {
        console.log("WebSocket disconnected, code:", event.code);
        // Don't reconnect if the close was clean (code 1000)
        if (event.code !== 1000 && reconnectAttempts < maxReconnectAttempts) {
          console.log(`Attempting to reconnect (${reconnectAttempts + 1}/${maxReconnectAttempts})...`);
          reconnectTimeout = setTimeout(() => {
            setReconnectAttempts(prev => prev + 1);
            connectWebSocket();
          }, reconnectDelay);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          setLastMessage(msg);
          handleWebSocketMessage(msg);
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close(1000); // Clean close
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, [reconnectAttempts]); // Reconnect dependency

  // Central message handler for all WebSocket messages
  const handleWebSocketMessage = (msg: any) => {
    console.log("WebSocket message received:", msg.type);

    switch (msg.type) {
      case "ordersUpdate":
        // Directly update orders cache without a full refetch
        qc.setQueryData(['/api/orders'], msg.data);
        break;

      case "order_updated": {
        // Update the specific order in the cache
        const updatedOrder = msg.data;
        
        // Update order in all orders list
        qc.setQueryData(['/api/orders'], (oldOrders: any[] | undefined) => {
          if (!oldOrders) return oldOrders;
          return oldOrders.map(order => 
            order.id === updatedOrder.id ? { ...order, ...updatedOrder } : order
          );
        });
        
        // Also update the individual order data if it's in the cache
        qc.setQueryData(['/api/order', updatedOrder.id], (oldOrder: any) => {
          if (!oldOrder) return oldOrder;
          return { ...oldOrder, ...updatedOrder };
        });
        break;
      }

      case "bay_updated": {
        const { bay, status, orders } = msg.data;
        
        // Update bay in the bays list
        qc.setQueryData(['/api/bays'], (oldBays: any[] | undefined) => {
          if (!oldBays) return oldBays;
          return oldBays.map(b => (b.id === bay.id ? { ...b, status } : b));
        });
        
        // Update individual bay data if it's in the cache
        qc.setQueryData(['/api/bay', bay.number], (oldBay: any) => {
          if (!oldBay) return oldBay;
          return { ...oldBay, status };
        });
        
        // Update orders for this bay if provided
        if (orders && orders.length > 0) {
          qc.setQueryData(['/api/bay', bay.id, 'orders'], orders);
        }
        break;
      }

      case "item_cooking":
      case "item_plating":
      case "item_ready":
      case "item_delivered": {
        const { orderId, orderItem } = msg.data;
        
        // Update the specific order with the updated item
        qc.setQueryData(['/api/order', orderId], (oldOrder: any) => {
          if (!oldOrder || !oldOrder.items) return oldOrder;
          
          // Create a new items array with the updated item
          const updatedItems = oldOrder.items.map((item: any) => 
            item.id === orderItem.id ? { ...item, ...orderItem } : item
          );
          
          return { ...oldOrder, items: updatedItems };
        });
        break;
      }
    }
  };

  return { lastMessage, wsRef };
}
