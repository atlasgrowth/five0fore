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
  
  // Optimized combined operations
  markItemPlatingWithContext(id: string): Promise<{
    updatedItem: OrderItem | undefined;
    order: Order | undefined;
    bay: Bay | undefined;
    updatedOrderStatus?: string;
  }>;

  // New methods for enhanced status tracking
  fireOrderItem(id: string): Promise<OrderItem | undefined>; // Sets status to COOKING and captures firedAt timestamp
  markOrderItemPlating(id: string): Promise<OrderItem | undefined>; // Sets status to PLATING and captures platingAt timestamp
  markOrderItemReady(id: string): Promise<OrderItem | undefined>; // Sets status to READY and captures actualReadyAt timestamp
  markOrderItemDelivered(id: string): Promise<OrderItem | undefined>; // Sets status to DELIVERED and captures servedAt timestamp
  getOrderItemsByStation(station: string, status?: string): Promise<OrderItem[]>; // Filtered by station and optional status

  // Initialize with sample data
  initializeData(): Promise<void>;
  recalcBayStatus(bayId: number): Promise<void>;
}

// Import database instance and helpers
import { db, pool } from "./db";
import { eq, asc, desc, and, or, isNotNull, isNull, lt, notInArray, ne, sql, inArray } from "drizzle-orm";

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
    try {
      // Import WebSocket functionality dynamically to avoid circular imports
      const { broadcastUpdate } = await import('./ws');
      
      // Update the bay status in the database
      const [updatedBay] = await db
        .update(bays)
        .set({ status })
        .where(eq(bays.id, id))
        .returning();
      
      if (!updatedBay) {
        console.warn(`Failed to update bay ${id} status to ${status}`);
        return undefined;
      }
      
      // Get any active orders for this bay to include in the update message
      const bayOrders = await this.getOrdersByBayId(id);
      
      // Format the message according to BayUpdatedMessage type
      const bayUpdateMessage = {
        bay: toBayDTO(updatedBay),
        orders: bayOrders.map(order => toOrderDTO(order)),
        status: updatedBay.status
      };
      
      // Broadcast the bay update with its new status to all clients
      console.log(`Broadcasting bay status update: Bay ${id} -> ${status}`);
      broadcastUpdate('bay_updated', bayUpdateMessage);
      
      return updatedBay;
    } catch (error) {
      console.error(`Error updating bay ${id} status to ${status}:`, error);
      return undefined;
    }
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

  async getActiveOrders(): Promise<any[]> { // Use any to bypass type checking temporarily
    // Import helper functions for attention levels and priority calculation
    const { 
      calculateAttentionLevel, 
      calculatePriorityScore, 
      DEFAULT_COOK_SECONDS 
    } = await import('./constants');
    
    // Performance optimization - cache the following instead of querying for each order
    console.log("Performance Optimized getActiveOrders - Loading all bays and order items at once");
    
    // 1. Get all bays and index them by id for fast lookup
    const allBays = await db.select().from(bays);
    const bayMap = new Map(allBays.map(bay => [bay.id, bay]));
    
    // 2. Get count of order items per order
    // This replaces individual "getOrderItems" calls with a single aggregation query
    const orderItemCounts = await db
      .select({
        orderId: orderItems.orderId,
        count: sql`count(*)`,
        totalQuantity: sql`sum(${orderItems.quantity})`,
        maxCookSeconds: sql`max(${orderItems.cookSeconds})`
      })
      .from(orderItems)
      .groupBy(orderItems.orderId);
    
    // Create a map for faster lookups
    const orderItemsMap = new Map(
      orderItemCounts.map(row => [
        row.orderId, 
        { 
          count: Number(row.count), 
          totalQuantity: Number(row.totalQuantity || 0),
          maxCookSeconds: Number(row.maxCookSeconds || DEFAULT_COOK_SECONDS)
        }
      ])
    );
    
    // Get ALL orders to display in ALL tabs - both active and closed/served
    const activeOrders = await db
      .select()
      .from(orders)
      .orderBy(asc(orders.createdAt));

    // Default settings (instead of querying the database for now)
    // This avoids the error with missing columns until we migrate the database
    const settings = {
      loadFactor: 1.0,
      attentionThreshold: 0.8,
      priorityThreshold: 1.0, 
      criticalThreshold: 1.25,
      waitRatioWeight: 2.0,
      orderAgeWeight: 1.0,
      cookComplexityWeight: 0.5,
      loadFactorDamping: 0.5
    };

    // Process orders using the pre-loaded data
    const summaries = activeOrders.map((order) => {
      // Get the bay from our map instead of querying the database
      const bay = bayMap.get(order.bayId);
      
      // Get items info from our pre-computed map
      const itemsInfo = orderItemsMap.get(order.id) || { 
        count: 0, 
        totalQuantity: 0,
        maxCookSeconds: DEFAULT_COOK_SECONDS
      };

      // Calculate how many minutes ago the order was created
      const now = new Date();
      const createdAt = new Date(order.createdAt);
      const timeElapsed = Math.floor((now.getTime() - createdAt.getTime()) / 60000);

      // Use the pre-computed longest cook time
      const longestCookTime = itemsInfo.maxCookSeconds || DEFAULT_COOK_SECONDS;

      // Calculate attention level based on thresholds
      const attentionLevel = calculateAttentionLevel(
        order.estimatedCompletionTime,
        settings.attentionThreshold,
        settings.priorityThreshold,
        settings.criticalThreshold
      );
      
      // Calculate priority score for this order
      const priority = calculatePriorityScore(
        createdAt,
        order.estimatedCompletionTime,
        itemsInfo.totalQuantity,
        longestCookTime,
        settings.waitRatioWeight,
        settings.orderAgeWeight,
        settings.cookComplexityWeight
      );

      // For backward compatibility - map attention level to isDelayed
      // Anything above NORMAL is considered "delayed" in the old system
      const isDelayed = attentionLevel !== schema.AttentionLevel.NORMAL;

      return {
        id: order.id,
        orderNumber: `#${order.id.substring(0, 6)}`, // Generate order number from ID
        bayId: order.bayId,
        bayNumber: bay?.number,
        floor: bay?.floor || 0,
        status: order.status,
        createdAt: order.createdAt,
        timeElapsed,
        totalItems: itemsInfo.totalQuantity,
        isDelayed,
        attentionLevel, // New field for 3-tier attention system
        priority, // Numerical priority score for sorting
        estimatedCompletionTime: order.estimatedCompletionTime,
        seatingType: bay?.type,
        displayName: bay?.displayName
      };
    });

    // Sort by priority score (higher priority first)
    summaries.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    
    return summaries;
  }

  async getOrdersByStatus(status: string): Promise<any[]> { // Use any to bypass type checking temporarily
    // Import helper functions for attention levels and priority calculation
    const { 
      calculateAttentionLevel, 
      calculatePriorityScore, 
      DEFAULT_COOK_SECONDS 
    } = await import('./constants');
    
    // Performance optimization - cache the following instead of querying for each order
    console.log(`Performance Optimized getOrdersByStatus(${status}) - Loading all bays and order items at once`);
    
    // 1. Get all bays and index them by id for fast lookup
    const allBays = await db.select().from(bays);
    const bayMap = new Map(allBays.map(bay => [bay.id, bay]));
    
    // 2. Get only orders with the requested status
    const ordersWithStatus = await db
      .select()
      .from(orders)
      .where(eq(orders.status, status.toUpperCase()))
      .orderBy(asc(orders.createdAt));
    
    // Get IDs of all matching orders for efficient query
    const orderIds = ordersWithStatus.map(order => order.id);
    
    if (orderIds.length === 0) {
      return []; // No orders with this status, return empty array
    }
    
    // 3. Get count of order items per order in a single query
    // This replaces individual "getOrderItems" calls with a single aggregation query
    const orderItemCounts = await db
      .select({
        orderId: orderItems.orderId,
        count: sql`count(*)`,
        totalQuantity: sql`sum(${orderItems.quantity})`,
        maxCookSeconds: sql`max(${orderItems.cookSeconds})`
      })
      .from(orderItems)
      .where(inArray(orderItems.orderId, orderIds))
      .groupBy(orderItems.orderId);
    
    // Create a map for faster lookups
    const orderItemsMap = new Map(
      orderItemCounts.map(row => [
        row.orderId, 
        { 
          count: Number(row.count), 
          totalQuantity: Number(row.totalQuantity || 0),
          maxCookSeconds: Number(row.maxCookSeconds || DEFAULT_COOK_SECONDS)
        }
      ])
    );

    // Default settings (instead of querying the database for now)
    // This avoids the error with missing columns until we migrate the database
    const settings = {
      loadFactor: 1.0,
      attentionThreshold: 0.8,
      priorityThreshold: 1.0, 
      criticalThreshold: 1.25,
      waitRatioWeight: 2.0,
      orderAgeWeight: 1.0,
      cookComplexityWeight: 0.5,
      loadFactorDamping: 0.5
    };

    // Process orders using the pre-loaded data
    const summaries = ordersWithStatus.map((order) => {
      // Get the bay from our map instead of querying the database
      const bay = bayMap.get(order.bayId);
      
      // Get items info from our pre-computed map
      const itemsInfo = orderItemsMap.get(order.id) || { 
        count: 0, 
        totalQuantity: 0,
        maxCookSeconds: DEFAULT_COOK_SECONDS
      };

      // Calculate how many minutes ago the order was created
      const now = new Date();
      const createdAt = new Date(order.createdAt);
      const timeElapsed = Math.floor((now.getTime() - createdAt.getTime()) / 60000);

      // Use the pre-computed longest cook time
      const longestCookTime = itemsInfo.maxCookSeconds || DEFAULT_COOK_SECONDS;

      // Calculate attention level based on thresholds
      const attentionLevel = calculateAttentionLevel(
        order.estimatedCompletionTime,
        settings.attentionThreshold,
        settings.priorityThreshold,
        settings.criticalThreshold
      );
      
      // Calculate priority score for this order
      const priority = calculatePriorityScore(
        createdAt,
        order.estimatedCompletionTime,
        itemsInfo.totalQuantity,
        longestCookTime,
        settings.waitRatioWeight,
        settings.orderAgeWeight,
        settings.cookComplexityWeight
      );

      // For backward compatibility - map attention level to isDelayed
      const isDelayed = attentionLevel !== schema.AttentionLevel.NORMAL;

      return {
        id: order.id,
        orderNumber: `#${order.id.substring(0, 6)}`, // Generate order number from ID
        bayId: order.bayId,
        bayNumber: bay?.number,
        floor: bay?.floor || 0,
        status: order.status,
        createdAt: order.createdAt,
        timeElapsed,
        totalItems: itemsInfo.totalQuantity,
        isDelayed,
        attentionLevel, // New field for 3-tier attention system
        priority, // Numerical priority score for sorting
        estimatedCompletionTime: order.estimatedCompletionTime,
        seatingType: bay?.type,
        displayName: bay?.displayName
      };
    });

    // Sort by priority score (higher priority first)
    summaries.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    
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

    // Default settings (instead of querying the database)
    // This avoids the error with missing columns until we migrate the database
    const loadFactor = 1.0;

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
  
  // Optimized method that performs all required operations for plating in a single method
  // This reduces the number of database calls and provides all context needed for WebSocket updates
  async markItemPlatingWithContext(id: string): Promise<{
    updatedItem: OrderItem | undefined;
    order: Order | undefined;
    bay: Bay | undefined;
    updatedOrderStatus?: string;
  }> {
    // Get the order item with a single query
    const [orderItem] = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.id, id));
      
    if (!orderItem) {
      console.warn(`Cannot mark plating - order item ${id} not found`);
      return { updatedItem: undefined, order: undefined, bay: undefined };
    }
    
    if (orderItem.status !== OrderItemStatus.COOKING) {
      console.warn(`Cannot transition item ${id} to PLATING because its status is ${orderItem.status}`);
      return { 
        updatedItem: orderItem, 
        order: undefined, 
        bay: undefined,
        updatedOrderStatus: undefined
      };
    }
    
    // Get the menu item to ensure we have the station (if needed)
    let station = orderItem.station;
    if (!station) {
      const menuItem = await this.getMenuItemById(orderItem.menuItemId);
      station = menuItem ? menuItem.station : null;
    }
    
    try {
      // 1. Update the order item status
      const [updatedItem] = await db
        .update(orderItems)
        .set({
          status: OrderItemStatus.PLATING,
          platingAt: new Date(),
          readyAt: new Date(Date.now() + 120 * 1000), // 2 minutes from now
          station: station || undefined,
          completed: false
        })
        .where(eq(orderItems.id, id))
        .returning();
      
      if (!updatedItem) {
        console.error(`Failed to update order item ${id} to PLATING status`);
        return { updatedItem: undefined, order: undefined, bay: undefined };
      }
      
      // 2. Get all items for this order in a single query to determine order status
      const items = await db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, orderItem.orderId));
      
      // 3. Determine the new order status based on all items
      let newOrderStatus = OrderStatus.NEW;
      
      const hasCookingItems = items.some(item => item.status === OrderItemStatus.COOKING);
      if (hasCookingItems) {
        newOrderStatus = OrderStatus.COOKING;
      } else {
        const hasPlatingItems = items.some(item => item.status === OrderItemStatus.PLATING);
        const hasNewItems = items.some(item => item.status === OrderItemStatus.NEW || item.status === null);
        
        if (hasPlatingItems && !hasNewItems) {
          newOrderStatus = OrderStatus.PLATING;
        } else {
          const allReadyOrDelivered = items.every(item => 
            item.status === OrderItemStatus.READY || 
            item.status === OrderItemStatus.DELIVERED
          );
          const hasReadyItems = items.some(item => item.status === OrderItemStatus.READY);
          
          if (allReadyOrDelivered && hasReadyItems) {
            newOrderStatus = OrderStatus.READY;
          } else if (items.every(item => item.status === OrderItemStatus.DELIVERED)) {
            newOrderStatus = OrderStatus.SERVED;
          }
        }
      }
      
      // 4. Update the order status if needed
      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, orderItem.orderId));
        
      if (!order) {
        console.error(`Order ${orderItem.orderId} not found for item ${id}`);
        return { 
          updatedItem, 
          order: undefined, 
          bay: undefined,
          updatedOrderStatus: newOrderStatus
        };
      }
      
      // Only update if status changed
      let updatedOrder = order;
      if (order.status !== newOrderStatus) {
        [updatedOrder] = await db
          .update(orders)
          .set({ status: newOrderStatus })
          .where(eq(orders.id, order.id))
          .returning();
      }
      
      // 5. Get the bay info for WebSocket updates
      const [bay] = await db
        .select()
        .from(bays)
        .where(eq(bays.id, updatedOrder.bayId));
        
      // Return all context for the caller
      return {
        updatedItem,
        order: updatedOrder,
        bay: bay || undefined,
        updatedOrderStatus: newOrderStatus
      };
    } catch (error) {
      console.error(`Error in markItemPlatingWithContext for item ${id}:`, error);
      return { updatedItem: undefined, order: undefined, bay: undefined };
    }
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
  async recalcBayStatus(bayId: number): Promise<void> {
    // Import the WebSocket functionality dynamically to avoid circular imports
    const { broadcastUpdate } = await import('./ws');
    
    console.log(`Recalculating status for bay ${bayId}...`);
    
    try {
      // Make sure we're using a number for bayId since it's stored as a number in the database
      const bayIdNum = Number(bayId);
      
      const rows = await db.select({ status: orderItems.status })
         .from(orderItems)
         .leftJoin(orders, eq(orders.id, orderItems.orderId))
         .where(and(eq(orders.bayId, bayIdNum),
                    notInArray(orders.status, ["CLOSED", "CANCELLED"])));

      console.log(`Found ${rows.length} active order items for bay ${bayId}`);
      
      const s = rows.map(r => r.status);
      let bayStatus = "empty"; // Default for no orders - use lowercase to match client expectations
      
      // Now using proper case handling and case-consistent status values
      if (s.some(status => status?.toLowerCase() === "new")) {
        bayStatus = "new";
      } else if (s.some(status => status?.toLowerCase() === "cooking")) {
        bayStatus = "cooking";
      } else if (s.some(status => status?.toLowerCase() === "plating")) {
        bayStatus = "plating";
      } else if (s.length > 0 && s.every(status => status?.toLowerCase() === "ready")) {
        bayStatus = "ready";
      } else if (s.length > 0 && s.every(status => status?.toLowerCase() === "served")) {
        bayStatus = "served";
      }

      console.log(`Setting bay ${bayId} status to: ${bayStatus} based on items:`, s);
      
      // Update the bay status
      await db.update(bays).set({ status: bayStatus }).where(eq(bays.id, bayIdNum));
      
      // Get the updated bay to send in the broadcast
      const bay = await db.query.bays.findFirst({ where: eq(bays.id, bayIdNum) });
      
      if (bay) {
        // Broadcast the bay update to all clients with the correct WebSocket message format
        console.log(`Broadcasting bay update for bay ${bayId}, new status: ${bayStatus}`);
        
        // Get active orders for this bay to include in the update
        const bayOrders = await this.getOrdersByBayId(bayIdNum);
        
        broadcastUpdate('bay_updated', { 
          bay: toBayDTO(bay),
          orders: bayOrders.map(toOrderDTO),
          status: bay.status
        });
      } else {
        console.error(`Could not find bay with ID ${bayId} to broadcast update`);
      }
    } catch (error) {
      console.error(`Error recalculating bay status for bay ${bayId}:`, error);
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