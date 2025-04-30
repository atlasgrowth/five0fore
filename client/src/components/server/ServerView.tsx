import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import BaySelection from "./BaySelection";
import ActiveOrdersTable from "./ActiveOrdersTable";
import SimpleOrderDrawer from "./SimpleOrderDrawer";
import BayTabs from "./BayTabs";
import { useWebSocket } from "@/hooks/use-websocket";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Bell, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OrderSummary } from "@shared/schema";

export default function ServerView() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { lastMessage } = useWebSocket();
  const [serverName, setServerName] = useState("Alex Johnson");
  const [drawer, setDrawer] = useState<{ open: boolean, bayId: number | null, viewExistingOrders: boolean }>({ 
    open: false, 
    bayId: null,
    viewExistingOrders: false 
  });
  const [statusFilter, setStatusFilter] = useState("COMPLETE"); // Default to COMPLETE tab to see past orders

  // Get active orders
  const { data: orders = [], isLoading: ordersLoading } = useQuery<OrderSummary[]>({
    queryKey: ['/api/orders'],
  });
  
  // Also explicitly query for bays to ensure we have the latest data
  const { data: bays = [] } = useQuery({
    queryKey: ['/api/bays'],
  });

  // Handle WebSocket messages
  useEffect(() => {
    if (lastMessage?.type === 'ordersUpdate') {
      const ordersData = lastMessage.data as OrderSummary[];
      
      // Store current order IDs before updating data
      const currentOrderIds = new Set(orders?.map(order => order.id) || []);
      
      // Update the query data
      queryClient.setQueryData(['/api/orders'], ordersData);
      
      // Find truly new orders by checking for IDs that didn't exist before
      const newOrders = ordersData.filter(order => 
        !currentOrderIds.has(order.id) && order.status === 'NEW'
      );
      
      // Only notify for actual new orders, not status changes
      if (newOrders.length > 0) {
        toast({
          title: 'New Order Received',
          description: `A new order has been placed.`,
        });
      }
    } 
    // Handle closed orders update message
    else if (lastMessage?.type === 'closedOrdersUpdate') {
      // Update the query cache with the latest orders
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      
      // No need to show a notification for closed orders updates
      // as they are shown in the CLOSED tab
    }
    // Handle single order closed message
    else if (lastMessage?.type === 'ORDER_CLOSED') {
      // Invalidate the orders query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      
      // Optionally show a toast notification
      toast({
        title: 'Order Closed',
        description: `Order #${lastMessage.data.id} has been closed.`,
      });
    }
    // Handle bay updated message
    else if (lastMessage?.type === 'bay_updated') {
      console.log('Bay updated in ServerView:', lastMessage.data.bay);
      
      // Update the bays cache directly
      queryClient.setQueryData(['/api/bays'], (oldData: any[] | undefined) => {
        if (!oldData) return oldData;
        return oldData.map(bay => 
          bay.id === lastMessage.data.bay.id ? lastMessage.data.bay : bay
        );
      });
      
      // Also invalidate bays query to ensure a refresh
      queryClient.invalidateQueries({ queryKey: ['/api/bays'] });
    }
  }, [lastMessage, queryClient, orders, toast]);

  // Count alerts/flagged orders
  const alertCount = orders.filter(order => order.isDelayed).length || 0;

  // Handle tab change and filter orders based on status
  const handleTabChange = (tab: string) => {
    setStatusFilter(tab);
  };

  // Filter orders based on the selected tab
  const filteredOrders = orders.filter(order => {
    const orderStatus = order.status.toUpperCase();
    
    // For the COMPLETE tab, show SERVED and CLOSED orders in our simplified workflow
    if (statusFilter === 'COMPLETE') {
      return ['SERVED', 'CLOSED'].includes(orderStatus);
    }
    
    // For specific tab for completed status
    if (statusFilter === 'SERVED') {
      return orderStatus === 'SERVED';
    }
    
    // For CLOSED tab
    if (statusFilter === 'CLOSED') {
      return orderStatus === 'CLOSED';
    }
    
    // Special filter for delayed orders
    if (statusFilter === 'DELAYED') {
      return order.isDelayed;
    }
    
    // For NEW tab, show only NEW orders 
    if (statusFilter === 'NEW') {
      return orderStatus === 'NEW';
    }
    
    // For ALL tab, show all active orders (NEW, COOKING, PLATING, READY, SERVED)
    // but exclude CLOSED and CANCELLED
    if (statusFilter === 'ALL') {
      return !['CLOSED', 'CANCELLED'].includes(orderStatus);
    }
    
    // Default: match by status
    return orderStatus === statusFilter;
  });

  // Find active orders for a specific bay
  const findActiveBayOrders = (bayId: number) => {
    if (!orders) return [];
    
    // Debugging to help us understand what's happening with orders
    console.log(`Checking orders for bay ${bayId}:`, 
      orders.filter(order => order.bayId === bayId)
        .map(o => ({ id: o.id, status: o.status, bayId: o.bayId }))
    );
    
    // Filter for active orders (anything that's not CLOSED or CANCELLED)
    return orders.filter(order => 
      order.bayId === bayId && 
      !['CLOSED', 'CANCELLED'].includes(order.status.toUpperCase())
    );
  };

  const toggleNewOrderDrawer = () => {
    console.log("Opening new order drawer");
    setDrawer({ open: !drawer.open, bayId: null, viewExistingOrders: false });
  };
  
  // Handle bay click - check if there are active orders for this bay
  const handleBayClick = (bayId: number) => {
    const activeOrders = findActiveBayOrders(bayId);
    console.log(`Bay ${bayId} has ${activeOrders.length} active orders`);
    
    // Get bay from cache to check its status
    const bay = bays.find(b => b.id === bayId);
    console.log(`Bay ${bayId} status:`, bay?.status);
    
    // Check bay status - if not empty/available, assume it has active orders
    // This makes the system more robust if the orders data is somehow out of sync
    const hasActiveOrders = activeOrders.length > 0 || 
      (bay && bay.status && !['empty', 'available'].includes(bay.status.toLowerCase()));
    
    if (hasActiveOrders) {
      // Bay has active orders - show order details
      console.log(`Showing existing orders for bay ${bayId}`);
      setDrawer({ open: true, bayId, viewExistingOrders: true });
    } else {
      // No active orders - show new order form
      console.log(`Showing new order form for bay ${bayId}`);
      setDrawer({ open: true, bayId, viewExistingOrders: false });
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8 bg-white p-6 rounded-xl shadow-md border-l-4 border-primary">
        <div>
          <h1 className="font-poppins font-bold text-3xl text-primary">Five O Four Golf</h1>
          <p className="text-neutral-600 mt-1">Server: <span className="font-semibold text-neutral-800">{serverName}</span></p>
        </div>
        <div className="flex items-center space-x-4">
          <button 
            className="px-4 py-2.5 bg-white border border-neutral-300 rounded-lg flex items-center text-neutral-700 hover:bg-neutral-50 transition-colors shadow-sm"
            onClick={() => alert("Alert view not implemented yet")}
          >
            <Bell className="h-4 w-4 mr-2" />
            <span>Alerts</span>
            {alertCount > 0 && (
              <span className="ml-2 bg-danger text-white text-xs px-2 py-0.5 rounded-full">{alertCount}</span>
            )}
          </button>
          <button 
            className="px-4 py-2.5 bg-primary text-white rounded-lg flex items-center hover:brightness-110 transition-all shadow-md"
            onClick={toggleNewOrderDrawer}
          >
            <Plus className="h-4 w-4 mr-2" />
            <span>New Order</span>
          </button>
        </div>
      </div>
      
      {/* Bay Selection */}
      <BaySelection 
        onBayClick={handleBayClick}
      />
      
      {/* Status Tabs and Active Orders Table */}
      {ordersLoading ? (
        <div className="bg-white rounded-lg shadow-md p-4">
          <h2 className="font-poppins font-semibold text-lg mb-4">Active Orders</h2>
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <div>
          {/* Status filter tabs */}
          <BayTabs orders={orders} onTabChange={handleTabChange} />
          
          {/* Table with filtered orders */}
          <ActiveOrdersTable orders={filteredOrders} statusFilter={statusFilter} />
        </div>
      )}
      
      {/* Order Drawer - shows existing orders or new order form */}
      <SimpleOrderDrawer 
        open={drawer.open} 
        onOpenChange={(open) => setDrawer({ ...drawer, open })} 
        bayId={drawer.bayId}
        viewExistingOrders={drawer.viewExistingOrders}
      />
    </div>
  );
}
