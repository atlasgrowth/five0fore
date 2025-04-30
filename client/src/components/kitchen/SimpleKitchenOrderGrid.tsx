import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { OrderSummary, OrderWithItems, OrderItemStatus, OrderStatus } from "@shared/schema";

// Timer to show when to start cooking an item
function StartTimer({ 
  orderCreatedAt, 
  cookSeconds, 
  longestCookItem 
}: { 
  orderCreatedAt: string | Date, 
  cookSeconds: number, 
  longestCookItem: boolean 
}) {
  const [timeToStart, setTimeToStart] = useState<number | null>(null);
  const [isTimeToStart, setIsTimeToStart] = useState<boolean>(false);
  const [longestCookTime, setLongestCookTime] = useState<number>(0);
  const [percentProgress, setPercentProgress] = useState<number>(0);

  useEffect(() => {
    // Find the actual longest cook time in the order
    if (longestCookItem) {
      setLongestCookTime(cookSeconds);
    }
  }, [longestCookItem, cookSeconds]);

  useEffect(() => {
    const calculateStartTime = () => {
      // If this is the longest cook item, it should start right away
      if (longestCookItem) {
        setIsTimeToStart(true);
        setTimeToStart(0);
        setPercentProgress(100);
        return;
      }

      // Otherwise, calculate when to start this item
      const orderTime = new Date(orderCreatedAt).getTime();
      const currentTime = new Date().getTime();
      const elapsedMs = currentTime - orderTime;

      // Time to wait before starting this item
      // We want items to finish at approximately the same time
      // So start shorter cooking items after: (longest cook time - this item's cook time)
      const waitTimeMs = Math.max(0, (longestCookTime - cookSeconds) * 1000);

      // If it's already time to start (elapsed time > wait time)
      if (elapsedMs >= waitTimeMs) {
        setIsTimeToStart(true);
        setTimeToStart(0);
        setPercentProgress(100);
      } else {
        // Calculate seconds remaining until it's time to start
        const remainingMs = waitTimeMs - elapsedMs;
        const totalWaitTime = longestCookTime - cookSeconds;

        // Calculate percentage of wait time that has passed
        if (totalWaitTime > 0) {
          const elapsedWaitTime = totalWaitTime - (remainingMs / 1000);
          const percent = Math.min(100, Math.floor((elapsedWaitTime / totalWaitTime) * 100));
          setPercentProgress(percent);
        } else {
          setPercentProgress(0);
        }

        setTimeToStart(Math.ceil(remainingMs / 1000));
        setIsTimeToStart(false);
      }
    };

    calculateStartTime();
    const timer = setInterval(calculateStartTime, 1000);

    return () => clearInterval(timer);
  }, [orderCreatedAt, cookSeconds, longestCookItem, longestCookTime]);

  // Format time in minutes and seconds
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isTimeToStart) {
    return (
      <div className="ml-2 flex items-center">
        <span className="text-xs font-medium bg-red-100 text-red-800 px-2 py-0.5 rounded-full flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Start now!
        </span>
        <button 
          className="ml-2 p-1 text-xs bg-yellow-100 hover:bg-yellow-200 text-yellow-800 rounded-full flex items-center"
          title="Start cooking"
          onClick={(e) => {
            e.stopPropagation();
            const checkbox = e.currentTarget.closest('div[data-item-id]')?.querySelector('input[type="checkbox"]') as HTMLInputElement;
            if (checkbox) {
              checkbox.click();
            }
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="ml-2 flex items-center">
      <div className="flex flex-col">
        <div className="flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-xs font-medium text-gray-700">
            Start in {timeToStart !== null ? formatTime(timeToStart) : '--:--'}
          </span>
        </div>

        {/* Progress bar showing time progress until start */}
        <div className="relative w-16 h-2 bg-gray-200 rounded-full overflow-hidden mt-1">
          <div 
            className="absolute left-0 top-0 h-full bg-blue-400"
            style={{ width: `${percentProgress}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
}

// Simple cooking timer component
function CookingTimer({ firedAt, cookSeconds }: { firedAt: string | Date, cookSeconds: number }) {
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

  // Determine color based on progress
  const getColor = () => {
    if (percentage >= 100) return "text-red-600";
    if (percentage >= 90) return "text-amber-600";
    if (percentage >= 75) return "text-amber-500";
    return "text-green-600";
  };

  return (
    <div className="ml-2 flex items-center">
      <div className="relative w-16 h-4 bg-gray-200 rounded-full overflow-hidden">
        <div 
          className={`absolute left-0 top-0 h-full ${percentage >= 90 ? 'bg-red-500' : percentage >= 75 ? 'bg-amber-500' : 'bg-green-500'}`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
      <span className={`ml-1 text-xs font-medium ${getColor()}`}>
        {formatTime(timeLeft)}
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
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const [lastProcessedItem, setLastProcessedItem] = useState<string | null>(null);

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
      // Remember the last processed item ID to maintain focus
      setLastProcessedItem(orderItemId);

      let endpoint;
      let actionTitle;

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
        // Going backwards in the workflow
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
      queryClient.invalidateQueries({ queryKey: ['/api/order', orderId] });

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

  // Filter orders by search term
  const filteredOrders = searchTerm 
    ? orders.filter(order => {
        // Convert search term and order id to lowercase for case-insensitive comparison
        const search = searchTerm.toLowerCase();
        const orderId = order.id.toLowerCase();
        const bayNumber = order.bayNumber?.toString() || '';
        const orderSummary = `${orderId} ${bayNumber} ${order.status.toLowerCase()}`;

        return orderSummary.includes(search);
      })
    : orders;

  // Group orders by status for static positioning
  const ordersByStatus = {
    new: [] as OrderSummary[],
    cooking: [] as OrderSummary[],
    plating: [] as OrderSummary[],
    ready: [] as OrderSummary[],
    served: [] as OrderSummary[],
    closed: [] as OrderSummary[],
    cancelled: [] as OrderSummary[]
  };

  // Sort orders into their status buckets
  filteredOrders.forEach(order => {
    const status = order.status.toLowerCase() as keyof typeof ordersByStatus;
    if (ordersByStatus[status]) {
      ordersByStatus[status].push(order);
    } else {
      // Default to 'new' if for some reason the status doesn't match
      ordersByStatus.new.push(order);
    }
  });

  // Removed auto-focusing/scrolling on last processed item
  // to prevent unwanted UI jumps when updating items

  return (
    <div className="relative">
      {/* Search bar */}
      <div className="mb-4">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <svg className="w-4 h-4 text-gray-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20">
              <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z"/>
            </svg>
          </div>
          <Input
            type="text"
            placeholder="Search by bay number, order ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
          {searchTerm && (
            <button 
              className="absolute inset-y-0 right-0 flex items-center pr-3"
              onClick={() => setSearchTerm("")}
            >
              <svg className="w-4 h-4 text-gray-500 hover:text-gray-700" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Orders grid with horizontal rows based on status */}
      <div 
        ref={containerRef}
        id="orders-scroll-container"
        className="space-y-6 overflow-auto pb-6 pt-2"
      >
        {/* NEW & COOKING row (top) - horizontal scrollable row */}
        <div className="space-y-2">
          <h2 className="font-bold text-md bg-white p-1 rounded-md shadow-sm text-primary border-l-4 border-blue-500 flex items-center sticky left-0">
            <span>New & Cooking ({ordersByStatus.new.length + ordersByStatus.cooking.length})</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 ml-2 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </h2>

          {ordersByStatus.new.length === 0 && ordersByStatus.cooking.length === 0 ? (
            <div className="bg-white p-2 rounded-md text-center text-gray-500 border">
              No new or cooking orders
            </div>
          ) : (
            <div className="flex space-x-2 overflow-x-auto pb-2">
              {/* NEW orders first */}
              {ordersByStatus.new.map((order) => (
                <div key={order.id} className="min-w-[220px] max-w-[220px] flex-shrink-0">
                  <OrderCard
                    order={order}
                    toggleItemCompletion={toggleItemCompletion}
                    markOrderAsReady={markOrderAsReady}
                    closeOrder={closeOrder}
                  />
                </div>
              ))}

              {/* Then COOKING orders */}
              {ordersByStatus.cooking.map((order) => (
                <div key={order.id} className="min-w-[220px] max-w-[220px] flex-shrink-0">
                  <OrderCard
                    order={order}
                    toggleItemCompletion={toggleItemCompletion}
                    markOrderAsReady={markOrderAsReady}
                    closeOrder={closeOrder}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* PLATING row (second) - horizontal scrollable row */}
        <div className="space-y-2">
          <h2 className="font-bold text-md bg-white p-1 rounded-md shadow-sm text-purple-700 border-l-4 border-purple-500 flex items-center sticky left-0">
            <span>Plating ({ordersByStatus.plating.length})</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 ml-2 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </h2>

          {ordersByStatus.plating.length === 0 ? (
            <div className="bg-white p-2 rounded-md text-center text-gray-500 border">
              No orders being plated
            </div>
          ) : (
            <div className="flex space-x-2 overflow-x-auto pb-2">
              {ordersByStatus.plating.map((order) => (
                <div key={order.id} className="min-w-[220px] max-w-[220px] flex-shrink-0">
                  <OrderCard
                    order={order}
                    toggleItemCompletion={toggleItemCompletion}
                    markOrderAsReady={markOrderAsReady}
                    closeOrder={closeOrder}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* READY row (third) - horizontal scrollable row */}
        <div className="space-y-2">
          <h2 className="font-bold text-md bg-white p-1 rounded-md shadow-sm text-green-700 border-l-4 border-green-500 flex items-center sticky left-0">
            <span>Ready ({ordersByStatus.ready.length})</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 ml-2 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </h2>

          {ordersByStatus.ready.length === 0 ? (
            <div className="bg-white p-2 rounded-md text-center text-gray-500 border">
              No orders ready to serve
            </div>
          ) : (
            <div className="flex space-x-2 overflow-x-auto pb-2">
              {ordersByStatus.ready.map((order) => (
                <div key={order.id} className="min-w-[220px] max-w-[220px] flex-shrink-0">
                  <OrderCard
                    order={order}
                    toggleItemCompletion={toggleItemCompletion}
                    markOrderAsReady={markOrderAsReady}
                    closeOrder={closeOrder}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SERVED row (fourth) - horizontal scrollable row */}
        <div className="space-y-2">
          <h2 className="font-bold text-md bg-white p-1 rounded-md shadow-sm text-blue-700 border-l-4 border-blue-400 flex items-center sticky left-0">
            <span>Served ({ordersByStatus.served.length})</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 ml-2 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </h2>

          {ordersByStatus.served.length === 0 ? (
            <div className="bg-white p-2 rounded-md text-center text-gray-500 border">
              No served orders
            </div>
          ) : (
            <div className="flex space-x-2 overflow-x-auto pb-2">
              {ordersByStatus.served.map((order) => (
                <div key={order.id} className="min-w-[220px] max-w-[220px] flex-shrink-0">
                  <OrderCard
                    order={order}
                    toggleItemCompletion={toggleItemCompletion}
                    markOrderAsReady={markOrderAsReady}
                    closeOrder={closeOrder}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CLOSED row (bottom) - horizontal scrollable row */}
        <div className="space-y-2">
          <h2 className="font-bold text-md bg-white p-1 rounded-md shadow-sm text-gray-700 border-l-4 border-gray-500 flex items-center sticky left-0">
            <span>Closed ({ordersByStatus.closed.length})</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 ml-2 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </h2>

          {ordersByStatus.closed.length === 0 ? (
            <div className="bg-white p-2 rounded-md text-center text-gray-500 border">
              No closed orders
            </div>
          ) : (
            <div className="flex space-x-2 overflow-x-auto pb-2">
              {ordersByStatus.closed.map((order) => (
                <div key={order.id} className="min-w-[220px] max-w-[220px] flex-shrink-0">
                  <OrderCard
                    order={order}
                    toggleItemCompletion={toggleItemCompletion}
                    markOrderAsReady={markOrderAsReady}
                    closeOrder={closeOrder}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
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
    // Ensure the estimatedCompletionTime is treated as a string before converting to Date
    const estimatedTime = new Date(String(order.estimatedCompletionTime));
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
      <div className="p-2">
        {/* TOP ROW: Status on left, Bay number in center, Order number on right */}
        <div className="flex justify-between items-center mb-1 border-b pb-1">
          {/* Left: Status */}
          <div>
            <span className={cn(
              "text-xs font-medium uppercase tracking-wider px-1 py-0.5 rounded",
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
            <h3 className="font-bold text-md">Bay {order.bayNumber}</h3>
          </div>

          {/* Right: Order number */}
          <div className="text-right">
            <span className="text-xs font-medium text-neutral-600 bg-neutral-100 px-1 py-0.5 rounded">
              #{order.orderNumber}
            </span>
          </div>
        </div>

        {/* ITEMS SECTION */}
        <div className="mb-1">
          {isLoading ? (
            <div className="p-1 flex items-center justify-center">
              <svg className="animate-spin h-4 w-4 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
                    "flex justify-between p-1 mb-1 border-b text-xs",
                    item.status === OrderItemStatus.COOKING && "border-l-2 border-l-yellow-500",
                    item.status === OrderItemStatus.PLATING && "border-l-2 border-l-purple-500",
                    item.status === OrderItemStatus.READY && "border-l-2 border-l-green-500",
                    item.status === OrderItemStatus.DELIVERED && "border-l-2 border-l-blue-500"
                  )}
                >
                  <div className="flex items-center">
                    <Checkbox 
                      className="h-3 w-3 rounded mr-1 border border-neutral-300"
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
                          <span className="text-xs font-medium">{item.quantity}x {item.menuItem?.name}</span>
                          <span className="ml-1 text-xs text-gray-500">
                            ({Math.round((item.cookSeconds || item.menuItem?.prep_seconds || 0) / 60)}m)
                          </span>
                        </div>

                        {/* Status labels with appropriate indicators and action buttons */}
                        {item.status === OrderItemStatus.COOKING && item.firedAt && (
                          <div className="ml-1 flex items-center">
                            <span className="text-xs font-medium bg-yellow-100 text-yellow-800 px-1 py-0.5 rounded-full">
                              Cooking
                            </span>
                            <CookingTimer 
                              firedAt={String(item.firedAt)} 
                              cookSeconds={item.cookSeconds || item.menuItem?.prep_seconds || 300}
                            />
                            <button 
                              onClick={() => toggleItemCompletion(item.id, true, item.status)}
                              className="ml-1 p-1 text-xs bg-purple-100 hover:bg-purple-200 text-purple-800 rounded-full flex items-center"
                              title="Move to plating"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </div>
                        )}

                        {item.status === OrderItemStatus.PLATING && (
                          <div className="ml-1 flex items-center">
                            <span className="text-xs font-medium bg-purple-100 text-purple-800 px-1 py-0.5 rounded-full">
                              Plating
                            </span>
                            <button 
                              onClick={() => toggleItemCompletion(item.id, true, item.status)}
                              className="ml-1 p-1 text-xs bg-green-100 hover:bg-green-200 text-green-800 rounded-full flex items-center"
                              title="Mark as ready"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </div>
                        )}

                        {item.status === OrderItemStatus.READY && (
                          <div className="ml-1 flex items-center">
                            <span className="text-xs font-medium bg-green-100 text-green-800 px-1 py-0.5 rounded-full">
                              Ready
                            </span>
                            <button 
                              onClick={() => toggleItemCompletion(item.id, true, item.status)}
                              className="ml-1 p-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-full flex items-center"
                              title="Mark as delivered"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </div>
                        )}

                        {item.status === OrderItemStatus.DELIVERED && (
                          <span className="ml-1 text-xs font-medium bg-blue-100 text-blue-800 px-1 py-0.5 rounded-full">
                            Delivered
                          </span>
                        )}

                        {/* Pending items (show when to start cooking) */}
                        {!item.status && item.menuItem?.prep_seconds && (
                          <StartTimer 
                            orderCreatedAt={String(order.createdAt)}
                            cookSeconds={item.menuItem.prep_seconds}
                            longestCookItem={
                              orderDetails?.items?.reduce((longest, curr) => {
                                const currCookTime = curr.cookSeconds || curr.menuItem?.prep_seconds || 0;
                                const longestCookTime = longest.cookSeconds || longest.menuItem?.prep_seconds || 0;
                                return currCookTime > longestCookTime ? curr : longest;
                              }, item) === item
                            }
                          />
                        )}
                      </div>

                      {/* Customizations display - even more compact */}
                      {item.customizations && item.customizations.length > 0 && (
                        <div className="text-xs text-neutral-500">
                          {item.customizations.map((customization, idx) => (
                            <span key={idx} className="mr-1">
                              {customization.options.map(opt => opt.name).join(', ')}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
          ) : (
            <div className="p-1 text-neutral-500 text-xs text-center">
              No items in this order
            </div>
          )}
        </div>

        {/* BOTTOM ROW with times and actions combined for compactness */}
        <div className="flex justify-between items-center border-t pt-1 text-xs">
          <div className="flex flex-row space-x-2 items-center">
            {/* Placed time */}
            <div>
              <span className="text-xs text-neutral-500 mr-1">Placed:</span>
              <span className="text-xs font-medium">
                {new Date(order.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
              </span>
            </div>

            {/* Completion time (if available) */}
            {order.estimatedCompletionTime && (
              <div>
                <span className="text-xs text-neutral-500 mr-1">ETA:</span>
                <span className="text-xs font-medium">
                  {new Date(order.estimatedCompletionTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                </span>
              </div>
            )}

            {/* Time status indicator */}
            {diffMinutes !== null && (
              <div className={cn(
                "text-xs font-medium", 
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

          {/* Action buttons - even smaller */}
          <div className="flex">
            {/* Only show mark ready button when cooking or plating */}
            {(order.status === OrderStatus.COOKING || order.status === OrderStatus.PLATING) && (
              <button 
                className="px-2 py-0.5 rounded text-xs font-medium bg-green-500 hover:bg-green-600 text-white"
                onClick={() => markOrderAsReady(order.id)}
              >
                Ready
              </button>
            )}

            {/* Only show close button when served */}
            {order.status === OrderStatus.SERVED && (
              <button 
                className="px-2 py-0.5 rounded text-xs font-medium bg-gray-500 hover:bg-gray-600 text-white ml-1"
                onClick={() => closeOrder(order.id)}
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Component to display order items with proper containment
function OrderItems({ 
  orderId, 
  toggleItemCompletion,
  currentTime,
  acknowledgeItemAlert
}: { 
  orderId: string;
  toggleItemCompletion: (orderItemId: string, completed: boolean, currentStatus?: string | null) => Promise<void>;
  currentTime: number;
  acknowledgeItemAlert: (itemId: string) => void;
}) {
  const [acknowledgedItems, setAcknowledgedItems] = useState<Record<string, boolean>>({});

  // Handle acknowledgment for individual items
  const handleAcknowledgeItem = (itemId: string) => {
    setAcknowledgedItems(prev => ({
      ...prev,
      [itemId]: true
    }));
    acknowledgeItemAlert(itemId);
  };

  // Fetch order details
  const { data: orderDetails, isLoading, error } = useQuery<OrderWithItems | null>({
    queryKey: ["/api/order", orderId],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", `/api/order/${orderId}`);
        return await response.json() as OrderWithItems;
      } catch (error) {
        console.error(`Error fetching order details for ${orderId}:`, error);
        return null;
      }
    },
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-4">
        <div className="animate-spin h-5 w-5 border-2 border-blue-500 rounded-full border-t-transparent"></div>
      </div>
    );
  }

  if (error || !orderDetails) {
    return (
      <div className="p-3 bg-red-50 text-red-500 rounded-md">
        Error loading items
      </div>
    );
  }

  if (!orderDetails.items || orderDetails.items.length === 0) {
    return (
      <div className="p-3 text-gray-500 text-center">
        No items in this order
      </div>
    );
  }

  // Sort items by status priority and cook time
  const sortedItems = [...orderDetails.items].sort((a, b) => {
    // Status priority: NEW > COOKING > PLATING > READY > DELIVERED
    const statusPriority: Record<string, number> = { 
      [OrderItemStatus.NEW]: 0, 
      [OrderItemStatus.COOKING]: 1, 
      [OrderItemStatus.PLATING]: 2, 
      [OrderItemStatus.READY]: 3, 
      [OrderItemStatus.DELIVERED]: 4 
    };

    const aStatus = a.status || OrderItemStatus.NEW;
    const bStatus = b.status || OrderItemStatus.NEW;
    const statusDiff = (statusPriority[aStatus] || 0) - (statusPriority[bStatus] || 0);

    if (statusDiff !== 0) return statusDiff;

    // Then sort by cook time (descending)
    const aCookTime = a.cookSeconds || a.menuItem?.prep_seconds || 0;
    const bCookTime = b.cookSeconds || b.menuItem?.prep_seconds || 0;
    return bCookTime - aCookTime;
  });

  return (
    <div className="space-y-3">
      {sortedItems.map((item) => {
        // Calculate cooking status for styling
        let itemStyle = "bg-white border border-gray-200";
        let borderAccent = "";

        if (item.status === OrderItemStatus.READY) {
          itemStyle = "bg-green-50 border border-green-200";
          borderAccent = "border-l-4 border-l-green-500";
        } else if (item.status === OrderItemStatus.PLATING) {
          itemStyle = "bg-purple-50 border border-purple-200";
          borderAccent = "border-l-4 border-l-purple-500";
        } else if (item.status === OrderItemStatus.COOKING) {
          // Check if item is running late
          if (item.firedAt && item.cookSeconds) {
            const elapsedSeconds = Math.floor(
              (new Date().getTime() - new Date(item.firedAt).getTime()) / 1000
            );

            if (elapsedSeconds > item.cookSeconds * 1.2) {
              // Item is critically late
              itemStyle = "bg-red-50 border border-red-400";
              if (!acknowledgedItems[item.id]) {
                borderAccent = "border-l-4 border-l-red-600";
              }
            } else if (elapsedSeconds > item.cookSeconds) {
              // Item is behind schedule
              itemStyle = "bg-red-50 border border-red-400";
            } else {
              // Item is on track
              itemStyle = "bg-yellow-50 border border-yellow-300";
            }
          } else {
            itemStyle = "bg-yellow-50 border border-yellow-200";
          }
        } else if (item.status === OrderItemStatus.NEW) {
          // Highlight the next item to cook
          const pendingItems = orderDetails.items.filter(i => i.status === OrderItemStatus.NEW);
          const longestCookItem = pendingItems.sort((a, b) => 
            (b.cookSeconds || b.menuItem?.prep_seconds || 0) - 
            (a.cookSeconds || a.menuItem?.prep_seconds || 0)
          )[0];

          if (longestCookItem && longestCookItem.id === item.id) {
            itemStyle = "bg-white border-2 border-blue-500 shadow-md";
          }
        }

        // Cook timer badge content
        const getCookingTimerDisplay = () => {
          if (item.status !== OrderItemStatus.COOKING || !item.firedAt) return null;

          const totalCookSeconds = item.cookSeconds || item.menuItem?.prep_seconds || 0;
          const firedTime = new Date(item.firedAt).getTime();
          const currentItemTime = new Date().getTime();
          const elapsedSeconds = Math.floor((currentItemTime - firedTime) / 1000);
          const remainingSeconds = Math.max(0, totalCookSeconds - elapsedSeconds);
          const minutes = Math.floor(remainingSeconds / 60);
          const seconds = remainingSeconds % 60;
          const isCriticallyLate = elapsedSeconds > totalCookSeconds * 1.2;

          if (remainingSeconds <= 0) {
            // Ready to check
            return (
              <div className="absolute -top-2 right-2 flex items-center gap-1">
                <div className="bg-green-500 text-white px-2 py-0.5 text-xs font-bold rounded shadow-sm animate-pulse">
                  READY TO CHECK
                </div>
                {isCriticallyLate && !acknowledgedItems[item.id] && (
                  <button 
                    className="bg-red-700 text-white px-2 py-0.5 text-xs font-bold rounded shadow-sm hover:bg-red-800"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAcknowledgeItem(item.id);
                    }}
                  >
                    ✓
                  </button>
                )}
              </div>
            );
          } else if (remainingSeconds < 30) {
            return (
              <div className="absolute -top-2 right-2 bg-green-600 text-white px-2 py-0.5 text-xs font-bold rounded shadow-sm">
                {minutes}:{seconds.toString().padStart(2, '0')}
              </div>
            );
          } else if (remainingSeconds < 60) {
            return (
              <div className="absolute -top-2 right-2 bg-amber-500 text-white px-2 py-0.5 text-xs font-bold rounded shadow-sm">
                {minutes}:{seconds.toString().padStart(2, '0')}
              </div>
            );
          } else {
            return (
              <div className="absolute -top-2 right-2 bg-blue-500 text-white px-2 py-0.5 text-xs font-bold rounded shadow-sm">
                {minutes}:{seconds.toString().padStart(2, '0')}
              </div>
            );
          }
        };

        // "Next up" badge for NEW items
        const getNextUpBadge = () => {
          if (item.status !== OrderItemStatus.NEW) return null;

          const pendingItems = orderDetails.items.filter(i => i.status === OrderItemStatus.NEW);
          const longestCookItem = pendingItems.sort((a, b) => 
            (b.cookSeconds || b.menuItem?.prep_seconds || 0) - 
            (a.cookSeconds || a.menuItem?.prep_seconds || 0)
          )[0];

          if (longestCookItem && longestCookItem.id === item.id) {
            return (
              <div className="absolute -top-2 -left-2 bg-blue-500 text-white px-2 py-0.5 text-xs font-bold rounded shadow-sm">
                NEXT UP
              </div>
            );
          }

          return null;
        };

        return (
          <div 
            key={item.id}
            className={cn("p-3 rounded-md relative", itemStyle, borderAccent)}
          >
            {/* Next up badge */}
            {getNextUpBadge()}

            {/* Cooking timer badge */}
            {getCookingTimerDisplay()}

            <div className="flex items-start mt-1">
              {/* Status checkbox */}
              <div className="mr-2 flex-shrink-0 mt-0.5">
                {item.status === OrderItemStatus.DELIVERED ? (
                  <div className="w-5 h-5 bg-purple-100 rounded-full flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-purple-600" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                ) : item.status === OrderItemStatus.READY ? (
                  <Checkbox
                    className="w-5 h-5 data-[state=checked]:bg-green-500 border-green-300 bg-green-100"
                    checked={true} 
                    onCheckedChange={(checked) => toggleItemCompletion(item.id, checked as boolean, item.status || undefined)}
                  />
                ) : item.status === OrderItemStatus.PLATING ? (
                  <Checkbox
                    className="w-5 h-5 data-[state=checked]:bg-green-500 border-purple-300 bg-purple-100"
                    checked={false}
                    onCheckedChange={(checked) => toggleItemCompletion(item.id, checked as boolean, item.status || undefined)}
                  />
                ) : item.status === OrderItemStatus.COOKING ? (
                  <Checkbox
                    className="w-5 h-5 data-[state=checked]:bg-purple-500 border-amber-300 bg-amber-100"
                    checked={false}
                    onCheckedChange={(checked) => toggleItemCompletion(item.id, checked as boolean, item.status || undefined)}
                  />
                ) : (
                  <Checkbox
                    className="w-5 h-5 data-[state=checked]:bg-amber-500 border-blue-300 bg-blue-100"
                    checked={false}
                    onCheckedChange={(checked) => toggleItemCompletion(item.id, checked as boolean, item.status || undefined)}
                  />
                )}
              </div>

              {/* Item details */}
              <div className="flex-1 min-w-0">
                {/* Item name and quantity */}
                <div className="flex items-center text-sm font-medium mb-0.5">
                  <span className="truncate mr-1.5">{item.menuItem?.name || "Unknown Item"}</span>
                  {item.quantity > 1 && (
                    <span className="bg-neutral-100 px-1.5 py-0.5 text-xs rounded-full text-neutral-700 flex-shrink-0">
                      x{item.quantity}
                    </span>
                  )}
                </div>

                {/* Customizations */}
                {item.customizations && item.customizations.length > 0 && (
                  <div className="text-xs bg-blue-50 p-1.5 rounded mt-1 border border-blue-200">
                    <div className="font-medium text-blue-700 mb-0.5">Customizations:</div>
                    <ul className="space-y-0.5">
                      {item.customizations.map((customization: any, idx: number) => (
                        <li key={idx} className="text-blue-800">
                          <span className="font-medium">{customization.categoryName}:</span> {customization.options.map((opt: any) => opt.name).join(', ')}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Notes */}
                {item.notes && (
                  <div className="text-xs bg-amber-50 p-1.5 rounded mt-1 border border-amber-200">
                    <div className="font-medium text-amber-700 mb-0.5">Special Instructions:</div>
                    <div className="text-amber-800 italic">{item.notes}</div>
                  </div>
                )}

                {/* Cook time */}
                <div className="text-xs text-neutral-500 mt-1">
                  {(() => {
                    const totalSeconds = item.cookSeconds || item.menuItem?.prep_seconds || 0;
                    const minutes = Math.floor(totalSeconds / 60);
                    const displayMinutes = minutes === 0 && totalSeconds > 0 ? 1 : minutes;
                    return `Cook time: ${displayMinutes}m`;
                  })()}
                </div>
              </div>

              {/* Item status */}
              <div className="ml-2 flex-shrink-0">
                {item.firedAt && (
                  <div className="text-[10px] text-neutral-500 whitespace-nowrap">
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
        );
      })}
    </div>
  );
}

// Component to show order progress
function OrderProgress({ orderId }: { orderId: string }) {
  const { data: orderDetails } = useQuery<OrderWithItems | null>({
    queryKey: ["/api/order", orderId],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", `/api/order/${orderId}`);
        return await response.json() as OrderWithItems;
      } catch (error) {
        return null;
      }
    },
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });

  if (!orderDetails?.items) {
    return <span>Loading...</span>;
  }

  const totalItems = orderDetails.items.length;
  const readyItems = orderDetails.items.filter(i => 
    i.status === OrderItemStatus.READY || i.status === OrderItemStatus.DELIVERED
  ).length;

  return (
    <span className={cn(
      "font-medium",
      orderDetails.isDelayed ? "text-red-600" : "text-neutral-600"
    )}>
      {orderDetails.status === OrderStatus.READY ? (
        <span className="flex items-center text-green-600">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          Ready To Serve
        </span>
      ) : (
        <span>
          {readyItems} of {totalItems} items ready
        </span>
      )}
    </span>
  );
}