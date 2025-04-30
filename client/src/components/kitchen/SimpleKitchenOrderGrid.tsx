import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { OrderSummary, OrderWithItems, OrderItemStatus, OrderStatus } from "@shared/schema";

// Advanced timer to show when to start cooking an item based on currently cooking items
function StartTimer({ 
  orderCreatedAt, 
  cookSeconds, 
  longestCookItem,
  orderItems 
}: { 
  orderCreatedAt: string, 
  cookSeconds: number, 
  longestCookItem: boolean,
  orderItems?: any[]
}) {
  const [timeToStart, setTimeToStart] = useState<number | null>(null);
  const [isTimeToStart, setIsTimeToStart] = useState<boolean>(false);
  const [timerActive, setTimerActive] = useState<boolean>(false);
  
  // If this is the longest cook item, it should start immediately
  if (longestCookItem) {
    return (
      <div className="flex items-center ml-2">
        <button 
          className="p-1 text-xs bg-red-100 hover:bg-red-200 text-red-800 rounded flex items-center font-bold"
          title="Start cooking now"
          onClick={(e) => {
            e.stopPropagation();
            const checkbox = e.currentTarget.closest('div[data-item-id]')?.querySelector('input[type="checkbox"]') as HTMLInputElement;
            if (checkbox) {
              checkbox.click();
            }
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
          </svg>
          START NOW
        </button>
      </div>
    );
  }
  
  useEffect(() => {
    // Find all currently cooking items in the order
    if (!orderItems) return;
    
    const cookingItems = orderItems.filter(item => 
      item.status === OrderItemStatus.COOKING && item.firedAt
    );
    
    if (cookingItems.length === 0) {
      // If nothing is cooking, we should cook the longest item first
      setIsTimeToStart(longestCookItem);
      setTimeToStart(null);
      setTimerActive(false);
      return;
    }
    
    // If there are cooking items, find when each will be done
    const updateTimer = () => {
      const now = new Date().getTime();
      const itemFinishTimes: number[] = [];
      
      // Calculate when each cooking item will be done
      cookingItems.forEach(item => {
        const startTime = new Date(item.firedAt).getTime();
        const itemCookSeconds = item.cookSeconds || item.menuItem?.prep_seconds || 300;
        const finishTimeMs = startTime + (itemCookSeconds * 1000);
        
        // How many milliseconds until this item is done
        itemFinishTimes.push(finishTimeMs);
      });
      
      // Find the earliest cooking item to finish
      const earliestFinishTime = Math.min(...itemFinishTimes);
      
      // When to start this item = (earliest finish time - this item's cook time)
      const whenToStartMs = earliestFinishTime - (cookSeconds * 1000);
      
      // If it's already time to start (now >= when to start)
      if (now >= whenToStartMs) {
        setIsTimeToStart(true);
        setTimeToStart(0);
      } else {
        // Calculate seconds remaining until it's time to start
        const remainingMs = whenToStartMs - now;
        const remainingSeconds = Math.ceil(remainingMs / 1000);
        setTimeToStart(remainingSeconds);
        setIsTimeToStart(false);
      }
      
      setTimerActive(true);
    };
    
    updateTimer();
    const timerId = setInterval(updateTimer, 1000);
    
    return () => clearInterval(timerId);
  }, [orderItems, longestCookItem, cookSeconds]);
  
  // Format time in minutes and seconds (MM:SS)
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  if (isTimeToStart) {
    return (
      <div className="flex items-center ml-2">
        <button 
          className="p-1 text-xs bg-red-100 hover:bg-red-200 text-red-800 rounded flex items-center font-bold"
          title="Start cooking now"
          onClick={(e) => {
            e.stopPropagation();
            const checkbox = e.currentTarget.closest('div[data-item-id]')?.querySelector('input[type="checkbox"]') as HTMLInputElement;
            if (checkbox) {
              checkbox.click();
            }
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
          </svg>
          START NOW
        </button>
      </div>
    );
  }
  
  if (!timerActive) {
    // Simple wait message when there's not enough information yet
    return (
      <div className="flex items-center ml-2">
        <div className="p-1 text-xs bg-orange-100 text-orange-700 rounded flex items-center font-bold animate-pulse">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          WAIT TO START
        </div>
      </div>
    );
  }
  
  // Choose color based on time left
  const getBgColor = () => {
    if (!timeToStart) return "bg-orange-100 text-orange-700";
    if (timeToStart < 60) return "bg-red-100 text-red-700 animate-pulse"; // less than 1 minute, make it pulsing red
    if (timeToStart < 300) return "bg-amber-100 text-amber-700"; // less than 5 minutes
    return "bg-gray-100 text-gray-700"; // more than 5 minutes
  };
  
  return (
    <div className="flex items-center ml-2">
      <div className={`p-1 text-xs rounded flex items-center font-bold ${getBgColor()}`}>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        START IN {timeToStart !== null ? formatTime(timeToStart) : '--:--'}
      </div>
    </div>
  );
}

// Simple cooking timer component
function CookingTimer({ firedAt, cookSeconds }: { firedAt: string, cookSeconds: number }) {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [percentage, setPercentage] = useState<number>(0);
  
  useEffect(() => {
    const calculateTimeLeft = () => {
      const startTime = new Date(firedAt).getTime();
      const currentTime = new Date().getTime();
      const elapsedSeconds = Math.floor((currentTime - startTime) / 1000);
      const remaining = Math.max(0, cookSeconds - elapsedSeconds);
      
      // Calculate percentage complete
      const percentComplete = Math.min(100, Math.floor((elapsedSeconds / cookSeconds) * 100));
      
      setTimeLeft(remaining);
      setPercentage(percentComplete);
    };
    
    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    
    return () => clearInterval(timer);
  }, [firedAt, cookSeconds]);
  
  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Determine color and animation based on progress
  const getStyle = () => {
    if (percentage >= 100) return "text-white bg-red-600 animate-pulse";
    if (percentage >= 90) return "text-white bg-amber-600";
    if (percentage >= 75) return "text-amber-900 bg-amber-100";
    return "text-green-900 bg-green-100";
  };
  
  return (
    <div className="ml-2 flex items-center">
      <div className="relative w-16 h-5 bg-gray-200 rounded-full overflow-hidden shadow-inner">
        <div 
          className={`absolute left-0 top-0 h-full ${percentage >= 90 ? 'bg-red-500' : percentage >= 75 ? 'bg-amber-500' : 'bg-green-500'}`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
      <span className={`ml-1 px-1.5 py-0.5 text-xs font-bold rounded ${getStyle()}`}>
        {formatTime(timeLeft)}
      </span>
      <span className="ml-1 text-xs font-bold text-gray-700">
        COOKING
      </span>
    </div>
  );
}

interface KitchenOrderGridProps {
  orders: OrderSummary[];
}

export default function KitchenOrderGrid({ orders }: KitchenOrderGridProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Refresh order data every 15 seconds
  useEffect(() => {
    const dataRefreshInterval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      orders.forEach(order => {
        queryClient.invalidateQueries({ queryKey: ['/api/order', order.id] });
      });
    }, 15000);
    
    return () => clearInterval(dataRefreshInterval);
  }, [orders, queryClient]);
  
  // Toggle item status
  const toggleItemCompletion = async (orderItemId: string, completed: boolean, currentStatus?: string | null) => {
    try {
      let endpoint;
      
      if (completed) {
        if (currentStatus === OrderItemStatus.COOKING) {
          endpoint = "/plating";
        } else if (currentStatus === OrderItemStatus.PLATING) {
          endpoint = "/ready";
        } else if (currentStatus === OrderItemStatus.READY) {
          endpoint = "/deliver";
        } else {
          endpoint = "/fire";
        }
      } else {
        if (currentStatus === OrderItemStatus.PLATING) {
          endpoint = "/fire";
        } else if (currentStatus === OrderItemStatus.READY) {
          endpoint = "/plating";
        } else if (currentStatus === OrderItemStatus.DELIVERED) {
          endpoint = "/ready";
        } else {
          endpoint = "/fire";
        }
      }
      
      await apiRequest("POST", `/api/order-items/${orderItemId}${endpoint}`);
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/order'] });
      
      toast({
        title: "Item Updated",
        description: "Order item status has been updated.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update item status.",
        variant: "destructive",
      });
    }
  };
  
  // Mark order as ready
  const markOrderAsReady = async (orderId: string) => {
    try {
      await apiRequest("POST", `/api/order/${orderId}/ready`);
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/order'] });
      
      toast({
        title: "Order Ready",
        description: "Order has been marked as ready to serve.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update order status.",
        variant: "destructive",
      });
    }
  };
  
  // Close order
  const closeOrder = async (orderId: string) => {
    try {
      await apiRequest("POST", `/api/order/${orderId}/close`);
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/order'] });
      
      toast({
        title: "Order Closed",
        description: "The order has been closed.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to close the order.",
        variant: "destructive",
      });
    }
  };
  
  return (
    <div className="relative">
      {/* Left/Right scroll buttons */}
      <button 
        className="absolute left-0 top-1/2 transform -translate-y-1/2 z-10 bg-white rounded-full p-2 shadow-md"
        onClick={() => {
          const container = document.getElementById('orders-scroll-container');
          if (container) container.scrollBy({ left: -300, behavior: 'smooth' });
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <button 
        className="absolute right-0 top-1/2 transform -translate-y-1/2 z-10 bg-white rounded-full p-2 shadow-md"
        onClick={() => {
          const container = document.getElementById('orders-scroll-container');
          if (container) container.scrollBy({ left: 300, behavior: 'smooth' });
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
      
      <div 
        id="orders-scroll-container"
        className="flex overflow-x-auto pb-4 pt-2 px-10 gap-4 snap-x scrollbar-thin"
        style={{ scrollbarWidth: 'thin' }}
      >
        {orders.length === 0 ? (
          <div className="flex-shrink-0 min-w-full p-8 text-center text-neutral-500 bg-white rounded-md shadow-md">
            No orders in this category
          </div>
        ) : (
          // Sort orders by status in workflow order: NEW -> COOKING -> PLATING -> READY
          [...orders].sort((a, b) => {
            // Status priority: NEW -> COOKING -> PLATING -> READY -> SERVED -> CLOSED -> CANCELLED
            const statusPriority: Record<string, number> = {
              [OrderStatus.NEW]: 0,
              [OrderStatus.COOKING]: 1,
              [OrderStatus.PLATING]: 2,
              [OrderStatus.READY]: 3,
              [OrderStatus.SERVED]: 4,
              [OrderStatus.CLOSED]: 5,
              [OrderStatus.CANCELLED]: 6
            };
            
            // First sort by status (workflow order)
            const aPriority = statusPriority[a.status] || 999;
            const bPriority = statusPriority[b.status] || 999;
            
            if (aPriority !== bPriority) {
              return aPriority - bPriority;
            }
            
            // If same status, sort by creation time (oldest first) to prevent jumping
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          }).map((order) => (
            <div key={order.id} className="flex-shrink-0 min-w-[350px] max-w-[400px] snap-start">
              <OrderCard
                key={order.id}
                order={order}
                toggleItemCompletion={toggleItemCompletion}
                markOrderAsReady={markOrderAsReady}
                closeOrder={closeOrder}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Separate component for each order card
function OrderCard({ 
  order, 
  toggleItemCompletion,
  markOrderAsReady,
  closeOrder
}: { 
  order: OrderSummary;
  toggleItemCompletion: (orderItemId: string, completed: boolean, currentStatus?: string | null) => Promise<void>;
  markOrderAsReady: (orderId: string) => Promise<void>;
  closeOrder: (orderId: string) => Promise<void>;
}) {
  // Fetch order details
  const { data: orderDetails, isLoading } = useQuery<OrderWithItems | null>({
    queryKey: ["/api/order", order.id],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", `/api/order/${order.id}`);
        const data = await response.json();
        return data as OrderWithItems;
      } catch (error) {
        console.error(`Error fetching order details for ${order.id}:`, error);
        return null;
      }
    },
    staleTime: 10_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
  
  // Get border color based on status
  const getBorderColor = () => {
    if (order.status === OrderStatus.READY) return "border-green-400";
    if (order.status === OrderStatus.PLATING) return "border-purple-400";
    if (order.status === OrderStatus.COOKING) return "border-yellow-400";
    if (order.status === OrderStatus.NEW) return "border-blue-400";
    if (order.status === OrderStatus.SERVED) return "border-blue-200";
    if (order.status === OrderStatus.CLOSED) return "border-gray-300";
    if (order.status === OrderStatus.CANCELLED) return "border-red-300";
    return "border-gray-200";
  };
  
  // Calculate time difference for display
  const getTimeDifference = () => {
    if (!order.estimatedCompletionTime) return null;
    
    const currentTime = new Date();
    const estimatedTime = new Date(order.estimatedCompletionTime);
    const diffMs = estimatedTime.getTime() - currentTime.getTime();
    return Math.round(diffMs / 60000); // Minutes difference
  };
  
  const diffMinutes = getTimeDifference();
  
  return (
    <div 
      className={cn(
        "rounded-md shadow-md bg-white border",
        getBorderColor()
      )}
    >
      <div className="p-4">
        {/* TOP ROW: Status on left, Bay number in center, Order number on right */}
        <div className="flex justify-between items-center mb-3 border-b pb-2">
          {/* Left: Status */}
          <div>
            <span className={cn(
              "text-sm font-medium uppercase tracking-wider px-2 py-1 rounded",
              order.status === OrderStatus.READY ? "text-green-700 bg-green-50 border border-green-200" : 
              order.status === OrderStatus.PLATING ? "text-purple-700 bg-purple-50 border border-purple-200" :
              order.status === OrderStatus.COOKING ? "text-yellow-700 bg-yellow-50 border border-yellow-200" :
              order.status === OrderStatus.SERVED ? "text-blue-700 bg-blue-50 border border-blue-200" :
              order.status === OrderStatus.CLOSED ? "text-gray-700 bg-gray-100 border border-gray-200" :
              order.status === OrderStatus.CANCELLED ? "text-red-700 bg-red-50 border border-red-200" :
              "text-blue-700 bg-blue-50 border border-blue-200"
            )}>
              {order.status}
            </span>
          </div>
          
          {/* Middle: Bay information */}
          <div className="text-center">
            <h3 className="font-bold text-lg">Bay {order.bayNumber}</h3>
          </div>
          
          {/* Right: Order number */}
          <div className="text-right">
            <span className="text-sm font-medium text-neutral-600 bg-neutral-100 px-2 py-1 rounded-md">
              #{order.orderNumber}
            </span>
          </div>
        </div>
        
        {/* ITEMS SECTION */}
        <div className="mb-4">
          {isLoading ? (
            <div className="p-2 flex items-center justify-center">
              <svg className="animate-spin h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          ) : orderDetails?.items && orderDetails.items.length > 0 ? (
            [...orderDetails.items]
              // Sort by prep/cook time (longest first), then by status
              .sort((a, b) => {
                // Helper function to get cook seconds
                const getCookSeconds = (item: any) => item.cookSeconds || item.menuItem?.prep_seconds || 0;
                
                // Get cook times for both items
                const aCookTime = getCookSeconds(a);
                const bCookTime = getCookSeconds(b);
                
                // First, always put the longest cook time items at the top, regardless of status
                // This is the most important sorting rule
                if (aCookTime !== bCookTime) {
                  return bCookTime - aCookTime; // Descending order (longest first)
                }
                
                // If cook times are the same, then sort by status
                const statusPriority: Record<string, number> = { 
                  [OrderItemStatus.NEW]: 0, 
                  [OrderItemStatus.COOKING]: 1, 
                  [OrderItemStatus.PLATING]: 2, 
                  [OrderItemStatus.READY]: 3, 
                  [OrderItemStatus.DELIVERED]: 4 
                };
                const aStatus = a.status || "PENDING";
                const bStatus = b.status || "PENDING";
                
                return (statusPriority[aStatus] || 0) - (statusPriority[bStatus] || 0);
              })
              .map((item) => (
                <div 
                  key={item.id}
                  data-item-id={item.id}
                  className={cn(
                    "flex justify-between p-2 mb-2 border-b",
                    item.status === OrderItemStatus.COOKING && "border-l-2 border-l-yellow-500",
                    item.status === OrderItemStatus.PLATING && "border-l-2 border-l-purple-500",
                    item.status === OrderItemStatus.READY && "border-l-2 border-l-green-500",
                    item.status === OrderItemStatus.DELIVERED && "border-l-2 border-l-blue-500"
                  )}
                >
                  <div className="flex items-center">
                    <Checkbox 
                      className="h-4 w-4 rounded mr-2 border border-neutral-300"
                      checked={
                        item.status === OrderItemStatus.COOKING || 
                        item.status === OrderItemStatus.PLATING || 
                        item.status === OrderItemStatus.READY || 
                        item.status === OrderItemStatus.DELIVERED
                      }
                      onCheckedChange={(checked) => 
                        toggleItemCompletion(item.id, checked === true, item.status)
                      }
                    />
                    <div className="flex flex-col">
                      <div className="flex items-center">
                        <div className="flex items-center">
                          <span className="text-sm font-medium">{item.quantity}x {item.menuItem?.name}</span>
                          <span className="ml-1 text-xs text-gray-500">
                            ({Math.round((item.cookSeconds || item.menuItem?.prep_seconds || 0) / 60)}m)
                          </span>
                        </div>
                        
                        {/* Cooking items with timers and action buttons */}
                        {item.status === OrderItemStatus.COOKING && (
                          <div className="ml-2 flex items-center">
                            <CookingTimer 
                              firedAt={item.firedAt ? item.firedAt.toString() : new Date().toISOString()} 
                              cookSeconds={item.cookSeconds || item.menuItem?.prep_seconds || 300}
                            />
                            <button 
                              onClick={() => toggleItemCompletion(item.id, true, item.status)}
                              className="ml-2 p-1 text-xs bg-purple-100 hover:bg-purple-200 text-purple-800 rounded-full flex items-center"
                              title="Move to plating"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </div>
                        )}
                        
                        {item.status === OrderItemStatus.PLATING && (
                          <div className="ml-2 flex items-center">
                            <span className="text-xs font-medium bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                              Plating
                            </span>
                            <button 
                              onClick={() => toggleItemCompletion(item.id, true, item.status)}
                              className="ml-2 p-1 text-xs bg-green-100 hover:bg-green-200 text-green-800 rounded-full flex items-center"
                              title="Mark as ready"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </div>
                        )}
                        
                        {item.status === OrderItemStatus.READY && (
                          <div className="ml-2 flex items-center">
                            <span className="text-xs font-medium bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                              Ready
                            </span>
                            <button 
                              onClick={() => toggleItemCompletion(item.id, true, item.status)}
                              className="ml-2 p-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-full flex items-center"
                              title="Mark as delivered"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </div>
                        )}
                        
                        {item.status === OrderItemStatus.DELIVERED && (
                          <span className="ml-2 text-xs font-medium bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                            Delivered
                          </span>
                        )}
                        
                        {/* Every single item should have a timer */}
                        {item.menuItem?.prep_seconds && (
                          item.status === OrderItemStatus.COOKING ? (
                            // If currently cooking, show the cooking timer
                            <CookingTimer 
                              firedAt={item.firedAt || new Date().toISOString()} 
                              cookSeconds={item.cookSeconds || item.menuItem?.prep_seconds || 300}
                            />
                          ) : !item.status ? (
                            // If not yet started, show when to start
                            <StartTimer 
                              orderCreatedAt={order.createdAt}
                              cookSeconds={item.menuItem.prep_seconds}
                              longestCookItem={
                                orderDetails?.items?.reduce((longest, curr) => {
                                  const currCookTime = curr.cookSeconds || curr.menuItem?.prep_seconds || 0;
                                  const longestCookTime = longest.cookSeconds || longest.menuItem?.prep_seconds || 0;
                                  return currCookTime > longestCookTime ? curr : longest;
                                }, item) === item
                              }
                              orderItems={orderDetails.items}
                            />
                          ) : (
                            // For items in other states, still show a simple timer
                            <div className="ml-2 flex items-center">
                              <div className="p-1 text-xs bg-gray-100 text-gray-700 rounded flex items-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {item.status}
                              </div>
                            </div>
                          )
                        )}
                      </div>
                      
                      {/* Customizations display */}
                      {item.customizations && item.customizations.length > 0 && (
                        <div className="mt-0.5 text-xs text-neutral-500">
                          {item.customizations.map((customization, idx) => (
                            <div key={idx}>
                              <span className="font-medium">{customization.categoryName}: </span>
                              {customization.options.map(opt => opt.name).join(', ')}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
          ) : (
            <div className="p-2 text-neutral-500 text-sm text-center">
              No items in this order
            </div>
          )}
        </div>
        
        {/* BOTTOM ROW: Placed time and Estimated Completion + Time status */}
        <div className="flex justify-between items-center text-sm pt-1 border-t mt-2">
          {/* Left: Placed time */}
          <div className="flex flex-col">
            <span className="text-xs text-neutral-500">Placed</span>
            <span className="font-medium">
              {new Date(order.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
            </span>
          </div>
          
          {/* Right: Estimated completion and status */}
          <div className="flex flex-col items-end">
            {/* Estimated completion time */}
            {order.estimatedCompletionTime && (
              <div className="flex flex-col items-end">
                <span className="text-xs text-neutral-500">Est. Completion</span>
                <span className="font-medium">
                  {new Date(order.estimatedCompletionTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                </span>
              </div>
            )}
            
            {/* Time status indicator */}
            {diffMinutes !== null && (
              <div className={cn(
                "text-xs mt-1 font-medium", 
                diffMinutes < 0 
                  ? diffMinutes < -5 ? "text-red-600" : "text-amber-600" 
                  : "text-green-600"
              )}>
                {order.status === OrderStatus.READY ? "Ready" :
                 order.status === OrderStatus.SERVED ? "Served" :
                 order.status === OrderStatus.CLOSED ? "Closed" :
                 order.status === OrderStatus.CANCELLED ? "Cancelled" :
                 diffMinutes < 0 ? `${Math.abs(diffMinutes)}m late` : `${diffMinutes}m ahead`}
              </div>
            )}
          </div>
        </div>
        
        {/* Action buttons - smaller and at the bottom */}
        <div className="flex justify-end mt-2">
          {/* Only show mark ready button when cooking or plating */}
          {(order.status === OrderStatus.COOKING || order.status === OrderStatus.PLATING) && (
            <button 
              className="px-3 py-1 rounded text-xs font-medium shadow-sm bg-green-500 hover:bg-green-600 text-white"
              onClick={() => markOrderAsReady(order.id)}
            >
              Mark Ready
            </button>
          )}
          
          {/* Only show close button when served */}
          {order.status === OrderStatus.SERVED && (
            <button 
              className="px-3 py-1 rounded text-xs font-medium shadow-sm bg-gray-500 hover:bg-gray-600 text-white ml-2"
              onClick={() => closeOrder(order.id)}
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}