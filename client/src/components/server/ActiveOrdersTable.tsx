import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { OrderStatusBadge } from "@/components/ui/order-status-badge";
import { ElapsedClock } from "@/components/ui/ElapsedClock";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { OrderSummary, OrderWithItems, SeatingType } from "@shared/schema";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Utensils, DollarSign, CheckSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActiveOrdersTableProps {
  orders: OrderSummary[];
  statusFilter?: string;
}

export default function ActiveOrdersTable({ orders, statusFilter }: ActiveOrdersTableProps) {
  const [selectedOrder, setSelectedOrder] = useState<OrderSummary | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const { toast } = useToast();
  
  // Get order details with items
  const { data: orderDetails, isLoading: isLoadingDetails } = useQuery<OrderWithItems | null>({
    queryKey: ["/api/order", selectedOrder?.id],
    queryFn: async () => {
      if (!selectedOrder) return null;
      try {
        console.log(`Fetching order details for order ${selectedOrder.id}`);
        const response = await apiRequest("GET", `/api/order/${selectedOrder.id}`);
        const data = await response.json();
        return data as OrderWithItems;
      } catch (error) {
        console.error(`Error fetching order details:`, error);
        return null;
      }
    },
    enabled: !!selectedOrder && !!selectedOrder.id,
  });
  
  const handleViewDetails = (order: OrderSummary) => {
    setSelectedOrder(order);
    setDetailsOpen(true);
  };
  
  const handleAlert = (order: OrderSummary) => {
    setSelectedOrder(order);
    setAlertOpen(true);
  };
  
  const markAsServed = async (orderId: string) => {
    try {
      await changeStatus(orderId, 'SERVED');
      
      toast({
        title: "Delivered!",
        description: "Order has been marked as served.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update order status.",
        variant: "destructive",
      });
    }
  };
  
  const queryClient = useQueryClient();
  
  const closeOrder = async (orderId: string) => {
    try {
      await apiRequest('POST', `/api/order/${orderId}/close`);
      
      toast({
        title: "Ticket Closed",
        description: "Order has been marked as closed.",
      });
      
      // Force refetch orders to update counts
      setTimeout(() => {
        // Give the server time to update
        queryClient.invalidateQueries(['/api/orders']);
      }, 300);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to close the order.",
        variant: "destructive",
      });
    }
  };
  
  const sendAlert = async () => {
    if (!selectedOrder) return;
    
    try {
      // In a real system, this would notify the kitchen
      toast({
        title: "Alert Sent",
        description: `Alert sent to kitchen for order #${selectedOrder.orderNumber}.`,
      });
      setAlertOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send alert.",
        variant: "destructive",
      });
    }
  };
  
  // Generic function to change order status
  const changeStatus = async (orderId: string, newStatus: string) => {
    try {
      await apiRequest('PUT', `/api/order/${orderId}/status`, { status: newStatus.toLowerCase() });
      
      // Generic status update toast for any other status
      toast({
        title: "Status Updated",
        description: `Order has been marked as ${newStatus.toLowerCase()}.`,
      });
      
      return true;
    } catch (error) {
      console.error("Error changing status:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to update order to ${newStatus.toLowerCase()} status.`,
      });
      return false;
    }
  };
  
  // Helper to determine status display
  const getOrderStatus = (order: OrderSummary) => {
    if (order.isDelayed) return "delayed";
    
    // Convert status to lowercase to match our statusConfig keys
    const status = order.status.toLowerCase();
    
    // Map to our known statuses in simplified workflow
    if (status === 'new') return 'new';
    if (status === 'cooking') return 'cooking';
    if (status === 'plating') return 'plating';
    if (status === 'ready') return 'ready';
    if (status === 'served') return 'served';
    if (status === 'closed') return 'closed';
    if (status === 'cancelled') return 'cancelled';
    
    // For backward compatibility with older status values
    if (status === 'pending') return 'new';
    if (status === 'preparing') return 'cooking';
    
    return status;
  };
  
  // Helper to determine row styling based on order status
  const getRowClass = (order: OrderSummary) => {
    const status = order.status.toUpperCase();
    
    if (status === "SERVED") {
      return "border-l-4 border-gray-400 opacity-70"; // Served orders are dimmed
    }
    
    if (status === "CLOSED") {
      return "border-l-4 border-gray-600 opacity-50"; // Closed orders are even more dimmed
    }
    
    if (order.isDelayed) {
      return "animate-pulse border-l-4 border-red-500";
    }
    
    if (status === "NEW") {
      return "border-l-4 border-blue-400";
    } else if (status === "COOKING") {
      return "border-l-4 border-amber-400";
    } else if (status === "PLATING") {
      return "border-l-4 border-purple-400"; // Changed from orange to purple for plating
    } else if (status === "READY") {
      return "border-l-4 border-green-500";
    }
    
    return "";
  };
  
  // Helper to format bay display name based on seating type
  const getBayDisplayName = (order: OrderSummary): string => {
    if (!order.seatingType) {
      return `Bay ${order.bayNumber || order.bayId}`;
    }
    
    const bayNum = order.bayNumber || order.bayId;
    const shortNum = bayNum % 100; // Get the last 2 digits for cleaner display
    
    switch (order.seatingType) {
      case SeatingType.BAY:
        return `Bay ${bayNum}`;
      case SeatingType.BAR_LEFT:
        return `Bar L${shortNum}`;
      case SeatingType.BAR_RIGHT:
        return `Bar R${shortNum}`;
      case SeatingType.TABLE:
        return `Table ${shortNum}`;
      default:
        return `Bay ${bayNum}`;
    }
  };
  
  // Determine the title based on the status filter
  const getTableTitle = (): string => {
    if (statusFilter === "SERVED") {
      return "Served Orders";
    }
    if (statusFilter === "CLOSED") {
      return "Closed Orders";
    }
    if (statusFilter === "COMPLETE") {
      return "Completed Orders";
    }
    return "Active Orders";
  };

  return (
    <div className="fiveofour-card p-4">
      <h2 className="font-poppins font-semibold text-lg mb-4">{getTableTitle()}</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-neutral-200">
          <thead>
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Bay</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Order ID</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Items</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Time</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {orders.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-neutral-500">
                  No active orders at this time
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id} className={getRowClass(order)}>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-medium">
                      {order.displayName || getBayDisplayName(order)}
                    </span>
                    <span className="block text-xs text-neutral-500">Floor {order.floor}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">#{order.orderNumber}</td>
                  <td className="px-4 py-3">
                    <span className="text-sm">{order.totalItems} items</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <OrderStatusBadge status={getOrderStatus(order)} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <ElapsedClock 
                      createdAt={order.createdAt}
                    />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex space-x-2">
                      <button 
                        className="p-1 text-neutral-600 hover:text-primary"
                        onClick={() => handleViewDetails(order)}
                        title="View Details"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                          <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                      </button>
                      {/* Contextual action buttons based on order status */}
                      {order.status.toUpperCase() === 'READY' ? (
                        <button 
                          className="p-1 text-success hover:text-primary"
                          onClick={() => markAsServed(order.id)}
                          title="Serve Order"
                        >
                          <Utensils size={16} />
                        </button>
                      ) : order.status.toUpperCase() === 'SERVED' ? (
                        <button 
                          className="p-1 text-neutral-600 hover:text-primary"
                          onClick={() => closeOrder(order.id)}
                          title="Close Order"
                        >
                          <DollarSign size={16} />
                        </button>
                      ) : order.status.toUpperCase() === 'CLOSED' ? (
                        <button className="p-1 text-neutral-400 cursor-not-allowed" title="Order closed">
                          <CheckSquare size={16} />
                        </button>
                      ) : (
                        <button className="p-1 text-neutral-400 cursor-not-allowed" title={`Cannot progress - ${order.status} state`}>
                          <Utensils size={16} />
                        </button>
                      )}
                      <button 
                        className="p-1 text-neutral-600 hover:text-danger"
                        onClick={() => handleAlert(order)}
                        title="Send Alert"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"></circle>
                          <line x1="12" y1="8" x2="12" y2="12"></line>
                          <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {/* Order Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
            <DialogDescription>View the complete details for this order</DialogDescription>
          </DialogHeader>
          
          {selectedOrder && (
            <div className="space-y-4 mt-2">
              <div className="flex justify-between">
                <div>
                  <div className="text-sm text-neutral-500">Order ID</div>
                  <div className="font-medium">#{selectedOrder.orderNumber}</div>
                </div>
                <div>
                  <div className="text-sm text-neutral-500">Location</div>
                  <div className="font-medium">
                    {selectedOrder.displayName || getBayDisplayName(selectedOrder)} (Floor {selectedOrder.floor})
                  </div>
                </div>
                <div>
                  <div className="text-sm text-neutral-500">Status</div>
                  <OrderStatusBadge status={getOrderStatus(selectedOrder)} />
                </div>
              </div>
              
              <div>
                <div className="text-sm text-neutral-500">Time Elapsed</div>
                <div className="font-medium">
                  <ElapsedClock createdAt={selectedOrder.createdAt} />
                </div>
              </div>
              
              <div className="border-t pt-4">
                <div className="mb-2">
                  <div className="text-sm font-medium mb-2">Order Items</div>
                  
                  {isLoadingDetails ? (
                    <div className="flex items-center justify-center p-4">
                      <svg className="animate-spin h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </div>
                  ) : orderDetails?.items && orderDetails.items.length > 0 ? (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {orderDetails.items.map((item) => (
                        <div 
                          key={item.id} 
                          className="flex flex-col p-2 bg-neutral-50 rounded-md"
                        >
                          <div className="flex justify-between w-full">
                            <div className="flex-1">
                              <div className="font-medium">
                                {item.quantity}x {item.menuItem?.name || 'Unknown Item'}
                              </div>
                              <div className="text-xs text-neutral-500">
                                Station: {item.menuItem?.station || item.station || 'Unknown'}
                              </div>
                              
                              {/* Display item notes if available */}
                              {item.notes && (
                                <div className="text-xs italic mt-1 p-1 bg-neutral-100 rounded">
                                  <span className="font-medium">Notes:</span> {item.notes}
                                </div>
                              )}
                            </div>
                            <div className="text-right">
                              <div className="font-medium">
                                ${((item.price_cents || item.menuItem?.price_cents || 0) / 100).toFixed(2)}
                              </div>
                              <div className="text-xs text-neutral-500">
                                {item.status || 'NEW'}
                              </div>
                            </div>
                          </div>
                          
                          {/* Display customizations if available */}
                          {item.customizations && item.customizations.length > 0 && (
                            <div className="text-xs bg-blue-50 p-2 rounded mt-1 border border-blue-200">
                              <div className="font-medium text-blue-700 border-b border-blue-100 pb-1 mb-1">Customizations:</div>
                              <ul className="list-disc list-inside text-blue-800">
                                {item.customizations.map((customization, idx) => (
                                  <li key={idx} className="pl-1 mb-1">
                                    <span className="font-medium">{customization.categoryName}:</span> {customization.options.map(opt => opt.name).join(', ')}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-neutral-500 text-center p-4">
                      No items found
                    </div>
                  )}
                </div>
                
                {/* Special instructions have been moved to item level notes and customizations */}
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setDetailsOpen(false)}>
                  Close
                </Button>
                {selectedOrder.status.toUpperCase() === 'READY' ? (
                  <Button 
                    onClick={() => markAsServed(selectedOrder.id)}
                    className="bg-primary hover:bg-primary-dark"
                  >
                    Mark as Served
                  </Button>
                ) : selectedOrder.status.toUpperCase() === 'SERVED' ? (
                  <Button 
                    onClick={() => {
                      closeOrder(selectedOrder.id);
                      setDetailsOpen(false);
                    }}
                    className="bg-primary hover:bg-primary-dark"
                  >
                    Close Order
                  </Button>
                ) : selectedOrder.status.toUpperCase() === 'CLOSED' ? (
                  <div className="text-sm text-gray-500 italic flex items-center">
                    <CheckSquare size={16} className="mr-1 text-gray-500" />
                    Order Closed
                  </div>
                ) : null}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Alert Dialog */}
      <Dialog open={alertOpen} onOpenChange={setAlertOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send Alert to Kitchen</DialogTitle>
            <DialogDescription>Alert the kitchen staff about this order</DialogDescription>
          </DialogHeader>
          
          {selectedOrder && (
            <div className="space-y-4 mt-2">
              <p>
                Are you sure you want to send an alert to the kitchen for order 
                #{selectedOrder.orderNumber} at {selectedOrder.displayName || getBayDisplayName(selectedOrder)}?
              </p>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setAlertOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={sendAlert}
                  variant="destructive"
                >
                  Send Alert
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* One-click serving - no ServerFlowDialog needed */}
    </div>
  );
}
