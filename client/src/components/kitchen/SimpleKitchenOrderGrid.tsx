import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TimerPill } from "@/components/ui/timer-badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { OrderSummary, OrderWithItems, OrderItemStatus, OrderStatus } from "@shared/schema";

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
          [...orders].sort((a, b) => {
            const statusPriority: Record<string, number> = {
              [OrderStatus.NEW]: 0,
              [OrderStatus.COOKING]: 10,
              [OrderStatus.PLATING]: 20,
              [OrderStatus.READY]: 30,
              [OrderStatus.SERVED]: 40,
              [OrderStatus.CLOSED]: 50,
              [OrderStatus.CANCELLED]: 60
            };
            return (statusPriority[a.status] ?? 100) - (statusPriority[b.status] ?? 100);
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
              .sort((a, b) => {
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
                  className={cn(
                    "flex justify-between p-2 mb-2 border-b",
                    item.status === OrderItemStatus.COOKING && "border-l-2 border-l-yellow-500",
                    item.status === OrderItemStatus.PLATING && "border-l-2 border-l-purple-500",
                    item.status === OrderItemStatus.READY && "border-l-2 border-l-green-500"
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
                        <span className="text-sm font-medium">{item.quantity}x {item.menuItem?.name}</span>
                        
                        {/* Timer for cooking items */}
                        {item.status === OrderItemStatus.COOKING && item.firedAt && (
                          <TimerPill 
                            firedAt={item.firedAt}
                            cookSeconds={item.cookSeconds || item.menuItem?.prep_seconds || 0}
                            status={item.status}
                            compact={true}
                          />
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