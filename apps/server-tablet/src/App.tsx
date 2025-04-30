import { useState, useEffect } from 'react';
import { useWebSocket } from './hooks/use-websocket';
import { OrderSummary } from '@swingeats/shared';

function App() {
  const { lastMessage, sendMessage, readyState } = useWebSocket();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [bays, setBays] = useState<any[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<string>('Connecting...');

  // WebSocket connection status
  useEffect(() => {
    switch (readyState) {
      case WebSocket.CONNECTING:
        setConnectionStatus('Connecting...');
        break;
      case WebSocket.OPEN:
        setConnectionStatus('Connected');
        break;
      case WebSocket.CLOSING:
        setConnectionStatus('Closing...');
        break;
      case WebSocket.CLOSED:
        setConnectionStatus('Disconnected');
        break;
      default:
        setConnectionStatus('Unknown');
    }
  }, [readyState]);

  // Process WebSocket messages
  useEffect(() => {
    if (lastMessage?.type === 'orders_update') {
      setOrders(lastMessage.data.orders);
    } else if (lastMessage?.type === 'bay_status_update') {
      // Update the specific bay status
      setBays(prev => {
        return prev.map(bay => 
          bay.id === lastMessage.data.bay.id 
            ? { ...bay, status: lastMessage.data.bay.status } 
            : bay
        );
      });
    }
  }, [lastMessage]);

  // Initial data fetch on mount
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // Fetch bays
        const baysResponse = await fetch('/api/bays');
        if (baysResponse.ok) {
          const baysData = await baysResponse.json();
          setBays(baysData);
        }
        
        // Fetch active orders
        const ordersResponse = await fetch('/api/orders');
        if (ordersResponse.ok) {
          const ordersData = await ordersResponse.json();
          setOrders(ordersData);
        }
      } catch (error) {
        console.error('Error fetching initial data:', error);
      }
    };

    fetchInitialData();
  }, []);

  // Function to update order status
  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      await fetch(`/api/order/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });
      
      // The WebSocket will update our state
    } catch (error) {
      console.error('Error updating order status:', error);
    }
  };

  return (
    <div className="min-h-screen bg-white p-4">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">SwingEats Server Tablet</h1>
        <div className={`px-3 py-1 rounded-full text-sm text-white ${readyState === WebSocket.OPEN ? 'bg-green-600' : 'bg-red-600'}`}>
          {connectionStatus}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6">
        <div className="bg-gray-100 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Active Orders</h2>
          
          {orders.length === 0 ? (
            <div className="text-center p-12 bg-white rounded-lg shadow">
              <p className="text-lg text-gray-600">No active orders at this time</p>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map(order => (
                <div key={order.id} className="bg-white p-4 rounded-lg shadow">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-medium">Bay {order.bayNumber}</h3>
                    <span className="text-sm text-gray-600">Floor {order.floor}</span>
                  </div>
                  
                  <div className="flex justify-between items-center mb-4">
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                      ID: {order.id.substring(0, 8)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {Math.floor(order.timeElapsed)} min ago
                    </span>
                  </div>
                  
                  {order.estimatedCompletionTime && (
                    <div className="mb-4 text-orange-600 text-sm">
                      Est. ready: {new Date(order.estimatedCompletionTime).toLocaleTimeString()}
                    </div>
                  )}
                  
                  <div className="text-sm text-gray-700 mb-2">
                    Order JSON:
                  </div>
                  
                  <pre className="bg-gray-50 p-3 rounded overflow-auto text-xs max-h-40 text-gray-800">
                    {JSON.stringify(order, null, 2)}
                  </pre>
                  
                  <div className="mt-4 flex space-x-2">
                    <button
                      onClick={() => updateOrderStatus(order.id, 'ready')}
                      className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
                    >
                      Mark Ready
                    </button>
                    <button
                      onClick={() => updateOrderStatus(order.id, 'served')}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
                    >
                      Mark Served
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;