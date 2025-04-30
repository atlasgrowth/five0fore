import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface WebSocketHook {
  lastMessage: any;
  sendMessage: (data: any) => void;
  readyState: number;
}

export const useWebSocket = (bayId?: number): WebSocketHook => {
  const [lastMessage, setLastMessage] = useState<any>(null);
  const [readyState, setReadyState] = useState<number>(WebSocket.CONNECTING);
  const socketRef = useRef<WebSocket | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    try {
      // Create WebSocket connection with a more robust approach
      let wsUrl;
      
      // For Replit deployment environments
      if (window.location.hostname.includes('replit')) {
        wsUrl = `wss://${window.location.host}/ws`;
      } 
      // For local development with explicit port
      else {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const host = window.location.host || "localhost:5000";
        wsUrl = `${protocol}//${host}/ws`;
      }
      
      console.log("Connecting to WebSocket at:", wsUrl);
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        console.log("WebSocket connection established");
        setReadyState(WebSocket.OPEN);
        
        // Register client type
        socket.send(JSON.stringify({
          type: 'register',
          data: { 
            clientType: "client",
            ...(bayId !== undefined && { bayId })
          }
        }));
        
        // Subscribe to specific bay if provided
        if (bayId) {
          socket.send(JSON.stringify({
            type: 'subscribeToBay',
            bayId
          }));
        }
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);

          // Handle different message types
          switch (data.type) {
            case 'ordersUpdate':
              queryClient.setQueryData(['/api/orders', 'all'], data.data);
              break;
              
            case 'order_updated':
              queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
              break;
              
            // Handle bay status updates to ensure live color updates
            case 'bay_updated':
              console.log('Bay updated WebSocket message received:', data.data);
              // Make sure we're getting the bay data in the right format
              if (data.data && data.data.bay) {
                queryClient.setQueryData(['/api/bays'], (old: any[] | undefined) => {
                  if (!old) return old;
                  console.log('Updating bay in cache:', data.data.bay.id, 'with status:', data.data.bay.status);
                  return old.map(b => b.id === data.data.bay.id ? data.data.bay : b);
                });
                // Also invalidate orders queries to ensure they refresh
                queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
              } else {
                console.error('Malformed bay_updated message:', data);
              }
              break;
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      socket.onclose = () => {
        console.log("WebSocket connection closed");
        setReadyState(WebSocket.CLOSED);
      };
      
      socket.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      return () => {
        socket.close();
      };
    } catch (error) {
      console.error("Failed to establish WebSocket connection:", error);
      return () => {};
    }
  }, [bayId, queryClient]);

  const sendMessage = useCallback((data: any) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(data));
    } else {
      console.error("WebSocket is not connected");
    }
  }, []);

  return { lastMessage, sendMessage, readyState };
};

export default useWebSocket;
