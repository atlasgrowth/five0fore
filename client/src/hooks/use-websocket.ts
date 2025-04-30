import { useState, useEffect, useCallback, useRef } from 'react';

interface WebSocketHook {
  lastMessage: any;
  sendMessage: (data: any) => void;
  readyState: number;
}

export const useWebSocket = (bayId?: number): WebSocketHook => {
  const [lastMessage, setLastMessage] = useState<any>(null);
  const [readyState, setReadyState] = useState<number>(WebSocket.CONNECTING);
  const socketRef = useRef<WebSocket | null>(null);

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
  }, [bayId]);

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
