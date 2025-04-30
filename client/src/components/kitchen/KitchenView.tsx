import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWebSocket } from "@/hooks/use-websocket";
import { useToast } from "@/hooks/use-toast";
import OrderPriorityTabs from "./OrderPriorityTabs";
import SimpleKitchenOrderGrid from "./SimpleKitchenOrderGrid";
import { Skeleton } from "@/components/ui/skeleton";
import { OrderSummary } from "@shared/schema";
import { cn } from "@/lib/utils";

export default function KitchenView() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  // Initialize WebSocket connection for real-time updates
  useWebSocket(); // No need to destructure as we're using React Query for state
  const [activeTab, setActiveTab] = useState<string>("all");
  const [currentTime, setCurrentTime] = useState<string>("");
  
  // Get all active orders and filter client-side with more frequent refreshing
  const { data: orders, isLoading: ordersLoading } = useQuery<OrderSummary[]>({
    queryKey: ['/api/orders'],
    // Refresh every 15 seconds to ensure time elapsed is updated like server-side
    refetchInterval: 15000,
    // Don't refetch on window focus to avoid unnecessary API calls
    refetchOnWindowFocus: false,
  });
  
  // Update time every second for a smooth clock display
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      }));
    };
    
    updateTime();
    const interval = setInterval(updateTime, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  // WebSocket messages are now being handled by the useWebSocket hook directly
  // All relevant queryClient cache updates are done there
  // No need for additional effects here
  
  // Get only active orders (not served, closed, or cancelled)
  const activeOrders = orders?.filter(
    (o: OrderSummary) => !['SERVED', 'CLOSED', 'CANCELLED'].includes(o.status)
  ) || [];
  
  // Count orders by status
  const countByStatus = {
    // All active orders
    all: activeOrders.length || 0,
    // Orders that are NEW (not started yet)
    new: activeOrders.filter((o: OrderSummary) => o.status === 'NEW').length || 0,
    // Orders in COOKING status
    cooking: activeOrders.filter((o: OrderSummary) => o.status === 'COOKING').length || 0,
    // Orders in PLATING status
    plating: activeOrders.filter((o: OrderSummary) => o.status === 'PLATING').length || 0,
    // Orders that are READY to be served
    ready: activeOrders.filter((o: OrderSummary) => o.status === 'READY').length || 0,
    // Completed orders (SERVED)
    served: orders?.filter((o: OrderSummary) => o.status === 'SERVED').length || 0,
    // Closed orders
    closed: orders?.filter((o: OrderSummary) => o.status === 'CLOSED').length || 0,
    // Orders that are flagged as delayed (regardless of status)
    delayed: activeOrders.filter((o: OrderSummary) => o.isDelayed).length || 0,
  };
  
  // Filter orders based on active tab
  const filteredOrders = orders?.filter((order: OrderSummary) => {
    if (activeTab === 'all') return !['SERVED', 'CLOSED', 'CANCELLED'].includes(order.status);
    if (activeTab === 'served') return order.status === 'SERVED';
    if (activeTab === 'closed') return order.status === 'CLOSED';
    if (activeTab === 'delayed') return order.isDelayed && !['SERVED', 'CLOSED', 'CANCELLED'].includes(order.status);
    if (activeTab === 'new') return order.status === 'NEW';
    if (activeTab === 'cooking') return order.status === 'COOKING';
    if (activeTab === 'plating') return order.status === 'PLATING';
    if (activeTab === 'ready') return order.status === 'READY';
    // Default case - show all active orders
    return !['SERVED', 'CLOSED', 'CANCELLED'].includes(order.status);
  }) || [];
  
  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="bg-white shadow-md rounded-lg p-4 mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
          <div className="flex items-center mb-4 md:mb-0">
            <div className="bg-green-500 p-2 rounded-lg mr-3 hidden sm:block">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h1 className="font-poppins font-bold text-2xl text-primary leading-none mb-1">
                504 Creole Tavern
              </h1>
              {/* Status indicators removed as requested */}
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-3 w-full md:w-auto">
            <div className="flex items-center bg-blue-50 px-3 py-2 rounded-md text-blue-600 border border-blue-100 mr-auto md:mr-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-semibold">{currentTime}</span>
            </div>
            
            <button className="px-3 py-2 bg-white border border-gray-300 rounded-md flex items-center text-gray-700 hover:bg-gray-50 transition-colors shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              <span>Print</span>
            </button>
            
            <button className="px-3 py-2 bg-primary hover:bg-primary/90 text-white rounded-md flex items-center transition-colors shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span>Alert Servers</span>
            </button>
          </div>
        </div>
      </div>
      
      {/* Order Priority Tabs */}
      <OrderPriorityTabs 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        counts={{
          all: countByStatus.all,
          new: countByStatus.new,
          cooking: countByStatus.cooking,
          plating: countByStatus.plating,
          ready: countByStatus.ready,
          served: countByStatus.served,
          closed: countByStatus.closed,
          delayed: countByStatus.delayed
        }}
      />
      
      {/* Kitchen Order Grid */}
      {ordersLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array(3).fill(0).map((_, index) => (
            <Skeleton key={index} className="h-64" />
          ))}
        </div>
      ) : (
        <SimpleKitchenOrderGrid orders={filteredOrders} />
      )}
    </div>
  );
}
