import { useState, useEffect } from 'react';
import { useWebSocket } from './hooks/use-websocket';

function App() {
  const [bayId, setBayId] = useState<number | undefined>(undefined);
  const [orderStatus, setOrderStatus] = useState<string | null>(null);
  const { lastMessage, readyState } = useWebSocket(bayId);
  const [showReadyBanner, setShowReadyBanner] = useState(false);

  // Process WebSocket messages
  useEffect(() => {
    if (lastMessage?.type === 'orderStatusUpdate') {
      setOrderStatus(lastMessage.data.status);
      
      // If order status is now "ready", show the flashing banner
      if (lastMessage.data.status === 'ready') {
        setShowReadyBanner(true);
      } else {
        setShowReadyBanner(false);
      }
    }
  }, [lastMessage]);

  // Simulate scanning a QR code to set the bay ID
  const handleBaySelection = (id: number) => {
    setBayId(id);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {showReadyBanner && (
        <div className="ready-banner sticky top-0 w-full py-3 text-center text-lg font-bold z-50">
          Your order is ready for pickup!
        </div>
      )}
      
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold text-gray-900">SwingEats Customer App</h1>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {!bayId ? (
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Select a Bay</h2>
            <p className="mb-4 text-gray-600">
              Usually you would scan a QR code, but for this demo please select a bay:
            </p>
            
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: 15 }, (_, i) => i + 1).map(id => (
                <button
                  key={id}
                  onClick={() => handleBaySelection(id)}
                  className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded"
                >
                  Bay {id}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-2">Bay {bayId}</h2>
              <p className="text-gray-600">
                Connection status: {readyState === WebSocket.OPEN ? 'Connected' : 'Connecting...'}
              </p>
              {orderStatus && (
                <div className="mt-4">
                  <p className="font-medium">Order Status: <span className="font-bold">{orderStatus}</span></p>
                </div>
              )}
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">JSON Data View</h2>
              <pre className="bg-gray-100 p-4 rounded overflow-auto text-xs max-h-60">
                {JSON.stringify({ bayId, orderStatus, lastMessage }, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;