import { 
  users, type User, type InsertUser,
  categories, type Category, type InsertCategory,
  menuItems, type MenuItem, type InsertMenuItem,
  bays, type Bay, type InsertBay,
  orders, type Order, type InsertOrder, 
  orderItems, type OrderItem, type InsertOrderItem,
  kitchenSettings, type KitchenSetting,
  type OrderWithItems, type OrderSummary, type Cart, type CustomizationSelection,
  OrderItemStatus, OrderStatus, SeatingType
} from "@shared/schema";
import * as schema from "@shared/schema";
import { WebSocketMessageType } from "@shared/types";
import { toBayDTO, toOrderDTO } from "./dto";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Categories
  getCategories(): Promise<Category[]>;
  getCategoryById(id: number): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;

  // Menu Items
  getMenuItems(): Promise<MenuItem[]>;
  getMenuItemsByCategory(categoryId: number): Promise<MenuItem[]>;
  getMenuItemById(id: string | number): Promise<MenuItem | undefined>;
  createMenuItem(menuItem: InsertMenuItem): Promise<MenuItem>;

  // Bays
  getBays(): Promise<Bay[]>;
  getBaysByFloor(floor: number): Promise<Bay[]>;
  getBayByNumber(number: number): Promise<Bay | undefined>;
  getBayById(id: number): Promise<Bay | undefined>;
  createBay(bay: InsertBay): Promise<Bay>;
  updateBayStatus(id: number, status: string): Promise<Bay | undefined>;

  // Orders
  getOrders(): Promise<Order[]>;
  getOrderById(id: string): Promise<Order | undefined>;
  getOrderWithItems(id: string): Promise<OrderWithItems | undefined>;
  getOrdersByBayId(bayId: number): Promise<Order[]>;
  getActiveOrders(): Promise<OrderSummary[]>;
  getOrdersByStatus(status: string): Promise<OrderSummary[]>;
  createOrder(order: InsertOrder, cart: Cart): Promise<Order>;
  updateOrderStatus(id: string, status: string): Promise<Order | undefined>;


  // Order Items
  getOrderItems(orderId: string): Promise<OrderItem[]>;
  createOrderItem(orderItem: InsertOrderItem): Promise<OrderItem>;

  // Legacy method (to be deprecated) - updates completed flag
  updateOrderItemStatus(id: string, completed: boolean): Promise<OrderItem | undefined>;

  // Methods to support enhanced status tracking
  markFired(id: string): Promise<OrderItem | undefined>;
  markPlating(id: string): Promise<OrderItem | undefined>;
  markReady(id: string): Promise<OrderItem | undefined>;
  markDelivered(id: string): Promise<OrderItem | undefined>;
  autoFlipReady(): Promise<OrderItem[]>;

  // New methods for enhanced status tracking
  fireOrderItem(id: string): Promise<OrderItem | undefined>; // Sets status to COOKING and captures firedAt timestamp
  markOrderItemPlating(id: string): Promise<OrderItem | undefined>; // Sets status to PLATING and captures platingAt timestamp
  markOrderItemReady(id: string): Promise<OrderItem | undefined>; // Sets status to READY and captures actualReadyAt timestamp
  markOrderItemDelivered(id: string): Promise<OrderItem | undefined>; // Sets status to DELIVERED and captures servedAt timestamp
  getOrderItemsByStation(station: string, status?: string): Promise<OrderItem[]>; // Filtered by station and optional status

  // Initialize with sample data
  initializeData(): Promise<void>;
  recalcBayStatus(bayId: string): Promise<void>;
}

// Import database instance and helpers
import { db, pool } from "./db";
import { eq, asc, desc, and, or, isNotNull, isNull, lt, notInArray, ne } from "drizzle-orm";

// Implement the Database Storage
export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  // Categories
  async getCategories(): Promise<Category[]> {
    return db.select().from(categories);
  }

  async getCategoryById(id: number): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.id, id));
    return category || undefined;
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [newCategory] = await db
      .insert(categories)
      .values(category)
      .returning();
    return newCategory;
  }

  // Menu Items
  async getMenuItems(): Promise<MenuItem[]> {
    return db.select().from(menuItems);
  }

  async getMenuItemsByCategory(categoryId: number): Promise<MenuItem[]> {
    const category = await this.getCategoryById(categoryId);
    if (!category) return [];

    return db
      .select()
      .from(menuItems)
      .where(eq(menuItems.category, category.name));
  }

  async getMenuItemById(id: string | number): Promise<MenuItem | undefined> {
    const idString = typeof id === 'number' ? id.toString() : id;
    try {
      const [menuItem] = await db
        .select()
        .from(menuItems)
        .where(eq(menuItems.id, idString));
      return menuItem || undefined;
    } catch (error) {
      console.error(`Error fetching menu item with ID ${idString}:`, error);
      return undefined;
    }
  }

  async createMenuItem(menuItem: InsertMenuItem): Promise<MenuItem> {
    const [newMenuItem] = await db
      .insert(menuItems)
      .values(menuItem)
      .returning();
    return newMenuItem;
  }

  // Bays
  async getBays(): Promise<Bay[]> {
    return db
      .select()
      .from(bays)
      .orderBy(asc(bays.floor), asc(bays.number));
  }

  async getBaysByFloor(floor: number): Promise<Bay[]> {
    return db
      .select()
      .from(bays)
      .where(eq(bays.floor, floor))
      .orderBy(asc(bays.number));
  }

  async getBayByNumber(number: number): Promise<Bay | undefined> {
    const [bay] = await db
      .select()
      .from(bays)
      .where(eq(bays.number, number));
    return bay || undefined;
  }

  async getBayById(id: number): Promise<Bay | undefined> {
    const [bay] = await db
      .select()
      .from(bays)
      .where(eq(bays.id, id));
    return bay || undefined;
  }

  async createBay(bay: InsertBay): Promise<Bay> {
    // Ensure type is properly cast to SeatingType
    const bayWithProperType = {
      ...bay,
      type: bay.type as SeatingType
    };

    const [newBay] = await db
      .insert(bays)
      .values([bayWithProperType])
      .returning();
    return newBay;
  }

  async updateBayStatus(id: number, status: string): Promise<Bay | undefined> {
    // Import WebSocket functionality dynamically to avoid circular imports
    const { broadcastUpdate } = await import('./ws');
    
    // Update the bay status in the database
    const [updatedBay] = await db
      .update(bays)
      .set({ status })
      .where(eq(bays.id, id))
      .returning();
    
    if (updatedBay) {
      // Broadcast the bay update with its new status to all clients
      broadcastUpdate('bay_updated', { bay: toBayDTO(updatedBay) });
      console.log(`Broadcasted bay status update: Bay ${id} -> ${status}`);
    }
    
    return updatedBay || undefined;
  }

  // Orders
  async getOrders(): Promise<Order[]> {
    return db
      .select()
      .from(orders)
      .orderBy(desc(orders.createdAt));
  }

  async getOrderById(id: string): Promise<Order | undefined> {
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, id));
    return order || undefined;
  }

  async getOrderWithItems(id: string): Promise<OrderWithItems | undefined> {
    try {
      const order = await this.getOrderById(id);
      if (!order) {
        console.warn(`Order not found with ID: ${id}`);
        return undefined;
      }

      const bay = await this.getBayById(order.bayId);
      if (!bay) {
        console.warn(`Bay not found for order ${id} with bay ID: ${order.bayId}`);
        return undefined;
      }

      const orderItemsList = await this.getOrderItems(id);

      // Fetch menu items for each order item - don't convert menuItemId to number
      const items = await Promise.all(
        orderItemsList.map(async (item) => {
          try {
            const menuItem = await this.getMenuItemById(item.menuItemId);
            // Handle case where menuItem might be undefined
            return { 
              ...item, 
              menuItem: menuItem || {
                id: item.menuItemId,
                name: 'Unknown Item',
                description: 'Item details unavailable',
                price_cents: 0, // Changed from price to price_cents to match schema
                category: 'Unknown',
                station: item.station || 'Unknown',
                prep_seconds: 300, // Changed from cookMinutes to prep_seconds to match schema
                image_url: null,
                active: true,
                customizable: false
              }
            };
          } catch (error) {
            console.error(`Error fetching menu item for order item ${item.id}:`, error);
            // Return the order item with a placeholder menu item on error
            return { 
              ...item, 
              menuItem: {
                id: item.menuItemId,
                name: 'Error: Item Unavailable',
                description: 'Could not retrieve item details',
                price_cents: 0, // Changed from price to price_cents to match schema
                category: 'Unknown',
                station: item.station || 'Unknown',
                prep_seconds: 300, // Changed from cookMinutes to prep_seconds to match schema
                image_url: null,
                active: true,
                customizable: false
              }
            };
          }
        })
      );

      return {
        ...order,
        bay,
        items,
      };
    } catch (error) {
      console.error(`Error getting order with items for ID ${id}:`, error);
      return undefined;
    }
  }

  async getOrdersByBayId(bayId: number): Promise<Order[]> {
    return db
      .select()
      .from(orders)
      .where(eq(orders.bayId, bayId))
      .orderBy(desc(orders.createdAt));
  }

  async getActiveOrders(): Promise<OrderSummary[]> {
    // Get ALL orders to display in ALL tabs - both active and closed/served
    const activeOrders = await db
      .select()
      .from(orders)
      .orderBy(asc(orders.createdAt));

    const summaries = await Promise.all(
      activeOrders.map(async (order) => {
        const bay = await this.getBayById(order.bayId);
        const items = await this.getOrderItems(order.id);

        // Calculate how many minutes ago the order was created
        const now = new Date();
        const createdAt = new Date(order.createdAt);
        const timeElapsed = Math.floor((now.getTime() - createdAt.getTime()) / 60000);

        // Determine if the order is delayed
        // For simplicity, we'll consider an order delayed if it's been more than 15 minutes since creation
        const isDelayed = timeElapsed > 15;

        return {
          id: order.id,
          orderNumber: `#${order.id.substring(0, 6)}`, // Generate order number from ID
          bayId: order.bayId,
          bayNumber: bay?.number,
          floor: bay?.floor || 0,
          status: order.status,
          createdAt: order.createdAt,
          timeElapsed,
          totalItems: items.reduce((sum, item) => sum + (item.quantity || 0), 0),
          isDelayed,
        };
      })
    );

    return summaries;
  }

  async getOrdersByStatus(status: string): Promise<OrderSummary[]> {
    const ordersWithStatus = await db
      .select()
      .from(orders)
      .where(eq(orders.status, status.toUpperCase()))
      .orderBy(asc(orders.createdAt));

    const summaries = await Promise.all(
      ordersWithStatus.map(async (order) => {
        const bay = await this.getBayById(order.bayId);
        const items = await this.getOrderItems(order.id);

        // Calculate how many minutes ago the order was created
        const now = new Date();
        const createdAt = new Date(order.createdAt);
        const timeElapsed = Math.floor((now.getTime() - createdAt.getTime()) / 60000);

        // Determine if the order is delayed (assuming a 15-minute threshold)
        const isDelayed = timeElapsed > 15;

        return {
          id: order.id,
          orderNumber: `#${order.id.substring(0, 6)}`, // Generate order number from ID
          bayId: order.bayId,
          bayNumber: bay?.number,
          floor: bay?.floor || 0,
          status: order.status,
          createdAt: order.createdAt,
          timeElapsed,
          totalItems: items.reduce((sum, item) => sum + (item.quantity || 0), 0),
          isDelayed,
        };
      })
    );

    return summaries;
  }

  async createOrder(order: InsertOrder, cart: Cart): Promise<Order> {
    // Import timing constants
    const { 
      PREP_BUFFER_SECONDS, 
      EXPO_BUFFER_SECONDS, 
      DEFAULT_COOK_SECONDS,
      calculateOrderReadyTime 
    } = await import('./constants');

    // Get kitchen load factor from settings
    const settings = await db
      .select()
      .from(schema.kitchenSettings)
      .limit(1);

    // Default to 1.0 if no settings found
    const loadFactor = settings[0]?.loadFactor || 1.0;

    // Calculate the estimated completion time based on the longest item
    let longestCookTimeSeconds = 0;

    // First, identify the longest cook time item
    for (const item of cart.items) {
      const menuItem = await this.getMenuItemById(item.menuItemId);
      if (menuItem && menuItem.prep_seconds > longestCookTimeSeconds) {
        longestCookTimeSeconds = menuItem.prep_seconds;
      }
    }

    // If no valid cook time found, use default
    if (longestCookTimeSeconds <= 0) {
      longestCookTimeSeconds = DEFAULT_COOK_SECONDS;
    }

    // Apply kitchen load factor to the cook time
    longestCookTimeSeconds = Math.ceil(longestCookTimeSeconds * loadFactor);

    // Create order with estimated completion time
    const createdAt = new Date();
    const estimatedCompletionTime = calculateOrderReadyTime(createdAt, longestCookTimeSeconds);

    // Update the order with the estimated completion time
    const orderWithEstimation = {
      ...order,
      estimatedCompletionTime
    };

    // Create the order
    const [newOrder] = await db
      .insert(orders)
      .values(orderWithEstimation)
      .returning();

    // Then create order items from the cart – pull price & station from menu_items table
    for (const item of cart.items) {
      // Look up the menu item to get its station and price
      const menuItem = await this.getMenuItemById(item.menuItemId);
      const station = menuItem?.station || "GRILL";

      // Get cook seconds from menu item (use original prep_seconds from menu item as cook time)
      let cookSeconds = menuItem?.prep_seconds || DEFAULT_COOK_SECONDS;

      // Apply kitchen load factor to individual items as well
      cookSeconds = Math.ceil(cookSeconds * loadFactor);

      // Calculate total expected time including prep and expo buffers
      const expectedTotalTime = PREP_BUFFER_SECONDS + cookSeconds + EXPO_BUFFER_SECONDS;

      try {
        // Debug what's being saved
        console.log(`Item being saved:`, JSON.stringify(item));
        console.log(`Customizations type:`, item.customizations ? typeof item.customizations : 'null/undefined');
        console.log(`Customizations data:`, item.customizations ? JSON.stringify(item.customizations) : 'null');

        // Insert order item using drizzle ORM with proper JSON handling for PostgreSQL JSONB
        const values = {
          orderId: newOrder.id,
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          notes: item.notes || null,
          station: station,
          cookSeconds: cookSeconds,
          price_cents: menuItem?.price_cents || 0,
          expectedTotalTime: expectedTotalTime,
          status: OrderItemStatus.NEW,
          customizations: item.customizations || null
        };

        console.log('Inserting order item with values:', JSON.stringify(values));

        await db.insert(orderItems).values([values]);
      } catch (error) {
        console.error(`Error inserting order item:`, error);
        // Continue with other items even if one fails
      }
    }

    return newOrder;
  }

  async updateOrderStatus(id: string, status: string): Promise<Order | undefined> {
    const [updatedOrder] = await db
      .update(orders)
      .set({ status: status.toUpperCase() })
      .where(eq(orders.id, id))
      .returning();

    return updatedOrder || undefined;
  }



  // Order Items
  async getOrderItems(orderId: string): Promise<OrderItem[]> {
    console.log(`Getting order items for order ID: ${orderId}`);
    const items = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    // Debug what's being returned from the database
    console.log(`Item count: ${items.length}`);
    if (items.length > 0) {
      console.log(`First item customizations: ${JSON.stringify(items[0].customizations)}`);
      console.log(`First item notes: ${JSON.stringify(items[0].notes)}`);
    }

    return items;
  }

  async createOrderItem(orderItem: InsertOrderItem): Promise<OrderItem> {
    // Fetch the menu item to get its price_cents
    const menuItem = await this.getMenuItemById(orderItem.menuItemId);

    // Handle customizations properly, ensuring it's the right type
    let customizations = null;
    if (orderItem.customizations) {
      if (Array.isArray(orderItem.customizations)) {
        customizations = orderItem.customizations;
      } else {
        // If it's a string (serialized JSON), try to parse it
        try {
          if (typeof orderItem.customizations === 'string') {
            customizations = JSON.parse(orderItem.customizations);
          }
        } catch (error) {
          console.error('Error parsing customizations:', error);
        }
      }
    }

    // Add price_cents and station info from the menu item
    const orderItemWithPrice = {
      ...orderItem,
      price_cents: menuItem?.price_cents || 0,
      station: orderItem.station || menuItem?.station || null,
      cookSeconds: menuItem?.prep_seconds || 300,
      customizations: customizations
    };

    const [newOrderItem] = await db
      .insert(orderItems)
      .values([orderItemWithPrice])
      .returning();
    return newOrderItem;
  }

  async updateOrderItemStatus(id: string, completed: boolean): Promise<OrderItem | undefined> {
    const [updatedOrderItem] = await db
      .update(orderItems)
      .set({ 
        completed,
        // Also update status based on completed flag for backward compatibility
        status: completed ? OrderItemStatus.DELIVERED : OrderItemStatus.NEW,
        // Set deliveredAt timestamp if completed=true
        deliveredAt: completed ? new Date() : null
      })
      .where(eq(orderItems.id, id))
      .returning();

    return updatedOrderItem || undefined;
  }

  // New methods for enhanced status tracking - five state workflow
  // NEW → COOKING → PLATING → READY → SERVED

  // Transition from NEW to COOKING
  async fireOrderItem(id: string): Promise<OrderItem | undefined> {
    // Get the order item to calculate readyAt
    const [orderItem] = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.id, id));

    if (!orderItem) return undefined;

    // Get the menu item to ensure we have the station and proper cook time
    const menuItem = await this.getMenuItemById(orderItem.menuItemId);
    const station = orderItem.station || (menuItem ? menuItem.station : null);

    // IMPORTANT: Always ensure we have a valid non-zero cookSeconds value
    // First try to use menu item's prep_seconds, then fall back to DEFAULT_COOK_SECONDS
    let cookTimeSeconds: number;

    // Get the value from menu item if available (primary source)
    if (menuItem && menuItem.prep_seconds > 0) {
      cookTimeSeconds = menuItem.prep_seconds;
      console.log(`Using menu item prep_seconds (${cookTimeSeconds}s) for item ${id}`);
    } 
    // Otherwise try to use existing orderItem.cookSeconds if it's valid
    else if (orderItem.cookSeconds && orderItem.cookSeconds > 0) {
      cookTimeSeconds = orderItem.cookSeconds;
      console.log(`Using existing orderItem.cookSeconds (${cookTimeSeconds}s) for item ${id}`);
    } 
    // Last resort: use default cook time
    else {
      // Import from constants to ensure we're using the same default value
      const { DEFAULT_COOK_SECONDS } = require('./constants');
      cookTimeSeconds = DEFAULT_COOK_SECONDS;
      console.log(`Using DEFAULT_COOK_SECONDS (${cookTimeSeconds}s) for item ${id}`);
    }

    // Double check we have a positive value
    if (cookTimeSeconds <= 0) cookTimeSeconds = 300;

    try {
      // Update status and all timing fields using the Drizzle ORM to avoid timestamp type issues
      const [updatedOrderItem] = await db
        .update(orderItems)
        .set({
          status: OrderItemStatus.COOKING,
          firedAt: new Date(),
          startedAt: new Date(),
          // Since readyAt is a timestamp with timezone, we need to recalculate it here
          // rather than relying on SQL date arithmetic which can have timezone issues
          readyAt: new Date(Date.now() + cookTimeSeconds * 1000),
          // IMPORTANT: Always set cookSeconds when firing an item to ensure timers work correctly
          cookSeconds: cookTimeSeconds,
          station: station || undefined,
          completed: false
        })
        .where(eq(orderItems.id, id))
        .returning();

      // Update parent order status to COOKING if needed
      if (updatedOrderItem) {
        // Get the order
        const order = await this.getOrderById(updatedOrderItem.orderId);
        if (order && order.status !== OrderStatus.COOKING) {
          // Update order status to cooking
          await this.updateOrderStatus(order.id, OrderStatus.COOKING);
        }
      }

      return updatedOrderItem;
    } catch (error) {
      console.error(`Error firing order item ${id}:`, error);
      return undefined;
    }
  }

  // Helper to get station by menu item ID
  private async getMenuItemStationById(menuItemId: string): Promise<string | null> {
    try {
      const menuItem = await this.getMenuItemById(menuItemId);
      return menuItem?.station || null;
    } catch (error) {
      console.error(`Error fetching station for menu item ${menuItemId}:`, error);
      return null;
    }
  }

  // Transition from COOKING to PLATING
  async markOrderItemPlating(id: string): Promise<OrderItem | undefined> {
    // Get the order item
    const [orderItem] = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.id, id));

    if (!orderItem) return undefined;
    if (orderItem.status !== OrderItemStatus.COOKING) {
      console.warn(`Cannot transition item ${id} to PLATING because its status is ${orderItem.status}`);
      return orderItem;
    }

    // Get the menu item to ensure we have the station
    const menuItem = await this.getMenuItemById(orderItem.menuItemId);
    const station = orderItem.station || (menuItem ? menuItem.station : null);

    try {
      // Update using Drizzle ORM instead of direct SQL to avoid timestamp type issues
      const [updatedOrderItem] = await db
        .update(orderItems)
        .set({
          status: OrderItemStatus.PLATING,
          platingAt: new Date(), // Current time
          // Update readyAt to be 2 minutes from now
          readyAt: new Date(Date.now() + 120 * 1000),
          station: station || undefined,
          // Not fully completed yet, but in progress
          completed: false
        })
        .where(eq(orderItems.id, id))
        .returning();

      // Update parent order status based on all items' statuses
      if (updatedOrderItem) {
        // Use the updateOrderStatusBasedOnItems method to determine the correct status
        // This will check if ALL items are at least in progress before setting PLATING
        await this.updateOrderStatusBasedOnItems(updatedOrderItem.orderId);
      }

      return updatedOrderItem;
    } catch (error) {
      console.error(`Error marking order item ${id} as plating:`, error);
      return undefined;
    }
  }

  async markOrderItemReady(id: string): Promise<OrderItem | undefined> {
    // Get the order item to ensure we have the station
    const [orderItem] = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.id, id));

    if (!orderItem) return undefined;

    // Get the menu item to ensure we have the station
    const menuItem = await this.getMenuItemById(orderItem.menuItemId);
    const station = orderItem.station || (menuItem ? menuItem.station : null);

    try {
      // Update using Drizzle ORM to avoid timestamp type issues
      const [updatedOrderItem] = await db
        .update(orderItems)
        .set({
          status: OrderItemStatus.READY,
          readyAt: new Date(), // Current time for ready_at
          actualReadyAt: new Date(), // Current time for actual_ready_at
          station: station || undefined,
          completed: true // Set completed flag to true
        })
        .where(eq(orderItems.id, id))
        .returning();

      // Update parent order status if appropriate
      if (updatedOrderItem) {
        // Check if all items in the order are READY or DELIVERED
        await this.updateOrderStatusBasedOnItems(updatedOrderItem.orderId);
      }

      return updatedOrderItem;
    } catch (error) {
      console.error(`Error marking order item ${id} as ready:`, error);
      return undefined;
    }
  }

  // Check all order items and update order status accordingly
  private async updateOrderStatusBasedOnItems(orderId: string): Promise<void> {
    // Get all order items for this order
    const items = await this.getOrderItems(orderId);

    // No items, nothing to do
    if (items.length === 0) return;

    // If any item is cooking, the order is cooking
    const hasCookingItems = items.some(item => item.status === OrderItemStatus.COOKING);
    if (hasCookingItems) {
      await this.updateOrderStatus(orderId, OrderStatus.COOKING);
      return;
    }

    // For PLATING status: 
    // Only set order to PLATING if:
    // 1. At least one item is in PLATING status AND
    // 2. ALL other items are either COOKING, PLATING, READY, or DELIVERED (no NEW items)
    const hasPlatingItems = items.some(item => item.status === OrderItemStatus.PLATING);
    const hasNewItems = items.some(item => item.status === OrderItemStatus.NEW || item.status === null);

    if (hasPlatingItems && !hasNewItems) {
      await this.updateOrderStatus(orderId, OrderStatus.PLATING);
      return;
    }

    // If all items are READY or DELIVERED, and at least one is READY, order is READY
    const allReadyOrDelivered = items.every(item => 
      item.status === OrderItemStatus.READY || 
      item.status === OrderItemStatus.DELIVERED
    );
    const hasReadyItems = items.some(item => item.status === OrderItemStatus.READY);

    if (allReadyOrDelivered && hasReadyItems) {
      await this.updateOrderStatus(orderId, OrderStatus.READY);
      return;
    }

    // If all items are DELIVERED, order is SERVED
    const allDelivered = items.every(item => item.status === OrderItemStatus.DELIVERED);
    if (allDelivered) {
      await this.updateOrderStatus(orderId, OrderStatus.SERVED);
      return;
    }
  }

  async markOrderItemDelivered(id: string): Promise<OrderItem | undefined> {
    // Get the order item 
    const [orderItem] = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.id, id));

    if (!orderItem) return undefined;

    // Get the menu item to ensure we have the station
    const menuItem = await this.getMenuItemById(orderItem.menuItemId);
    const station = orderItem.station || (menuItem ? menuItem.station : null);

    try {
      // Update using Drizzle ORM to avoid timestamp type issues
      const [updatedOrderItem] = await db
        .update(orderItems)
        .set({
          status: OrderItemStatus.DELIVERED,
          deliveredAt: new Date(), // Current time for delivered_at
          servedAt: new Date(), // Current time for served_at
          station: station || undefined,
          completed: true
        })
        .where(eq(orderItems.id, id))
        .returning();

      // Update parent order status if appropriate
      if (updatedOrderItem) {
        // Check if all items in the order are delivered
        await this.updateOrderStatusBasedOnItems(updatedOrderItem.orderId);
      }

      return updatedOrderItem;
    } catch (error) {
      console.error(`Error marking order item ${id} as delivered:`, error);
      return undefined;
    }
  }

  // New convenience methods with shorter names for the workflow script
  async markFired(id: string): Promise<OrderItem | undefined> {
    // Call the more robust fireOrderItem method instead
    // This ensures we use the same logic and avoid duplicate implementations
    console.log(`markFired called - forwarding to fireOrderItem for item ${id}`);
    return this.fireOrderItem(id);
  }

  async markPlating(id: string): Promise<OrderItem | undefined> {
    return this.markOrderItemPlating(id);
  }

  async markReady(id: string): Promise<OrderItem | undefined> {
    // Call the more robust markOrderItemReady method instead
    // This ensures we use the same logic and avoid duplicate implementations
    console.log(`markReady called - forwarding to markOrderItemReady for item ${id}`);
    return this.markOrderItemReady(id);
  }

  async markDelivered(id: string): Promise<OrderItem | undefined> {
    return this.markOrderItemDelivered(id);
  }

  // Automatically find and mark items as ready that have exceeded their cook time
  async autoFlipReady(): Promise<OrderItem[]> {
    const now = new Date();

    // Use direct SQL query to avoid Drizzle ORM operator issues
    const { rows: readyItems } = await pool.query(`
      SELECT * FROM order_items 
      WHERE status = 'COOKING' 
      AND ready_at IS NOT NULL 
      AND ready_at <= NOW()
    `);

    console.log(`Found ${readyItems.length} items that should be marked as ready`);

    // Return the items but DON'T automatically transition them
    // This allows the UI to highlight them for kitchen staff attention
    return readyItems as OrderItem[];
  }

  async getOrderItemsByStation(station: string, status?: string): Promise<OrderItem[]> {
    if (status) {
      return db
        .select()
        .from(orderItems)
        .where(
          and(
            eq(orderItems.station, station),
            // Use the string value directly rather than enum comparison
            eq(orderItems.status, status as any)
          )
        )
        .orderBy(asc(orderItems.firedAt)); // Sort by fire time if applicable
    } else {
      return db
        .select()
        .from(orderItems)
        .where(eq(orderItems.station, station))
        .orderBy(asc(orderItems.firedAt)); // Sort by fire time if applicable
    }
  }

  // Initialize with sample data
  async initializeData(): Promise<void> {
    // This method is for development/testing purposes
    // In a production app, you'd typically have migrations and seed scripts
    console.log("Database already initialized!");
  }
  async recalcBayStatus(bayId: string): Promise<void> {
    // Import the WebSocket functionality dynamically to avoid circular imports
    const { broadcastUpdate } = await import('./ws');
    
    const rows = await db.select({ status: orderItems.status })
       .from(orderItems)
       .leftJoin(orders, eq(orders.id, orderItems.orderId))
       .where(and(eq(orders.bayId, bayId),
                  notInArray(orders.status, ["CLOSED", "CANCELLED"])));

    const s = rows.map(r => r.status);
    let bayStatus: "AVAILABLE" | "NEW" | "COOKING" | "PLATING" | "READY" = "AVAILABLE";
    if (s.includes("NEW")) bayStatus = "NEW";
    else if (s.includes("COOKING")) bayStatus = "COOKING";
    else if (s.includes("PLATING")) bayStatus = "PLATING";
    else if (s.length && s.every(x => x === "READY")) bayStatus = "READY";

    await db.update(bays).set({ status: bayStatus }).where(eq(bays.id, bayId));
    const bay = await db.query.bays.findFirst({ where: eq(bays.id, bayId) });
    
    if (bay) {
      // Broadcast the bay update to all clients with the correct WebSocket message format
      broadcastUpdate('bay_updated', { bay: toBayDTO(bay) });
      console.log(`Broadcasted bay update for bay ${bayId}, new status: ${bayStatus}`);
    } else {
      console.error(`Could not find bay with ID ${bayId} to broadcast update`);
    }
  }
  async markOrderServed(orderId: string) {
    // First, update the order status
    const updateOrderResult = await db
      .update(orders)
      .set({
        status: OrderStatus.SERVED,
        servedAt: new Date(),
      })
      .where(eq(orders.id, orderId))
      .returning();

    if (!updateOrderResult || updateOrderResult.length === 0) {
      throw new Error(`Failed to update order ${orderId} to SERVED status`);
    }

    const ord = updateOrderResult[0];

    // Then, update all items for this order to SERVED status
    await db
      .update(orderItems)
      .set({
        status: OrderItemStatus.SERVED,
        servedAt: new Date(),
      })
      .where(and(
        eq(orderItems.orderId, orderId),
        not(eq(orderItems.status, OrderItemStatus.CANCELLED))
      ));

    // Fetch the updated order with items
    const completeOrder = await this.getOrderWithItems(orderId);

    // Import the WebSocket functionality dynamically to avoid circular imports
    const { broadcastUpdate } = await import('./ws');
    
    // Broadcast update
    broadcastUpdate('ORDER_SERVED', {
      order: completeOrder,
    });

    await this.recalcBayStatus(ord.bayId);
    return ord;
  }
}

export const storage = new DatabaseStorage();