# SwingEats Order Status Issue: SERVED to CLOSED Transition Bug

## Issue Description
When an order transitions from SERVED to CLOSED status, the following issues occur:
1. UI flashes
2. CLOSED orders don't appear in the CLOSED tab
3. The order disappears completely from the view

## Key Components

### Client-side code:

#### 1. KitchenOrderGrid.tsx - closeOrder function
```typescript
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
```

#### 2. ServerView.tsx - closeOrder function
```typescript
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
```

#### 3. WebSocket message handling in KitchenView.tsx (recently fixed)
```typescript
// Handle WebSocket messages
useEffect(() => {
  if (lastMessage?.type === 'ordersUpdate') {
    const updatedOrders = lastMessage.data as OrderSummary[];
    
    // Store current order IDs before updating data
    const currentOrderIds = new Set(orders?.map(order => order.id) || []);
    
    // Update the query data
    queryClient.setQueryData(['/api/orders'], updatedOrders);
    
    // Find truly new orders by checking for IDs that didn't exist before
    const newOrders = updatedOrders.filter(order => 
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
}, [lastMessage, queryClient, orders, toast]);
```

### Server-side code:

#### 1. routes.ts - Order close endpoint
```typescript
app.post('/api/order/:id/close', async (req: Request, res: Response) => {
  try {
    const orderId = req.params.id;
    const updatedOrder = await storage.updateOrderStatus(orderId, 'CLOSED');

    if (updatedOrder) {
      const orderUpdatedMessage: OrderUpdatedMessage = {
        type: 'ordersUpdate',
        data: await storage.getOrders()
      };

      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(orderUpdatedMessage));
        }
      });

      res.json(updatedOrder);
    } else {
      res.status(404).send('Order not found');
    }
  } catch (error) {
    console.error('Error closing order:', error);
    res.status(500).send('Error closing order');
  }
});
```

#### 2. db-storage.ts - updateOrderStatus & getOrders
```typescript
async getOrdersByStatus(status: string): Promise<OrderSummary[]> {
  try {
    // This function specifically pulls orders by status
    const orders = await db.select().from(orders).where(eq(orders.status, status.toUpperCase()));
    
    // Fetch detailed order information for each order
    return Promise.all(orders.map(async order => {
      // Get items for this order
      const items = await this.getOrderItems(order.id);
      // Create a summary with items and other metadata
      return {
        ...order,
        items,
        orderNumber: this.generateOrderNumber(order.id),
        displayName: await this.getBayDisplayName(order.bayId),
        // Other fields...
      };
    }));
  } catch (error) {
    console.error('Error getting orders by status:', error);
    return [];
  }
}

// This function gets called when fetching orders for clients
async getActiveOrders(): Promise<OrderSummary[]> {
  try {
    // This function pulls all orders, including CLOSED ones
    const ordersData = await db.select().from(orders);
    
    // Calculate summaries as before
    return Promise.all(ordersData.map(async order => {
      // Order processing logic...
    }));
  } catch (error) {
    console.error('Error fetching active orders:', error);
    return [];
  }
}
```

## Recent Fixes

1. Fixed WebSocket message handling to prevent false "new order placed" messages by comparing order IDs instead of just counts.

2. Updated order status styling to use blue for SERVED and gray for CLOSED orders.

## Remaining Issues

1. CLOSED orders don't appear in the CLOSED tab despite being in the database.

2. When transitioning from SERVED to CLOSED, UI shows a brief flash and then the order disappears.

## Questions for Investigation

1. Are CLOSED orders included in the query results from the database?

2. Is the filteredOrders function in KitchenView.tsx/ServerView.tsx correctly handling CLOSED status?

3. Is there a race condition between WebSocket updates and React Query invalidation?

4. Does the UI correctly handle the transition between tabs when an order status changes?