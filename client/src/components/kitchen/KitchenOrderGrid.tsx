import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TimerPill } from "@/components/ui/timer-badge";
import { TimerDisplay } from "@/components/ui/timer-display";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { AttentionLevelBadge } from "@/components/ui/attention-level-badge";
import { OrderSummary, OrderWithItems, OrderItemStatus, OrderStatus, AttentionLevel } from "@shared/schema";

interface KitchenOrderGridProps {
  orders: OrderSummary[];
}

export default function KitchenOrderGrid({ orders }: KitchenOrderGridProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Clock state for live updates to timer displays
  const [currentTime, setCurrentTime] = useState(Date.now());
  
  // Track which items have had their alerts acknowledged
  const [acknowledgedItems, setAcknowledgedItems] = useState<Record<string, boolean>>({});
  
  // Update the clock every second to keep timers refreshed
  useEffect(() => {
    const timerInterval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    
    // Clean up interval on component unmount
    return () => clearInterval(timerInterval);
  }, []);
  
  // Refresh order data every 15 seconds to match server-side behavior
  useEffect(() => {
    const dataRefreshInterval = setInterval(() => {
      // Refetch orders data
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      
      // Also refresh any detailed order data
      orders.forEach(order => {
        queryClient.invalidateQueries({ queryKey: ['/api/order', order.id] });
      });
      
      console.log('Refreshed kitchen order data');
    }, 15000); // Refresh every 15 seconds
    
    // Clean up interval on component unmount
    return () => clearInterval(dataRefreshInterval);
  }, [orders, queryClient]);
  
  // State to track which tickets have had their alerts acknowledged
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState<{[key: string]: boolean}>({});
  
  // Store detailed order data for all orders to avoid refetching
  const [ordersData, setOrdersData] = useState<{id: string; items: any[]}[]>([]);
  
  // Fetch and store detailed order data for all orders
  useEffect(() => {
    const fetchAllOrderDetails = async () => {
      const orderDetailsPromises = orders.map(async (order) => {
        try {
          const response = await apiRequest("GET", `/api/order/${order.id}`);
          const data = await response.json();
          return data;
        } catch (error) {
          console.error(`Error fetching order details for ${order.id}:`, error);
          return null;
        }
      });
      
      const results = await Promise.all(orderDetailsPromises);
      setOrdersData(results.filter(Boolean));
    };
    
    fetchAllOrderDetails();
  }, [orders]);
  
  // Function to acknowledge critical alerts for the entire order
  const acknowledgeAlert = (orderId: string) => {
    setAcknowledgedAlerts(prev => ({
      ...prev,
      [orderId]: true
    }));
  };
  
  // Function to acknowledge critical alerts for individual items
  const acknowledgeItemAlert = (itemId: string) => {
    setAcknowledgedItems(prev => ({
      ...prev,
      [itemId]: true
    }));
    toast({
      title: "Alert Acknowledged",
      description: "The flashing alert for this item has been turned off.",
    });
  };
  
  // Helper to check if any item in an order is running late
  const isAnyItemBehindSchedule = (items: any[]) => {
    return items.some(item => {
      if (item.status !== "COOKING" || !item.firedAt || !item.cookSeconds) return false;
      
      const elapsedSeconds = Math.floor((new Date().getTime() - new Date(item.firedAt).getTime()) / 1000);
      return elapsedSeconds > item.cookSeconds;
    });
  };
  
  // Helper to check if any item in an order is critically late (>120% of expected time)
  const isAnyCriticallyLate = (items: any[]) => {
    return items.some(item => {
      if (item.status !== "COOKING" || !item.firedAt || !item.cookSeconds) return false;
      
      const elapsedSeconds = Math.floor((new Date().getTime() - new Date(item.firedAt).getTime()) / 1000);
      return elapsedSeconds > (item.cookSeconds * 1.2); // 20% over cook time is critical
    });
  };

  // Helper function to determine order card style based on content
  const getOrderCardStyle = (order: OrderSummary) => {
    const orderData = ordersData.find(o => o.id === order.id);
    
    // If we have detailed order data, use it for better styling
    if (orderData && orderData.items && orderData.items.length > 0) {
      const isAcknowledged = acknowledgedAlerts[order.id] || false;
      
      // Check if any items are critically late
      if (isAnyCriticallyLate(orderData.items) && !isAcknowledged) {
        return "bg-red-50 border-2 border-red-500 shadow-md animate-pulse";
      }
      
      // Check if any items are behind schedule
      if (isAnyItemBehindSchedule(orderData.items)) {
        return "bg-red-50 border border-red-400 shadow-md";
      }
      
      // Otherwise style based on order status
      if (order.status === OrderStatus.READY) {
        return "bg-green-50 border border-green-400 shadow-md";
      } else if (order.status === OrderStatus.PLATING) {
        return "bg-purple-50 border border-purple-400 shadow-md";
      } else if (order.status === OrderStatus.COOKING) {
        return "bg-yellow-50 border border-yellow-400 shadow-md";
      } else if (order.status === OrderStatus.NEW) {
        return "bg-white border border-blue-400 shadow-md";
      } else if (order.status === OrderStatus.SERVED) {
        return "bg-blue-50 border border-blue-200 shadow-md opacity-75";
      } else if (order.status === OrderStatus.CLOSED) {
        return "bg-gray-50 border border-gray-300 shadow-md opacity-75";
      } else if (order.status === OrderStatus.CANCELLED) {
        return "bg-red-50 border border-red-300 shadow-md opacity-75";
      }
    }
    
    // Fallback to simple status coloring if no detailed data
    if (order.status === OrderStatus.READY) {
      return "bg-green-50 border border-green-400 shadow-md";
    } else if (order.status === OrderStatus.PLATING) {
      return "bg-purple-50 border border-purple-400 shadow-md";
    } else if (order.status === OrderStatus.COOKING) {
      return "bg-yellow-50 border border-yellow-400 shadow-md";
    } else if (order.status === OrderStatus.NEW) {
      return "bg-white border border-blue-400 shadow-md";
    } else if (order.status === OrderStatus.SERVED) {
      return "bg-blue-50 border border-blue-200 shadow-md opacity-75";
    } else if (order.status === OrderStatus.CLOSED) {
      return "bg-gray-50 border border-gray-300 shadow-md opacity-75";
    } else if (order.status === OrderStatus.CANCELLED) {
      return "bg-red-50 border border-red-300 shadow-md opacity-75";
    }
    
    // Default styling
    return "bg-white border border-gray-200 shadow-sm";
  };
  
  // Helper function to determine time status text based on attention level
  const getTimeStatusText = (order: OrderSummary) => {
    if (order.attentionLevel) {
      switch (order.attentionLevel) {
        case AttentionLevel.CRITICAL:
          return "Urgent!";
        case AttentionLevel.PRIORITY:
          return "Priority";
        case AttentionLevel.ATTENTION:
          return "Attention";
        default:
          return "On time";
      }
    } else if (order.isDelayed) {
      // Legacy support for isDelayed flag
      return "Delayed!";
    } else if (order.timeElapsed > 15) {
      return "Running late";
    } else {
      return "On time";
    }
  };
  
  // Helper function to determine time status color based on attention level
  const getTimeStatusColor = (order: OrderSummary) => {
    if (order.attentionLevel) {
      switch (order.attentionLevel) {
        case AttentionLevel.CRITICAL:
          return "text-red-600";
        case AttentionLevel.PRIORITY:
          return "text-orange-600";
        case AttentionLevel.ATTENTION:
          return "text-amber-600";
        default:
          return "text-green-600";
      }
    } else if (order.isDelayed) {
      // Legacy support for isDelayed flag
      return "text-red-600";
    } else if (order.timeElapsed > 15) {
      return "text-amber-600";
    } else {
      return "text-green-600";
    }
  };
  
  // Toggle item status through the 5-state workflow: NEW -> COOKING -> PLATING -> READY -> SERVED
  const toggleItemCompletion = async (orderItemId: string, completed: boolean, currentStatus?: string | null) => {
    try {
      let endpoint;
      let actionTitle;
      
      // If user checks box:
      //   NEW     -> fire    (NEW → COOKING)
      //   COOKING -> plating (COOKING → PLATING)
      //   PLATING -> ready   (PLATING → READY)
      //   READY   -> deliver (READY → SERVED)
      if (completed) {
        if (currentStatus === OrderItemStatus.COOKING) {
          endpoint = "/plating";
          actionTitle = "Item Plating";
        } else if (currentStatus === OrderItemStatus.PLATING) {
          endpoint = "/ready";
          actionTitle = "Item Ready";
        } else if (currentStatus === OrderItemStatus.READY) {
          endpoint = "/deliver";
          actionTitle = "Item Delivered";
        } else {
          endpoint = "/fire";
          actionTitle = "Item Fired";
        }
      } else {
        // Going backwards in the workflow is less common, but we'll support it
        // If unchecking, revert to the previous state
        if (currentStatus === OrderItemStatus.PLATING) {
          endpoint = "/fire";  // Back to COOKING
          actionTitle = "Item Back to Cooking";
        } else if (currentStatus === OrderItemStatus.READY) {
          endpoint = "/plating";  // Back to PLATING
          actionTitle = "Item Back to Plating";
        } else if (currentStatus === OrderItemStatus.DELIVERED) {
          endpoint = "/ready";  // Back to READY
          actionTitle = "Item Back to Ready";
        } else {
          // Default to firing the item to start cooking
          endpoint = "/fire";
          actionTitle = "Item Fired";
        }
      }
      
      await apiRequest("POST", `/api/order-items/${orderItemId}${endpoint}`);
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/order'] });
      
      toast({
        title: actionTitle,
        description: "Order item status has been updated.",
      });
    } catch (error) {
      console.error("Error updating item status:", error);
      toast({
        title: "Error",
        description: "Failed to update item status.",
        variant: "destructive",
      });
    }
  };
  
  // Mark order as ready - but only if all items are completed
  const markOrderAsReady = async (orderId: string) => {
    try {
      // First fetch the order to check if all items are completed
      const response = await apiRequest("GET", `/api/order/${orderId}`);
      const orderData = await response.json() as OrderWithItems;
      
      // Check if any items are not in READY or DELIVERED status
      const hasUncompletedItems = orderData.items.some(
        item => item.status !== OrderItemStatus.READY && item.status !== OrderItemStatus.DELIVERED
      );
      
      if (hasUncompletedItems) {
        toast({
          title: "Cannot mark as ready",
          description: "All items must be completed before marking the order as ready.",
          variant: "destructive",
        });
        return;
      }
      
      // If all items are complete, mark the order as ready
      await apiRequest("POST", `/api/order/${orderId}/ready`);
      
      // Invalidate queries to refresh data
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
  
  // Close order - after it's been served
  const closeOrder = async (orderId: string) => {
    try {
      // Close the order
      await apiRequest("POST", `/api/order/${orderId}/close`);
      
      // Invalidate queries to refresh data
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
      {/* Left scroll button */}
      <button 
        className="absolute left-0 top-1/2 transform -translate-y-1/2 z-10 bg-white rounded-full p-2 shadow-md hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
        onClick={() => {
          const container = document.getElementById('orders-scroll-container');
          if (container) {
            container.scrollBy({ left: -300, behavior: 'smooth' });
          }
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      
      {/* Right scroll button */}
      <button 
        className="absolute right-0 top-1/2 transform -translate-y-1/2 z-10 bg-white rounded-full p-2 shadow-md hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
        onClick={() => {
          const container = document.getElementById('orders-scroll-container');
          if (container) {
            container.scrollBy({ left: 300, behavior: 'smooth' });
          }
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
      
      <div 
        id="orders-scroll-container"
        className="flex overflow-x-auto pb-4 pt-2 px-10 gap-4 snap-x scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent"
        style={{ scrollbarWidth: 'thin' }}
      >
        {orders.length === 0 ? (
          <div className="flex-shrink-0 min-w-full p-8 text-center text-neutral-500 bg-white rounded-md shadow-md">
            No orders in this category
          </div>
        ) : (
          // Sort orders: COOKING/PENDING first, then READY, then SERVED/DINING/PAID
          [...orders].sort((a, b) => {
            // Define status priority (lower number = appears more to the left)
            const statusPriority: Record<string, number> = {
              [OrderStatus.NEW]: 0,
              [OrderStatus.COOKING]: 10,
              [OrderStatus.PLATING]: 20,
              [OrderStatus.READY]: 30,
              [OrderStatus.SERVED]: 40,
              [OrderStatus.CLOSED]: 50,
              [OrderStatus.CANCELLED]: 60
            };
            
            // Get priority values (default to high number if not found)
            const aPriority = statusPriority[a.status] ?? 100;
            const bPriority = statusPriority[b.status] ?? 100;
            
            // Sort by priority
            return aPriority - bPriority;
          }).map((order) => (
            <div key={order.id} className="flex-shrink-0 w-80 snap-start">
              <OrderCard 
                order={order}
                getOrderCardStyle={getOrderCardStyle}
                getTimeStatusText={getTimeStatusText}
                getTimeStatusColor={getTimeStatusColor}
                toggleItemCompletion={toggleItemCompletion}
                markOrderAsReady={markOrderAsReady}
                closeOrder={closeOrder}
                currentTime={currentTime}
                acknowledgeAlert={acknowledgeAlert}
                acknowledgeItemAlert={acknowledgeItemAlert}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Separate component for each order card to properly use hooks
function OrderCard({ 
  order, 
  getOrderCardStyle,
  getTimeStatusText,
  getTimeStatusColor,
  toggleItemCompletion,
  markOrderAsReady,
  closeOrder,
  currentTime,
  acknowledgeAlert,
  acknowledgeItemAlert
}: { 
  order: OrderSummary;
  getOrderCardStyle: (order: OrderSummary) => string;
  getTimeStatusText: (order: OrderSummary) => string;
  getTimeStatusColor: (order: OrderSummary) => string;
  toggleItemCompletion: (orderItemId: string, completed: boolean, currentStatus?: string | null) => Promise<void>;
  markOrderAsReady: (orderId: string) => Promise<void>;
  closeOrder: (orderId: string) => Promise<void>;
  currentTime: number;
  acknowledgeAlert?: (orderId: string) => void;
  acknowledgeItemAlert?: (itemId: string) => void;
}) {
  // Track which items have had their alerts acknowledged in this card
  const [acknowledgedItems, setAcknowledgedItems] = useState<Record<string, boolean>>({});
  
  // Acknowledge the item and stop the pulsing animation
  const handleAcknowledgeItem = (itemId: string) => {
    setAcknowledgedItems(prev => ({
      ...prev,
      [itemId]: true
    }));
    if (acknowledgeItemAlert) {
      acknowledgeItemAlert(itemId);
    }
  };
  
  // Now we can use hooks properly in this component
  const { data: orderDetails, isLoading, error } = useQuery<OrderWithItems | null>({
    queryKey: ["/api/order", order.id],
    queryFn: async () => {
      try {
        console.log(`Fetching order details for order ${order.id}`);
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
  
  return (
    <div 
      className={cn(
        "rounded-md shadow-md",
        getOrderCardStyle(order)
      )}
    >
      <div className="p-4">
        <div className="flex justify-between items-start mb-3">
          <div>
            <div className="flex items-center mb-1">
              <div className={cn(
                "w-2 h-2 rounded-full mr-2",
                order.status === OrderStatus.READY ? "bg-green-500" : 
                order.status === OrderStatus.PLATING ? "bg-purple-500" :
                order.status === OrderStatus.COOKING ? "bg-yellow-500" :
                order.status === OrderStatus.SERVED ? "bg-blue-500" :
                order.status === OrderStatus.CLOSED ? "bg-gray-500" :
                order.status === OrderStatus.CANCELLED ? "bg-red-500" :
                order.isDelayed ? "bg-red-500" : "bg-blue-500"
              )}></div>
              <span className={cn(
                "text-sm font-medium uppercase tracking-wider px-2 py-0.5 rounded",
                order.status === OrderStatus.READY ? "text-green-700 bg-green-50 border border-green-200" : 
                order.status === OrderStatus.PLATING ? "text-purple-700 bg-purple-50 border border-purple-200" :
                order.status === OrderStatus.COOKING ? "text-yellow-700 bg-yellow-50 border border-yellow-200" :
                order.status === OrderStatus.SERVED ? "text-blue-700 bg-blue-50 border border-blue-200" :
                order.status === OrderStatus.CLOSED ? "text-gray-700 bg-gray-100 border border-gray-200" :
                order.status === OrderStatus.CANCELLED ? "text-red-700 bg-red-50 border border-red-200" :
                order.isDelayed ? "text-red-700 bg-red-50 border border-red-200" : "text-blue-700 bg-blue-50 border border-blue-200"
              )}>
                {order.status}
              </span>
              
              {/* Add attention level badge when an order needs attention */}
              {order.attentionLevel && order.attentionLevel !== AttentionLevel.NORMAL && (
                <div className="ml-2">
                  <AttentionLevelBadge 
                    level={order.attentionLevel}
                    showIcon={true}
                    showLabel={false}
                    compact={true}
                  />
                </div>
              )}
            </div>
            <div className="flex items-center mb-1">
              <span className="text-sm font-medium text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded-md mr-2">
                #{order.orderNumber}
              </span>
              <h3 className="font-poppins font-bold text-lg">Bay {order.bayNumber}</h3>
              <span className="ml-1 text-sm text-neutral-500">(Floor {order.floor})</span>
            </div>
            <p className="text-xs text-neutral-500 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Placed&nbsp;
              {new Date(order.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
            </p>
          </div>
          <div className="flex flex-col items-end">
            {/* Show estimated completion time */}
            <div className="text-sm font-medium">
              {order.estimatedCompletionTime ? (
                <div className="flex flex-col items-end">
                  <span className="text-xs text-neutral-500">Est. Completion:</span>
                  <span className="font-medium">{new Date(order.estimatedCompletionTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
                </div>
              ) : (
                <TimerDisplay createdAt={order.createdAt} />
              )}
            </div>
            
            {/* Simplified status indicator - just on-time/late without detailed text */}
            <span className={cn(
              "mt-1 text-xs font-medium px-2 py-0.5 rounded-full",
              // Is the order actually late compared to its estimated completion time?
              (order.estimatedCompletionTime && new Date() > new Date(order.estimatedCompletionTime))
                ? "bg-red-100 text-red-800" 
                : "bg-green-100 text-green-800"
            )}>
              {(order.estimatedCompletionTime && new Date() > new Date(order.estimatedCompletionTime)) 
                ? "Late" 
                : "On Time"}
            </span>
          </div>
        </div>
        
        {/* Alert Acknowledgment Button - only shown for critically late orders */}
        {orderDetails?.items && orderDetails.items.some(item => {
          if (item.status !== OrderItemStatus.COOKING || !item.firedAt || !item.cookSeconds) return false;
          const elapsedSeconds = Math.floor((new Date().getTime() - new Date(item.firedAt).getTime()) / 1000);
          return elapsedSeconds > (item.cookSeconds * 1.2); // 20% over cook time is critical
        }) && acknowledgeAlert && (
          <div className="flex justify-center mb-3">
            <button
              onClick={() => acknowledgeAlert(order.id)}
              className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-md text-sm font-medium transition-colors"
            >
              Acknowledge Alert
            </button>
          </div>
        )}

        <div className="mt-4 space-y-2">
          {/* Cook Time Priority section removed as requested */}

          {isLoading ? (
            <div className="p-2 bg-white rounded-md flex items-center justify-center">
              <svg className="animate-spin h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          ) : error ? (
            <div className="p-2 bg-white rounded-md text-red-500">
              Error loading items: {error.message}
            </div>
          ) : orderDetails?.items && orderDetails.items.length > 0 ? (
            // Sort items by cook time (longer cook times first) and then by status
            [...orderDetails.items]
              .sort((a, b) => {
                // First sort by status priority: NEW > COOKING > PLATING > READY
                const statusPriority: Record<string, number> = { 
                  [OrderItemStatus.NEW]: 0, 
                  [OrderItemStatus.COOKING]: 1, 
                  [OrderItemStatus.PLATING]: 2, 
                  [OrderItemStatus.READY]: 3, 
                  [OrderItemStatus.DELIVERED]: 4 
                };
                const aStatus = a.status || "PENDING";
                const bStatus = b.status || "PENDING";
                const statusDiff = (statusPriority[aStatus] || 0) - (statusPriority[bStatus] || 0);
                
                if (statusDiff !== 0) return statusDiff;
                
                // Then sort by cook time (descending)
                // First, use cookSeconds if available, fallback to menuItem.prep_seconds if needed
                const aCookTime = a.cookSeconds || a.menuItem?.prep_seconds || 0;
                const bCookTime = b.cookSeconds || b.menuItem?.prep_seconds || 0;
                return bCookTime - aCookTime;
              })
              .map((item) => (
              <div 
                key={item.id} 
                className={cn(
                  "flex justify-between p-3 rounded-md mb-2 border relative",
                  // Base background color by status
                  item.status === OrderItemStatus.READY 
                    ? "bg-green-50 border-green-200" 
                    : item.status === OrderItemStatus.PLATING
                      ? "bg-purple-50 border-purple-200"
                      : item.status === OrderItemStatus.COOKING 
                        ? (() => {
                            // For cooking items, check if they're behind schedule
                            if (item.firedAt && item.cookSeconds) {
                              const elapsedSeconds = Math.floor(
                                (new Date().getTime() - new Date(item.firedAt).getTime()) / 1000
                              );
                              // More than 120% of expected time = critically late
                              if (elapsedSeconds > item.cookSeconds * 1.2) {
                                // Check if this item has been acknowledged
                                return acknowledgedItems[item.id] 
                                  ? "bg-red-50 border-red-400" // Stop flashing if acknowledged
                                  : "bg-red-50 border-red-400 animate-pulse";
                              }
                              // More than 100% of expected time = behind schedule
                              else if (elapsedSeconds > item.cookSeconds) {
                                return "bg-red-50 border-red-400";
                              }
                              // Otherwise on track
                              return "bg-yellow-50 border-yellow-300";
                            }
                            return "bg-yellow-50 border-yellow-200";
                          })()
                        : "bg-white border-gray-200",
                  
                  // Add left border indicators for status
                  item.status === OrderItemStatus.READY && "border-l-4 border-l-green-500",
                  item.status === OrderItemStatus.PLATING && "border-l-4 border-l-purple-500",
                  
                  // Add a highlighted border for the next item to cook (the pending item with longest cook time)
                  item.status === OrderItemStatus.NEW && 
                  orderDetails.items
                    .filter(i => i.status === OrderItemStatus.NEW)
                    .sort((a, b) => 
                      (b.cookSeconds || b.menuItem?.prep_seconds || 0) - 
                      (a.cookSeconds || a.menuItem?.prep_seconds || 0)
                    )[0]?.id === item.id &&
                    "border-2 border-blue-500 shadow-md"
                )}
              >
                {/* Next Up Badge */}
                {item.status === OrderItemStatus.NEW && 
                  orderDetails.items
                    .filter(i => i.status === OrderItemStatus.NEW)
                    .sort((a, b) => 
                      (b.cookSeconds || b.menuItem?.prep_seconds || 0) - 
                      (a.cookSeconds || a.menuItem?.prep_seconds || 0)
                    )[0]?.id === item.id && (
                      <>
                        <div className="absolute -top-2 -left-2 bg-blue-500 text-white px-2 py-0.5 text-xs font-bold rounded shadow-sm">
                          NEXT UP
                        </div>
                        
                        {/* Add a "Start In" timer that calculates when to start this item */}
                        {(() => {
                          // Find currently cooking items in this order
                          const cookingItems = orderDetails.items.filter(i => i.status === OrderItemStatus.COOKING && i.firedAt);
                          
                          // If no cooking items, show "START NOW"
                          if (cookingItems.length === 0) {
                            return (
                              <div className="absolute -top-2 right-2 bg-red-500 text-white px-2 py-0.5 text-xs font-bold rounded shadow-sm animate-pulse">
                                START NOW
                              </div>
                            );
                          }
                          
                          // Calculate the soonest an item will be done cooking
                          let earliestReadyTime = Infinity;
                          cookingItems.forEach(cookingItem => {
                            if (cookingItem.firedAt) {
                              const cookingItemTotal = cookingItem.cookSeconds || cookingItem.menuItem?.prep_seconds || 0;
                              const firedTime = new Date(cookingItem.firedAt).getTime();
                              const currentTime = new Date().getTime();
                              const elapsedSeconds = Math.floor((currentTime - firedTime) / 1000);
                              const remainingSeconds = Math.max(0, cookingItemTotal - elapsedSeconds);
                              
                              // Update earliestReadyTime if this item will be ready sooner
                              if (remainingSeconds < earliestReadyTime) {
                                earliestReadyTime = remainingSeconds;
                              }
                            }
                          });
                          
                          // Calculate when we should start cooking the next item
                          const nextItemPrepSeconds = item.cookSeconds || item.menuItem?.prep_seconds || 0;
                          
                          // Determine if we should start now or wait
                          // If the next item takes longer than the current cooking items, start now
                          // Otherwise, wait until [earliestReadyTime - nextItemPrepSeconds]
                          const startInSeconds = Math.max(0, earliestReadyTime - nextItemPrepSeconds);
                          
                          // Format the start time
                          const minutes = Math.floor(startInSeconds / 60);
                          const seconds = startInSeconds % 60;
                          
                          if (startInSeconds <= 0) {
                            // Should start now
                            return (
                              <div className="absolute -top-2 right-2 bg-red-500 text-white px-2 py-0.5 text-xs font-bold rounded shadow-sm animate-pulse">
                                START NOW
                              </div>
                            );
                          } else if (startInSeconds < 60) {
                            // Start soon (less than a minute)
                            return (
                              <div className="absolute -top-2 right-2 bg-amber-500 text-white px-2 py-0.5 text-xs font-bold rounded shadow-sm">
                                START IN {seconds}s
                              </div>
                            );
                          } else {
                            // Start later
                            return (
                              <div className="absolute -top-2 right-2 bg-green-600 text-white px-2 py-0.5 text-xs font-bold rounded shadow-sm">
                                START IN {minutes}:{seconds.toString().padStart(2, '0')}
                              </div>
                            );
                          }
                        })()}
                      </>
                )}
                
                {/* Cooking Timer Badge - show in same position as start timer */}
                {item.status === OrderItemStatus.COOKING && item.firedAt && (
                  (() => {
                    // Calculate time elapsed since firing
                    const totalCookSeconds = item.cookSeconds || item.menuItem?.prep_seconds || 0;
                    const firedTime = new Date(item.firedAt).getTime();
                    const currentTime = new Date().getTime();
                    const elapsedSeconds = Math.floor((currentTime - firedTime) / 1000);
                    
                    // Calculate remaining time
                    const remainingSeconds = Math.max(0, totalCookSeconds - elapsedSeconds);
                    const minutes = Math.floor(remainingSeconds / 60);
                    const seconds = remainingSeconds % 60;
                    
                    // Check if item is critically late (more than 20% over cook time)
                    const isCriticallyLate = elapsedSeconds > totalCookSeconds * 1.2;
                    
                    // Format display
                    if (remainingSeconds <= 0) {
                      // Add a "Stop Flashing" button for critically late items
                      if (isCriticallyLate && !acknowledgedItems[item.id]) {
                        return (
                          <div className="absolute -top-2 right-2 flex items-center gap-1">
                            <div className="bg-green-500 text-white px-2 py-0.5 text-xs font-bold rounded shadow-sm animate-pulse">
                              READY TO CHECK
                            </div>
                            <button 
                              className="bg-red-700 text-white px-2 py-0.5 text-xs font-bold rounded shadow-sm hover:bg-red-800"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAcknowledgeItem(item.id);
                              }}
                            >
                              ✓
                            </button>
                          </div>
                        );
                      } else {
                        return (
                          <div className="absolute -top-2 right-2 bg-green-500 text-white px-2 py-0.5 text-xs font-bold rounded shadow-sm animate-pulse">
                            READY TO CHECK
                          </div>
                        );
                      }
                    } else if (remainingSeconds < 30) {
                      return (
                        <div className="absolute -top-2 right-2 bg-green-600 text-white px-2 py-0.5 text-xs font-bold rounded shadow-sm">
                          COOKING {minutes}:{seconds.toString().padStart(2, '0')}
                        </div>
                      );
                    } else if (remainingSeconds < 60) {
                      return (
                        <div className="absolute -top-2 right-2 bg-amber-500 text-white px-2 py-0.5 text-xs font-bold rounded shadow-sm">
                          COOKING {minutes}:{seconds.toString().padStart(2, '0')}
                        </div>
                      );
                    } else {
                      return (
                        <div className="absolute -top-2 right-2 bg-blue-500 text-white px-2 py-0.5 text-xs font-bold rounded shadow-sm">
                          COOKING {minutes}:{seconds.toString().padStart(2, '0')}
                        </div>
                      );
                    }
                  })()
                )}
                
                <div className="flex items-center flex-1">
                  <div className="mr-2 flex-shrink-0">
                    {/* Status indicators with appropriate checkboxes for each state */}
                    {item.status === OrderItemStatus.DELIVERED ? (
                      // Delivered items show a purple checkmark
                      <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-purple-600" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    ) : item.status === OrderItemStatus.READY ? (
                      // Ready items show a green checkmark
                      <Checkbox
                        className="w-6 h-6 data-[state=checked]:bg-green-500 border-green-300 bg-green-100"
                        checked={true} 
                        onCheckedChange={(checked) => toggleItemCompletion(item.id, checked as boolean, item.status || undefined)}
                      />
                    ) : item.status === OrderItemStatus.PLATING ? (
                      // Plating items get a purple checkbox to mark as READY
                      <Checkbox
                        className="w-6 h-6 data-[state=checked]:bg-green-500 border-purple-300 bg-purple-100"
                        checked={false}
                        onCheckedChange={(checked) => toggleItemCompletion(item.id, checked as boolean, item.status || undefined)}
                      />
                    ) : item.status === OrderItemStatus.COOKING ? (
                      // Cooking items get an amber checkbox to mark as PLATING
                      <Checkbox
                        className="w-6 h-6 data-[state=checked]:bg-purple-500 border-amber-300 bg-amber-100"
                        checked={false}
                        onCheckedChange={(checked) => toggleItemCompletion(item.id, checked as boolean, item.status || undefined)}
                      />
                    ) : (
                      // New items get a blue checkbox to mark as COOKING
                      <Checkbox
                        className="w-6 h-6 data-[state=checked]:bg-amber-500 border-blue-300 bg-blue-100"
                        checked={false}
                        onCheckedChange={(checked) => toggleItemCompletion(item.id, checked as boolean, item.status || undefined)}
                      />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center text-sm font-medium">
                      <span className="inline-block mr-1.5 truncate max-w-[180px]">{item.menuItem?.name || "Unknown Item"}</span>
                      {item.quantity > 1 && (
                        <span className="bg-neutral-100 px-1.5 py-0.5 text-xs rounded-full text-neutral-700 flex-shrink-0">
                          x{item.quantity}
                        </span>
                      )}
                    </div>
                    
                    {/* Show customizations if available */}
                    {item.customizations && item.customizations.length > 0 && (
                      <div className="text-xs bg-blue-50 p-2 rounded mt-1 border border-blue-200">
                        <div className="font-medium text-blue-700 border-b border-blue-100 pb-1 mb-1">Customizations:</div>
                        <ul className="list-disc list-inside text-blue-800">
                          {item.customizations.map((customization: {
                            categoryId: number;
                            categoryName: string;
                            options: {
                              id: number;
                              name: string;
                              priceCents: number;
                            }[];
                          }, idx: number) => (
                            <li key={idx} className="pl-1 mb-1">
                              <span className="font-medium">{customization.categoryName}:</span> {customization.options.map(opt => opt.name).join(', ')}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {/* Display notes if available */}
                    {item.notes && (
                      <div className="text-xs bg-amber-50 p-2 rounded mt-1 border border-amber-200">
                        <div className="font-medium text-amber-700 border-b border-amber-100 pb-1 mb-1">Special Instructions:</div>
                        <div className="text-amber-800 italic pl-1">{item.notes}</div>
                      </div>
                    )}
                    
                    <div className="text-xs text-neutral-500 mt-1">
                      {/* Show cook time in minutes */}
                      {(() => {
                        const totalSeconds = item.cookSeconds || item.menuItem?.prep_seconds || 0;
                        const minutes = Math.floor(totalSeconds / 60);
                        const displayMinutes = minutes === 0 && totalSeconds > 0 ? 1 : minutes;
                        return (
                          <>
                            Cook time: {displayMinutes}m
                          </>
                        );
                      })()}
                    </div>
                  </div>
                  
                  <div className="ml-2 flex flex-col items-end">
                    {/* Status badge removed as requested */}
                    
                    {/* Show timing info */}
                    {item.firedAt && (
                      <div className="text-[10px] text-neutral-500">
                        {item.status === OrderItemStatus.READY ? (
                          <>Ready at: {new Date(item.firedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</>
                        ) : item.status !== OrderItemStatus.COOKING ? (
                          <>Fired at: {new Date(item.firedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : null}
          
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <span className={cn(
                "text-sm font-medium",
                order.isDelayed ? "text-red-600" : "text-neutral-600"
              )}>
                {order.status === OrderStatus.READY ? (
                  <span className="flex items-center text-green-600">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Order Ready To Serve
                  </span>
                ) : (
                  <span>
                    {orderDetails?.items?.filter(i => i.status === OrderItemStatus.READY).length || 0} of {orderDetails?.items?.length || 0} items ready
                  </span>
                )}
              </span>
            </div>
            
            {/* Display different buttons based on order status */}
            {order.status === OrderStatus.SERVED && (
              <button 
                className="px-4 py-2 rounded-md text-sm font-medium flex items-center shadow-sm transition-all bg-gray-500 hover:bg-gray-600 text-white border border-gray-600"
                onClick={() => closeOrder(order.id)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM14 11a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1h-1a1 1 0 110-2h1v-1a1 1 0 011-1z" />
                </svg>
                Close Order
              </button>
            )}
            
            {order.status !== OrderStatus.READY && order.status !== OrderStatus.SERVED && order.status !== OrderStatus.CLOSED && (
              <button 
                className={cn(
                  "px-4 py-2 rounded-md text-sm font-medium flex items-center shadow-sm transition-all",
                  order.isDelayed
                    ? "bg-red-500 hover:bg-red-600 text-white border border-red-600" 
                    : "bg-green-500 hover:bg-green-600 text-white border border-green-600"
                )}
                onClick={() => markOrderAsReady(order.id)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Mark Order Ready
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}