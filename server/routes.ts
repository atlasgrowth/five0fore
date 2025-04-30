import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { 
  insertOrderSchema, type Cart, OrderItemStatus, OrderStatus, orders
} from "@shared/schema";
import {
  WebSocketMessage, WebSocketMessageType, 
  OrderCreatedMessage, OrderUpdatedMessage, OrderItemUpdatedMessage,
  ClientRegistrationMessage, BayUpdatedMessage,
  ItemCookingMessage, ItemPlatingMessage, ItemReadyMessage, ItemDeliveredMessage
} from "@shared/types";
import { 
  toMenuItemDTO, toOrderDTO, toOrderItemDTO, toBayDTO, toCategoryDTO 
} from "./dto";
import { 
  registerClient, removeClient, getClients,
  broadcastUpdate, sendBayUpdate, sendStationUpdate 
} from './ws';
import { startKitchenTimers } from './timers';

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Create WebSocket server
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  wss.on('connection', (ws) => {
    const clientId = Math.random().toString(36).substring(2, 15);
    
    // Register the client with just the WebSocket initially
    registerClient(clientId, ws);
    
    // Send initial data
    storage.getActiveOrders().then(orders => {
      const message: WebSocketMessage = { 
        type: 'ordersUpdate', 
        data: orders 
      };
      ws.send(JSON.stringify(message));
    });
    
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString()) as WebSocketMessage;
        
        // Handle client registration with enhanced data
        if (data.type === 'register') {
          const registerData = data as ClientRegistrationMessage;
          const clientType = registerData.data.clientType;
          const bayId = registerData.data.bayId;
          const station = registerData.data.station; // For kitchen display filtering
          const floor = registerData.data.floor; // For server floor filtering
          
          // Re-register the client with complete info
          registerClient(clientId, ws, clientType, bayId, station, floor);
          
          // Auto-subscribe guests and servers to their bay
          if (bayId && (clientType === 'guest' || clientType === 'server')) {
            // Send current bay orders
            const bay = await storage.getBayById(bayId);
            if (bay) {
              const orders = await storage.getOrdersByBayId(bayId);
              const bayMessage: BayUpdatedMessage = {
                type: 'bay_updated',
                data: { 
                  bay: toBayDTO(bay), 
                  orders: orders.map(toOrderDTO),
                  status: bay.status
                }
              };
              ws.send(JSON.stringify(bayMessage));
            }
          }
          
          // For kitchen clients, send items for their station
          if (clientType === 'kitchen' && station) {
            try {
              // Get items for this station
              const items = await storage.getOrderItemsByStation(
                station, 
                station !== '*' ? undefined : undefined // If station is *, don't filter by status
              );
              
              // Group items by status
              const newItems = items.filter(item => item.status === OrderItemStatus.NEW);
              const cookingItems = items.filter(item => item.status === OrderItemStatus.COOKING);
              const readyItems = items.filter(item => item.status === OrderItemStatus.READY);
              
              // Send the station items to the kitchen client
              const stationMessage: WebSocketMessage = {
                type: 'ordersUpdate',
                data: {
                  station,
                  new: newItems.map(toOrderItemDTO),
                  cooking: cookingItems.map(toOrderItemDTO),
                  ready: readyItems.map(toOrderItemDTO)
                }
              };
              
              ws.send(JSON.stringify(stationMessage));
            } catch (error) {
              console.error(`Error sending station items for ${station}:`, error);
            }
          }
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    });
    
    ws.on('close', () => {
      removeClient(clientId);
    });
  });
  
  // Start background timer for automatic item status updates
  startKitchenTimers();
  
  // API Routes - prefix all with /api
  app.get('/api/menu', async (_req: Request, res: Response) => {
    try {
      console.log('Fetching menu data...');
      const categories = await storage.getCategories();
      console.log(`Found ${categories.length} categories`);
      
      const menuItems = await storage.getMenuItems();
      console.log(`Found ${menuItems.length} menu items`);
      
      // Group menu items by category
      const menu = categories.map(category => {
        const items = menuItems
          .filter(item => item.category === category.name)
          .map(item => {
            try {
              return toMenuItemDTO(item);
            } catch (err) {
              console.error(`Error converting menu item ${item.id}:`, err);
              // Return default item with customizable flag if conversion fails
              return {
                id: item.id,
                name: item.name || 'Unknown Item',
                description: item.description || null,
                category: item.category || 'Other',
                priceCents: typeof item.price_cents === 'number' ? item.price_cents : 0,
                prepSeconds: typeof item.prep_seconds === 'number' ? item.prep_seconds : 300,
                station: item.station || 'Kitchen',
                imageUrl: item.image_url || null,
                active: typeof item.active === 'boolean' ? item.active : true,
                customizable: false
              };
            }
          });
        
        return { 
          category: toCategoryDTO(category), 
          items 
        };
      });
      
      res.json(menu);
    } catch (error) {
      console.error('Error fetching menu:', error);
      res.status(500).json({ 
        message: 'Failed to fetch menu', 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });
  
  app.get('/api/menu/:categorySlug', async (req: Request, res: Response) => {
    try {
      console.log(`Fetching menu items for category: ${req.params.categorySlug}`);
      const categories = await storage.getCategories();
      const category = categories.find(c => c.slug === req.params.categorySlug);
      
      if (!category) {
        console.log(`Category not found: ${req.params.categorySlug}`);
        return res.status(404).json({ message: 'Category not found' });
      }
      
      console.log(`Found category: ${category.name} (id: ${category.id})`);
      const items = await storage.getMenuItemsByCategory(category.id);
      console.log(`Found ${items.length} items in category ${category.name}`);
      
      const mappedItems = items.map(item => {
        try {
          return toMenuItemDTO(item);
        } catch (err) {
          console.error(`Error mapping menu item ${item.id}:`, err);
          // Provide a fallback item with all required fields
          return {
            id: item.id,
            name: item.name || 'Unknown Item',
            description: item.description || null,
            category: item.category || 'Other',
            priceCents: typeof item.price_cents === 'number' ? item.price_cents : 0,
            prepSeconds: typeof item.prep_seconds === 'number' ? item.prep_seconds : 300,
            station: item.station || 'Kitchen',
            imageUrl: item.image_url || null,
            active: typeof item.active === 'boolean' ? item.active : true,
            customizable: typeof item.customizable === 'boolean' ? item.customizable : false
          };
        }
      });
      
      res.json(mappedItems);
    } catch (error) {
      console.error('Error fetching menu items by category:', error);
      res.status(500).json({ 
        message: 'Failed to fetch menu items',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  app.get('/api/bays', async (req: Request, res: Response) => {
    try {
      const floor = req.query.floor ? parseInt(req.query.floor as string) : undefined;
      const status = req.query.status as string | undefined;
      
      let bays = await storage.getBays();
      
      if (floor) {
        bays = bays.filter(bay => bay.floor === floor);
      }
      
      if (status && status !== 'all') {
        bays = bays.filter(bay => bay.status === status);
      }
      
      res.json(bays.map(toBayDTO));
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch bays' });
    }
  });
  
  app.get('/api/bay/:number', async (req: Request, res: Response) => {
    try {
      const bayNumber = parseInt(req.params.number);
      const bay = await storage.getBayByNumber(bayNumber);
      
      if (!bay) {
        return res.status(404).json({ message: 'Bay not found' });
      }
      
      res.json(toBayDTO(bay));
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch bay' });
    }
  });
  
  // Get orders for a specific bay
  app.get('/api/bay/:id/orders', async (req: Request, res: Response) => {
    try {
      const bayId = parseInt(req.params.id);
      
      // Verify bay exists
      const bay = await storage.getBayById(bayId);
      if (!bay) {
        return res.status(404).json({ message: 'Bay not found' });
      }
      
      // Get all orders for this bay
      const bayOrders = await storage.getOrdersByBayId(bayId);
      
      // Transform to include items
      const ordersWithItems = await Promise.all(
        bayOrders.map(async (order) => {
          const fullOrder = await storage.getOrderWithItems(order.id);
          if (!fullOrder) return null;
          
          return {
            ...toOrderDTO(order),
            items: fullOrder.items.map(item => ({
              ...toOrderItemDTO(item),
              menuItem: item.menuItem ? toMenuItemDTO(item.menuItem) : undefined
            }))
          };
        })
      );
      
      // Filter out any null values
      const validOrders = ordersWithItems.filter(order => order !== null);
      
      res.json(validOrders);
    } catch (error) {
      console.error('Error fetching orders for bay:', error);
      res.status(500).json({ message: 'Failed to fetch bay orders' });
    }
  });
  
  app.get('/api/orders', async (_req: Request, res: Response) => {
    try {
      const orders = await storage.getActiveOrders();
      // OrderSummary objects are already in camelCase format
      res.json(orders);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch orders' });
    }
  });
  
  app.get('/api/orders/:status', async (req: Request, res: Response) => {
    try {
      const statusParam = req.params.status;
      
      // Special case for 'pending' to include NEW orders
      if (statusParam.toLowerCase() === 'pending') {
        // Get all orders first and then filter for NEW status
        const allOrders = await storage.getActiveOrders();
        const pendingOrders = allOrders.filter(order => 
          order.status === OrderStatus.NEW
        );
        return res.json(pendingOrders);
      }
      
      // Map the UI-friendly status names to OrderStatus enum values
      let status: string;
      switch (statusParam.toLowerCase()) {
        case 'preparing':
          status = OrderStatus.COOKING;
          break;
        case 'ready':
          status = OrderStatus.READY;
          break;
        case 'served':
          status = OrderStatus.SERVED;
          break;
        case 'cancelled':
          status = OrderStatus.CANCELLED;
          break;
        default:
          // Check if the status is a valid enum value directly
          if (Object.values(OrderStatus).includes(statusParam as OrderStatus)) {
            status = statusParam;
          } else {
            return res.status(400).json({ message: 'Invalid order status' });
          }
      }
      
      const orders = await storage.getOrdersByStatus(status);
      res.json(orders);
    } catch (error) {
      console.error('Error fetching orders by status:', error);
      res.status(500).json({ message: 'Failed to fetch orders' });
    }
  });
  
  app.get('/api/order/:id', async (req: Request, res: Response) => {
    try {
      const orderId = req.params.id;
      const order = await storage.getOrderWithItems(orderId);
      
      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }
      
      // OrderWithItems already has the correct structure from storage
      // but we can ensure consistency with DTO format if needed
      const orderDTO = {
        ...toOrderDTO(order),
        items: order.items.map(item => ({
          ...toOrderItemDTO(item),
          menuItem: toMenuItemDTO(item.menuItem)
        })),
        bay: toBayDTO(order.bay)
      };
      
      res.json(orderDTO);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch order' });
    }
  });
  
  // Create new order - allow minimal payload during demo
  const createOrderSchema = z.object({
    order: z.object({
      bayId: z.number().int().positive(),
      // Note: We keep specialInstructions here temporarily for backward compatibility
      // but it will eventually be deprecated in favor of item-level notes
      specialInstructions: z.string().optional(),
      orderType: z.string().optional().default("customer"),
    }),
    cart: z.object({
      items: z.array(z.object({
        menuItemId: z.string().uuid(),
        quantity: z.number().int().positive(),
        notes: z.string().optional(),
        customizations: z.array(z.object({
          categoryId: z.number(),
          categoryName: z.string(),
          options: z.array(z.object({
            id: z.number(),
            name: z.string(),
            priceCents: z.number()
          }))
        })).optional()
      })),
      // Note: We keep specialInstructions here temporarily for backward compatibility
      specialInstructions: z.string().optional(),
    }),
  });
  
  app.post('/api/orders', async (req: Request, res: Response) => {
    try {
      console.log('Received order request:', JSON.stringify(req.body, null, 2));
      
      const validatedData = createOrderSchema.parse(req.body);
      const { order, cart } = validatedData;
      
      console.log('Validated order data:', JSON.stringify(validatedData, null, 2));
      
      // Calculate estimated completion time based on order items and their complexity
      // A simple algorithm: 5 min base time + 2 min per item
      const totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0);
      const estimatedMinutes = 5 + Math.ceil(totalItems * 2);
      const estimatedCompletionTime = new Date();
      estimatedCompletionTime.setMinutes(estimatedCompletionTime.getMinutes() + estimatedMinutes);
      
      // Add estimatedCompletionTime and required fields to order data
      const orderWithEstimatedTime = {
        ...order,
        status: OrderStatus.NEW,
        estimatedCompletionTime
      };
      
      console.log('Creating order with data:', JSON.stringify(orderWithEstimatedTime, null, 2));
      console.log('Cart data:', JSON.stringify(cart, null, 2));
      
      // Create the order
      const newOrder = await storage.createOrder(orderWithEstimatedTime, cart);
      
      console.log('Order created successfully:', JSON.stringify(newOrder, null, 2));
      
      // Broadcast update to all clients
      const updatedOrders = await storage.getActiveOrders();
      broadcastUpdate('ordersUpdate', updatedOrders);
      
      // Prepare station map for created message
      const stationMap: Record<string, { menuItemId: string, name: string, quantity: number }[]> = {};
      
      // Process each menu item for stations
      for (const item of cart.items) {
        const menuItem = await storage.getMenuItemById(item.menuItemId);
        const station = menuItem?.station || 'main';
        
        if (!stationMap[station]) {
          stationMap[station] = [];
        }
        
        stationMap[station].push({
          menuItemId: item.menuItemId,
          name: menuItem?.name || 'Unknown Item',
          quantity: item.quantity
        });
      }
      
      // Create a properly typed order created message
      const orderCreatedMessage: OrderCreatedMessage = {
        type: 'order_created',
        data: {
          order: toOrderDTO(newOrder),
          estimatedCompletionTime: estimatedCompletionTime.toISOString(),
          stations: stationMap
        }
      };
      
      // Send update to the specific bay
      sendBayUpdate(order.bayId, 'order_created', orderCreatedMessage.data);
      
      // Update bay status to 'active' when an order is placed
      await storage.updateBayStatus(order.bayId, 'active');
      
      res.status(201).json(toOrderDTO(newOrder));
    } catch (error) {
      console.error('Error creating order:', error);
      
      if (error instanceof z.ZodError) {
        console.error('Validation error:', JSON.stringify(error.errors, null, 2));
        return res.status(400).json({ 
          message: 'Invalid order data', 
          errors: error.errors 
        });
      }
      
      // Log the actual error for debugging
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      
      res.status(500).json({ message: 'Failed to create order' });
    }
  });
  
  // Update order status
  const updateOrderStatusSchema = z.object({
    status: z.enum([
      OrderStatus.NEW, 
      OrderStatus.COOKING, 
      OrderStatus.PLATING,
      OrderStatus.READY, 
      OrderStatus.SERVED,
      OrderStatus.CLOSED,
      OrderStatus.CANCELLED
    ]).or(z.enum(['new', 'cooking', 'plating', 'ready', 'served', 'closed', 'cancelled'])),
  });
  
  // Add endpoint for quickly marking an order as ready
  app.post('/api/order/:id/ready', async (req: Request, res: Response) => {
    try {
      const orderId = req.params.id;
      
      // Update the order status directly to READY
      const updatedOrder = await storage.updateOrderStatus(orderId, OrderStatus.READY);
      
      if (!updatedOrder) {
        return res.status(404).json({ message: 'Order not found' });
      }
      
      // Get full order details
      const fullOrder = await storage.getOrderWithItems(orderId);
      
      // Broadcast order update to connected clients
      const updatedOrders = await storage.getActiveOrders();
      broadcastUpdate('ordersUpdate', updatedOrders);
      
      if (fullOrder) {
        // Create order update message
        const orderUpdatedMessage: OrderUpdatedMessage = {
          type: 'order_updated',
          data: {
            order: toOrderDTO(updatedOrder),
            items: fullOrder.items.map(item => toOrderItemDTO(item)),
            status: OrderStatus.READY,
            timeElapsed: Math.round((Date.now() - new Date(fullOrder.createdAt).getTime()) / 60000),
            estimatedCompletionTime: fullOrder.estimatedCompletionTime 
              ? new Date(fullOrder.estimatedCompletionTime).toISOString() 
              : null,
            completionTime: new Date().toISOString(),
            isDelayed: fullOrder.estimatedCompletionTime 
              ? new Date() > new Date(fullOrder.estimatedCompletionTime) 
              : false
          }
        };
        
        // Send messages to connected clients
        const clients = getClients();
        // Use forEach instead of for...of to avoid MapIterator compatibility issues
        clients.forEach(client => {
          if (client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(JSON.stringify(orderUpdatedMessage));
          }
        });
      }
      
      // Return the updated order
      res.json(updatedOrder);
    } catch (error) {
      console.error('Error marking order as ready:', error);
      res.status(500).json({ message: 'Failed to mark order as ready' });
    }
  });
  
  // Add endpoint for closing a ticket
  app.post('/api/order/:id/close', async (req: Request, res: Response) => {
    try {
      const orderId = req.params.id;
      
      // First mark all order items as delivered if they aren't already
      const orderItems = await storage.getOrderItems(orderId);
      for (const item of orderItems) {
        if (item.status !== OrderItemStatus.DELIVERED) {
          await storage.markOrderItemDelivered(item.id);
        }
      }
      
      // Update the order status to CLOSED and set the closedAt timestamp
      const updatedOrder = await storage.updateOrderStatus(orderId, OrderStatus.CLOSED);
      
      // Also set the closedAt timestamp separately
      if (updatedOrder) {
        await db
          .update(orders)
          .set({ closedAt: new Date() })
          .where(eq(orders.id, orderId));
      }
      
      if (!updatedOrder) {
        return res.status(404).json({ message: 'Order not found' });
      }
      
      // Check if there are active orders for this bay
      const bayOrders = await storage.getOrdersByBayId(updatedOrder.bayId);
      const activeOrders = bayOrders.filter(order => 
        order.id !== orderId && 
        order.status !== OrderStatus.SERVED && 
        order.status !== OrderStatus.CLOSED && 
        order.status !== OrderStatus.CANCELLED
      );
      
      // If no more active orders, set bay to empty
      if (activeOrders.length === 0) {
        await storage.updateBayStatus(updatedOrder.bayId, "empty");
      }
      
      // Get full order details
      const fullOrder = await storage.getOrderWithItems(orderId);
      
      // Broadcast a special ORDER_CLOSED message type to indicate this is a closure
      // (not just a regular order update)
      const orderClosedMessage = {
        type: 'ORDER_CLOSED',
        data: toOrderDTO(updatedOrder)
      };
      
      // Send to all connected clients
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(orderClosedMessage));
        }
      });
      
      // Also broadcast to update active orders list for all clients
      const updatedOrders = await storage.getActiveOrders();
      broadcastUpdate('ordersUpdate', updatedOrders);
      
      // Additionally broadcast closed orders for the CLOSED tab
      // Get orders with CLOSED status
      const closedOrders = await storage.getOrdersByStatus(OrderStatus.CLOSED);
      broadcastUpdate('closedOrdersUpdate', closedOrders);
      
      if (fullOrder) {
        // Create order update message for the specific bay
        const orderUpdatedMessage: OrderUpdatedMessage = {
          type: 'order_updated',
          data: {
            order: toOrderDTO(updatedOrder),
            items: fullOrder.items.map(item => toOrderItemDTO(item)),
            status: OrderStatus.CLOSED,
            timeElapsed: Math.round((Date.now() - new Date(fullOrder.createdAt).getTime()) / 60000),
            estimatedCompletionTime: fullOrder.estimatedCompletionTime 
              ? new Date(fullOrder.estimatedCompletionTime).toISOString() 
              : null,
            completionTime: updatedOrder.closedAt 
              ? new Date(updatedOrder.closedAt).toISOString() 
              : new Date().toISOString(),
            isDelayed: false
          }
        };
        
        // Send update to the specific bay
        sendBayUpdate(updatedOrder.bayId, 'order_updated', orderUpdatedMessage.data);
      }
      
      // Return the updated order
      res.json(toOrderDTO(updatedOrder));
    } catch (error) {
      console.error('Error closing order:', error);
      res.status(500).json({ message: 'Failed to close order' });
    }
  });

  app.put('/api/order/:id/status', async (req: Request, res: Response) => {
    try {
      const orderId = req.params.id;
      const { status } = updateOrderStatusSchema.parse(req.body);
      
      const updatedOrder = await storage.updateOrderStatus(orderId, status);
      
      if (!updatedOrder) {
        return res.status(404).json({ message: 'Order not found' });
      }
      
      // Get the full order with items
      const fullOrder = await storage.getOrderWithItems(orderId);
      
      // Broadcast update to all connected clients
      const updatedOrders = await storage.getActiveOrders();
      broadcastUpdate('ordersUpdate', updatedOrders);
      
      if (fullOrder) {
        // Create properly typed order updated message
        const orderUpdatedMessage: OrderUpdatedMessage = {
          type: 'order_updated',
          data: {
            order: toOrderDTO(updatedOrder),
            items: fullOrder.items.map(item => toOrderItemDTO(item)),
            status,
            // Calculate time elapsed since order creation
            timeElapsed: Math.round((Date.now() - new Date(fullOrder.createdAt).getTime()) / 60000), // in minutes
            estimatedCompletionTime: fullOrder.estimatedCompletionTime 
              ? new Date(fullOrder.estimatedCompletionTime).toISOString() 
              : null,
            // For 'ready', 'served', 'dining', and 'paid' statuses, include completion info
            completionTime: ['ready', 'served', 'dining', 'paid'].includes(status.toLowerCase()) ? new Date().toISOString() : null,
            isDelayed: fullOrder.estimatedCompletionTime 
              ? new Date() > new Date(fullOrder.estimatedCompletionTime) 
              : false
          }
        };
        
        // Send update to the specific bay
        sendBayUpdate(updatedOrder.bayId, 'order_updated', orderUpdatedMessage.data);
        
        // Update bay status based on order status
        if (status.toString().toUpperCase() === OrderStatus.READY) {
          await storage.updateBayStatus(updatedOrder.bayId, 'alert'); // Show as alert when order is ready to serve
        } else if (status.toString().toUpperCase() === OrderStatus.SERVED) {
          // Check if there are any other active orders for this bay
          const bayOrders = await storage.getOrdersByBayId(updatedOrder.bayId);
          const activeOrders = bayOrders.filter(o => 
            o.id !== updatedOrder.id && 
            o.status !== OrderStatus.SERVED && 
            o.status !== OrderStatus.CLOSED && 
            o.status !== OrderStatus.CANCELLED
          );
          
          if (activeOrders.length === 0) {
            // If no more active orders, set bay to empty
            await storage.updateBayStatus(updatedOrder.bayId, 'empty');
          }
        } else if (status.toString().toUpperCase() === OrderStatus.NEW || status.toString().toUpperCase() === OrderStatus.COOKING) {
          await storage.updateBayStatus(updatedOrder.bayId, 'active');
        } else if (status.toString().toUpperCase() === OrderStatus.PLATING) {
          await storage.updateBayStatus(updatedOrder.bayId, 'flagged'); // Yellow/amber for plating
        }
      }
      
      res.json(toOrderDTO(updatedOrder));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: 'Invalid status', 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: 'Failed to update order status' });
    }
  });
  
  // Legacy endpoint - Update order item completion status
  const updateOrderItemStatusSchema = z.object({
    completed: z.boolean(),
  });
  
  app.put('/api/orderitem/:id/status', async (req: Request, res: Response) => {
    try {
      const orderItemId = req.params.id;
      const { completed } = updateOrderItemStatusSchema.parse(req.body);
      
      const updatedOrderItem = await storage.updateOrderItemStatus(orderItemId, completed);
      
      if (!updatedOrderItem) {
        return res.status(404).json({ message: 'Order item not found' });
      }
      
      // Get the full order to send updated data
      const order = await storage.getOrderWithItems(updatedOrderItem.orderId);
      
      if (order) {
        // Get all order items for this order
        const orderItems = await storage.getOrderItems(order.id);
        
        // Check if all items are completed
        const allItemsCompleted = orderItems.every(item => item.completed);
        
        // If all items are completed, update the order status to READY if it's currently COOKING
        let updatedOrderStatus = order.status;
        if (allItemsCompleted && (order.status === 'preparing' || order.status === OrderStatus.COOKING)) {
          const readyOrder = await storage.updateOrderStatus(order.id, OrderStatus.READY);
          if (readyOrder) {
            updatedOrderStatus = OrderStatus.READY;
          }
        }
        
        // Broadcast update to all clients
        const updatedOrders = await storage.getActiveOrders();
        broadcastUpdate('ordersUpdate', updatedOrders);
        
        // Create a properly typed order item update message
        const orderItemUpdateMessage: OrderItemUpdatedMessage = {
          type: 'order_item_updated',
          data: {
            orderId: order.id,
            orderItem: toOrderItemDTO(updatedOrderItem),
            orderStatus: updatedOrderStatus,
            allItemsCompleted,
            // Calculate time elapsed since order creation
            timeElapsed: Math.round((Date.now() - new Date(order.createdAt).getTime()) / 60000), // in minutes
            estimatedCompletionTime: order.estimatedCompletionTime 
              ? new Date(order.estimatedCompletionTime).toISOString() 
              : null
          }
        };
        
        // Send update to the specific bay
        sendBayUpdate(order.bayId, 'order_item_updated', orderItemUpdateMessage.data);
      }
      
      res.json(toOrderItemDTO(updatedOrderItem));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: 'Invalid status', 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: 'Failed to update order item status' });
    }
  });
  
  // New endpoint - Fire an order item (start cooking)
  app.post('/api/order-items/:id/fire', async (req: Request, res: Response) => {
    try {
      const orderItemId = req.params.id;
      
      // Fire the order item (sets status to COOKING)
      const updatedItem = await storage.fireOrderItem(orderItemId);
      
      if (!updatedItem) {
        return res.status(404).json({ message: 'Order item not found' });
      }
      
      // Get the order to send bay info
      const order = await storage.getOrderById(updatedItem.orderId);
      
      if (!order) {
        return res.status(500).json({ message: 'Associated order not found' });
      }
      
      // Get bay info
      const bay = await storage.getBayById(order.bayId);
      
      // Create properly typed item cooking message
      const itemCookingMessage: ItemCookingMessage = {
        type: 'item_cooking',
        data: {
          orderId: updatedItem.orderId,
          orderItem: toOrderItemDTO(updatedItem),
          station: updatedItem.station || '',
          firedAt: updatedItem.firedAt!.toISOString(),
          cookSeconds: updatedItem.cookSeconds,
          readyAt: updatedItem.readyAt!.toISOString(),
          bayId: order.bayId,
          bayNumber: bay?.number || order.bayId,
          status: OrderItemStatus.COOKING
        }
      };
      
      // Broadcast to all kitchen clients
      broadcastUpdate('item_cooking', itemCookingMessage.data);
      
      // Send update to the specific bay
      sendBayUpdate(order.bayId, 'item_cooking', itemCookingMessage.data);
      
      // Return the updated item
      res.json(toOrderItemDTO(updatedItem));
    } catch (error) {
      console.error('Error firing order item:', error);
      res.status(500).json({ message: 'Failed to fire order item' });
    }
  });
  
  // Optimized endpoint - Mark an order item as plating (transition from COOKING to PLATING)
  app.post('/api/order-items/:id/plating', async (req: Request, res: Response) => {
    try {
      const orderItemId = req.params.id;
      const startTime = Date.now();
      
      // Combined operation: update item status and get complete data in one database transaction
      const { updatedItem, order, bay, updatedOrderStatus } = await storage.markItemPlatingWithContext(orderItemId);
      
      if (!updatedItem) {
        return res.status(404).json({ message: 'Order item not found' });
      }
      
      if (!order) {
        return res.status(500).json({ message: 'Associated order not found' });
      }
      
      // Create properly typed item plating message with all needed context
      const itemPlatingMessage: ItemPlatingMessage = {
        type: 'item_plating',
        data: {
          orderId: updatedItem.orderId,
          orderItem: toOrderItemDTO(updatedItem),
          orderStatus: updatedOrderStatus || order.status,
          station: updatedItem.station || '',
          platingAt: updatedItem.platingAt ? updatedItem.platingAt.toISOString() : new Date().toISOString(),
          bayId: order.bayId,
          bayNumber: bay?.number || order.bayId,
          status: OrderItemStatus.PLATING
        }
      };
      
      // Broadcast to all kitchen clients
      broadcastUpdate('item_plating', itemPlatingMessage.data);
      
      // Send update to the specific bay
      sendBayUpdate(order.bayId, 'item_plating', itemPlatingMessage.data);
      
      const endTime = Date.now();
      console.log(`Plating operation completed in ${endTime - startTime}ms`);
      
      // Return the updated item
      res.json(toOrderItemDTO(updatedItem));
    } catch (error) {
      console.error('Error marking order item as plating:', error);
      res.status(500).json({ message: 'Failed to mark order item as plating' });
    }
  });
  
  // New endpoint - Mark an order item as ready
  app.post('/api/order-items/:id/ready', async (req: Request, res: Response) => {
    try {
      const orderItemId = req.params.id;
      
      // Mark the order item as ready
      const updatedItem = await storage.markReady(orderItemId);
      
      if (!updatedItem) {
        return res.status(404).json({ message: 'Order item not found' });
      }
      
      // Get the order to send bay info
      const order = await storage.getOrderById(updatedItem.orderId);
      
      if (!order) {
        return res.status(500).json({ message: 'Associated order not found' });
      }
      
      // Get bay info
      const bay = await storage.getBayById(order.bayId);
      
      // Calculate elapsed time in seconds
      const firedTime = updatedItem.firedAt ? new Date(updatedItem.firedAt).getTime() : Date.now();
      const readyTime = updatedItem.readyAt ? new Date(updatedItem.readyAt).getTime() : Date.now();
      const elapsedSeconds = Math.floor((readyTime - firedTime) / 1000);
      
      // Create properly typed item ready message
      const itemReadyMessage: ItemReadyMessage = {
        type: 'item_ready',
        data: {
          orderId: updatedItem.orderId,
          orderItem: toOrderItemDTO(updatedItem),
          station: updatedItem.station || '',
          readyAt: updatedItem.readyAt ? updatedItem.readyAt.toISOString() : new Date().toISOString(),
          elapsedSeconds,
          bayId: order.bayId,
          bayNumber: bay?.number || order.bayId,
          status: OrderItemStatus.READY
        }
      };
      
      // Broadcast to all kitchen clients
      broadcastUpdate('item_ready', itemReadyMessage.data);
      
      // Send update to the specific bay
      sendBayUpdate(order.bayId, 'item_ready', itemReadyMessage.data);
      
      // Return the updated item
      res.json(toOrderItemDTO(updatedItem));
    } catch (error) {
      console.error('Error marking order item as ready:', error);
      res.status(500).json({ message: 'Failed to mark order item as ready' });
    }
  });
  
  // New endpoint - Mark an order item as delivered
  app.post('/api/order-items/:id/deliver', async (req: Request, res: Response) => {
    try {
      const orderItemId = req.params.id;
      
      // Mark the order item as delivered
      const updatedItem = await storage.markDelivered(orderItemId);
      
      if (!updatedItem) {
        return res.status(404).json({ message: 'Order item not found' });
      }
      
      // Get the order to send bay info
      const order = await storage.getOrderById(updatedItem.orderId);
      
      if (!order) {
        return res.status(500).json({ message: 'Associated order not found' });
      }
      
      // Get bay info
      const bay = await storage.getBayById(order.bayId);
      
      // Calculate total cook time in seconds (from firedAt to deliveredAt)
      const firedTime = updatedItem.firedAt ? new Date(updatedItem.firedAt).getTime() : Date.now();
      const deliveredTime = updatedItem.deliveredAt ? new Date(updatedItem.deliveredAt).getTime() : Date.now();
      const totalCookTime = Math.floor((deliveredTime - firedTime) / 1000);
      
      // Create properly typed item delivered message
      const itemDeliveredMessage: ItemDeliveredMessage = {
        type: 'item_delivered',
        data: {
          orderId: updatedItem.orderId,
          orderItem: toOrderItemDTO(updatedItem),
          station: updatedItem.station || '',
          deliveredAt: updatedItem.deliveredAt!.toISOString(),
          totalCookTime,
          bayId: order.bayId,
          bayNumber: bay?.number || order.bayId,
          status: OrderItemStatus.DELIVERED
        }
      };
      
      // Broadcast to all kitchen clients
      broadcastUpdate('item_delivered', itemDeliveredMessage.data);
      
      // Send update to the specific bay
      sendBayUpdate(order.bayId, 'item_delivered', itemDeliveredMessage.data);
      
      // Check if all items for this order are delivered
      const orderItems = await storage.getOrderItems(order.id);
      const allItemsDelivered = orderItems.every(item => item.status === OrderItemStatus.DELIVERED || item.completed);
      
      // If all items delivered, update order status to SERVED
      if (allItemsDelivered && order.status !== OrderStatus.SERVED) {
        await storage.updateOrderStatus(order.id, OrderStatus.SERVED);
        
        // We no longer automatically transition from SERVED to another status
        // in our simplified workflow
        setTimeout(async () => {
          // Double-check order hasn't been updated to something else
          const currentOrder = await storage.getOrderById(order.id);
          if (currentOrder && currentOrder.status === OrderStatus.SERVED) {
            // Status remains SERVED - no automatic transition
            
            // Broadcast updated orders
            const updatedOrders = await storage.getActiveOrders();
            broadcastUpdate('ordersUpdate', updatedOrders);
          }
        }, 10000); // 10 seconds delay for demo purposes (could be longer in production)
        
        // Broadcast updated orders
        const updatedOrders = await storage.getActiveOrders();
        broadcastUpdate('ordersUpdate', updatedOrders);
      }
      
      // Return the updated item
      res.json(toOrderItemDTO(updatedItem));
    } catch (error) {
      console.error('Error marking order item as delivered:', error);
      res.status(500).json({ message: 'Failed to mark order item as delivered' });
    }
  });
  
  // New endpoint - Get order items by station (for KDS)
  app.get('/api/order-items/station/:station', async (req: Request, res: Response) => {
    try {
      const station = req.params.station;
      const status = req.query.status as string | undefined;
      
      // Get items filtered by station and optional status
      const items = await storage.getOrderItemsByStation(station, status);
      
      // Return all matching items
      res.json(items.map(toOrderItemDTO));
    } catch (error) {
      console.error('Error fetching station items:', error);
      res.status(500).json({ message: 'Failed to fetch items by station' });
    }
  });
  
  return httpServer;
}
