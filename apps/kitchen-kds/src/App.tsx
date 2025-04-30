import { useState, useEffect } from 'react';
import { useWebSocket } from './hooks/use-websocket';
import { 
  OrderSummary, 
  getOrderDisplayNumber, 
  isOrderDelayed, 
  getMinutesRemaining, 
  formatMinutes 
} from '@swingeats/shared';

// Order status colors
const STATUS_COLORS = {
  NEW: 'bg-blue-500',
  PENDING: 'bg-blue-500',
  COOKING: 'bg-yellow-500',
  PREPARING: 'bg-yellow-500',
  READY: 'bg-green-500',
  SERVED: 'bg-gray-500',
  CANCELLED: 'bg-red-500',
};

// Component for a single order ticket
const OrderTicket = ({ 
  order, 
  onUpdateOrderStatus 
}: { 
  order: OrderSummary, 
  onUpdateOrderStatus: (id: string, status: string) => Promise<void> 
}) => {
  // Calculate time remaining and status
  const minutesRemaining = getMinutesRemaining(order.estimatedCompletionTime);
  const timeDisplay = formatMinutes(minutesRemaining);
  const isDelayed = isOrderDelayed(order.estimatedCompletionTime);
  
  // Generate short display number
  const displayNumber = getOrderDisplayNumber(order.id);

  return (
    <div 
      className={`bg-gray-800 border-l-4 p-4 rounded-lg ${
        isDelayed 
          ? 'border-red-500 animate-pulse' 
          : order.status === 'READY' 
            ? 'border-green-500' 
            : 'border-yellow-500'
      }`}
    >
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center">
          <span className="text-2xl font-bold mr-2">#{displayNumber}</span>
          <span className={`${STATUS_COLORS[order.status.toUpperCase()]} px-2 py-1 rounded text-xs uppercase`}>
            {order.status}
          </span>
        </div>
        <span className="text-sm">Bay {order.bayNumber} (F{order.floor})</span>
      </div>
      
      <div className="flex justify-between items-center mb-3">
        <span className="text-xs text-gray-400">
          {new Date(order.createdAt).toLocaleTimeString()}
        </span>
        <span className={`text-xs font-medium ${isDelayed ? 'text-red-400' : 'text-green-400'}`}>
          {timeDisplay}
        </span>
      </div>

      <div className="mb-2 flex justify-between items-center">
        <span className="text-sm font-medium">Items: {order.totalItems}</span>
        <div className="space-x-2">
          {order.status === 'COOKING' && (
            <button 
              onClick={() => onUpdateOrderStatus(order.id, 'ready')}
              className="bg-green-600 hover:bg-green-700 px-3 py-1 rounded text-xs"
            >
              Mark Ready
            </button>
          )}
          {order.status === 'NEW' && (
            <button 
              onClick={() => onUpdateOrderStatus(order.id, 'cooking')}
              className="bg-yellow-600 hover:bg-yellow-700 px-3 py-1 rounded text-xs"
            >
              Start Cooking
            </button>
          )}
        </div>
      </div>
      
      {order.estimatedCompletionTime && (
        <div className={`text-xs ${isDelayed ? 'text-red-400' : 'text-yellow-400'}`}>
          {isDelayed 
            ? `DELAYED - Due: ${new Date(order.estimatedCompletionTime).toLocaleTimeString()}`
            : `Ready by: ${new Date(order.estimatedCompletionTime).toLocaleTimeString()}`
          }
        </div>
      )}
    </div>
  );
};

function App() {
  const { lastMessage, sendMessage, readyState } = useWebSocket();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<string>('Connecting...');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Register as kitchen client when connection is established
  useEffect(() => {
    if (readyState === WebSocket.OPEN) {
      // Register as kitchen client
      sendMessage({ 
        type: "register", 
        data: { clientType: "kitchen" } 
      });
    }
  }, [readyState, sendMessage]);

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
    if (lastMessage?.type === 'ordersUpdate' || lastMessage?.type === 'orders_update') {
      // Sort orders by priority:
      // 1. Delayed orders first (most delayed at top)
      // 2. Then by estimated completion time
      const sortedOrders = [...lastMessage.data.orders || lastMessage.data];
      sortedOrders.sort((a, b) => {
        // Delayed orders first
        const aDelayed = isOrderDelayed(a.estimatedCompletionTime);
        const bDelayed = isOrderDelayed(b.estimatedCompletionTime);
        
        if (aDelayed && !bDelayed) return -1;
        if (!aDelayed && bDelayed) return 1;
        
        if (aDelayed && bDelayed) {
          // Both delayed - most delayed first
          const aMinutes = getMinutesRemaining(a.estimatedCompletionTime);
          const bMinutes = getMinutesRemaining(b.estimatedCompletionTime);
          return aMinutes - bMinutes; // More negative = more delayed
        }
        
        // Then by estimated completion time
        if (a.estimatedCompletionTime && b.estimatedCompletionTime) {
          return new Date(a.estimatedCompletionTime).getTime() - new Date(b.estimatedCompletionTime).getTime();
        }
        
        // Fallback to creation time
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
      
      setOrders(sortedOrders);
    }
  }, [lastMessage]);

  // Initial data fetch on mount
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const response = await fetch('/api/orders');
        if (response.ok) {
          const data = await response.json();
          
          // Sort orders as above
          const sortedOrders = [...data];
          sortedOrders.sort((a, b) => {
            const aDelayed = isOrderDelayed(a.estimatedCompletionTime);
            const bDelayed = isOrderDelayed(b.estimatedCompletionTime);
            
            if (aDelayed && !bDelayed) return -1;
            if (!aDelayed && bDelayed) return 1;
            
            if (a.estimatedCompletionTime && b.estimatedCompletionTime) {
              return new Date(a.estimatedCompletionTime).getTime() - new Date(b.estimatedCompletionTime).getTime();
            }
            
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          });
          
          setOrders(sortedOrders);
        }
      } catch (error) {
        console.error('Error fetching orders:', error);
      }
    };

    fetchOrders();
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
      
      // No need to update local state as WebSocket will push updates
    } catch (error) {
      console.error('Error updating order status:', error);
    }
  };

  // Filter orders based on status
  const filteredOrders = filterStatus === 'all' 
    ? orders
    : orders.filter(order => order.status.toLowerCase() === filterStatus);

  // Group orders by status for visual organization
  const ordersByStatus = {
    new: filteredOrders.filter(o => o.status.toLowerCase() === 'new' || o.status.toLowerCase() === 'pending'),
    cooking: filteredOrders.filter(o => o.status.toLowerCase() === 'cooking' || o.status.toLowerCase() === 'preparing'),
    ready: filteredOrders.filter(o => o.status.toLowerCase() === 'ready'),
  };

  // Count delayed orders
  const delayedCount = orders.filter(o => isOrderDelayed(o.estimatedCompletionTime)).length;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <header className="flex justify-between items-center mb-6 bg-gray-800 p-4 rounded-lg">
        <div className="flex items-center">
          <h1 className="text-3xl font-bold text-green-500">
            Five O Four Golf Kitchen Display
          </h1>
          {delayedCount > 0 && (
            <div className="ml-4 bg-red-600 px-3 py-1 rounded-full text-sm animate-pulse">
              {delayedCount} Delayed
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <select 
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-gray-700 text-white rounded px-2 py-1 text-sm"
            >
              <option value="all">All Orders</option>
              <option value="new">New</option>
              <option value="cooking">Cooking</option>
              <option value="ready">Ready</option>
            </select>
          </div>
          
          <div className={`px-3 py-1 rounded-full text-xs ${readyState === WebSocket.OPEN ? 'bg-green-600' : 'bg-red-600'}`}>
            {connectionStatus}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* NEW ORDERS COLUMN */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center">
            <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
            New Orders ({ordersByStatus.new.length})
          </h2>
          
          {ordersByStatus.new.length === 0 ? (
            <div className="bg-gray-800 p-4 rounded-lg text-center text-gray-400">
              No new orders
            </div>
          ) : (
            ordersByStatus.new.map((order) => (
              <OrderTicket 
                key={order.id} 
                order={order} 
                onUpdateOrderStatus={updateOrderStatus} 
              />
            ))
          )}
        </div>
        
        {/* COOKING ORDERS COLUMN */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center">
            <div className="w-3 h-3 rounded-full bg-yellow-500 mr-2"></div>
            Cooking ({ordersByStatus.cooking.length})
          </h2>
          
          {ordersByStatus.cooking.length === 0 ? (
            <div className="bg-gray-800 p-4 rounded-lg text-center text-gray-400">
              No orders being prepared
            </div>
          ) : (
            ordersByStatus.cooking.map((order) => (
              <OrderTicket 
                key={order.id} 
                order={order} 
                onUpdateOrderStatus={updateOrderStatus} 
              />
            ))
          )}
        </div>
        
        {/* READY ORDERS COLUMN */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center">
            <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
            Ready for Pickup ({ordersByStatus.ready.length})
          </h2>
          
          {ordersByStatus.ready.length === 0 ? (
            <div className="bg-gray-800 p-4 rounded-lg text-center text-gray-400">
              No orders ready for pickup
            </div>
          ) : (
            ordersByStatus.ready.map((order) => (
              <OrderTicket 
                key={order.id} 
                order={order} 
                onUpdateOrderStatus={updateOrderStatus} 
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default App;