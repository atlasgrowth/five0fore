import { useState, useEffect, useRef, useCallback } from 'react';
import { WebSocketMessage } from '@swingeats/shared';

interface WebSocketHook {
  lastMessage: WebSocketMessage | null;
  sendMessage: (data: any) => void;
  readyState: number;
}

export const useWebSocket = (): WebSocketHook => {
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [readyState, setReadyState] = useState<number>(WebSocket.CONNECTING);
  const socketRef = useRef<WebSocket | null>(null);
  
  useEffect(() => {
    // Setup WebSocket connection - using the same origin approach
    const base = window.location.origin.replace(/^http/, "ws") + "/ws?client=kitchen-app";
    console.log('Connecting to WebSocket at:', base);
    
    try {
      const socket = new WebSocket(base);
      socketRef.current = socket;
      
      socket.onopen = () => {
        console.log('WebSocket connection established');
        setReadyState(WebSocket.OPEN);
        
        // Register as kitchen client
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ 
            type: "register", 
            data: { clientType: "kitchen" } 
          }));
        }
      };
      
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          setLastMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
      socket.onclose = () => {
        console.log('WebSocket connection closed');
        setReadyState(WebSocket.CLOSED);
      };
      
      socket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      
      // Cleanup on unmount
      return () => {
        socket.close();
      };
    } catch (error) {
      console.error('Failed to establish WebSocket connection:', error);
      setReadyState(WebSocket.CLOSED);
      return () => {};
    }
  }, []);
  
  const sendMessage = useCallback((data: any) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(data));
    } else {
      console.error('WebSocket is not connected');
    }
  }, []);
  
  return { lastMessage, sendMessage, readyState };
};