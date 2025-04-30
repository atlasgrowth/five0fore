import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { eq, and, desc, asc, sql } from 'drizzle-orm';
import ws from "ws";
import * as schema from "../shared/schema";
import { 
  Bay, InsertBay, 
  MenuItem, InsertMenuItem, 
  Order, InsertOrder, 
  OrderItem, InsertOrderItem,
  Cart,
  OrderSummary,
  OrderWithItems
} from "../shared/schema";

// Configure database connection
neonConfig.webSocketConstructor = ws;

// Create the database connection
const pool = new Pool({ connectionString: process.env.DATABASE_URL || '' });
const db = drizzle(pool, { schema });

// Storage interface implementation for PostgreSQL
export class DatabaseStorage {
  // Bays
  async getBays(): Promise<Bay[]> {
    return await db.select().from(schema.bays);
  }

  async getBaysByFloor(floor: number): Promise<Bay[]> {
    return await db.select().from(schema.bays)
      .where(eq(schema.bays.floor, floor));
  }

  async getBayByNumber(number: number): Promise<Bay | undefined> {
    const [bay] = await db.select().from(schema.bays)
      .where(eq(schema.bays.id, number));
    return bay;
  }

  async getBayById(id: number): Promise<Bay | undefined> {
    const [bay] = await db.select().from(schema.bays)
      .where(eq(schema.bays.id, id));
    return bay;
  }

  async createBay(bay: InsertBay): Promise<Bay> {
    const [created] = await db.insert(schema.bays)
      .values(bay)
      .returning();
    return created;
  }

  async updateBayStatus(id: number, status: string): Promise<Bay | undefined> {
    const [updated] = await db.update(schema.bays)
      .set({ status })
      .where(eq(schema.bays.id, id))
      .returning();
    return updated;
  }

  // Menu Items
  async getMenuItems(): Promise<MenuItem[]> {
    return await db.select().from(schema.menuItems);
  }

  async getMenuItemsByCategory(category: string): Promise<MenuItem[]> {
    return await db.select().from(schema.menuItems)
      .where(eq(schema.menuItems.category, category));
  }

  async getMenuItemById(id: string): Promise<MenuItem | undefined> {
    const [item] = await db.select().from(schema.menuItems)
      .where(eq(schema.menuItems.id, id));
    return item;
  }

  async createMenuItem(menuItem: InsertMenuItem): Promise<MenuItem> {
    const [item] = await db.insert(schema.menuItems)
      .values(menuItem)
      .returning();
    return item;
  }

  // Categories (derived from menu items - returns unique categories)
  async getCategories(): Promise<{id: number, name: string, slug: string}[]> {
    const result = await db.execute(
      sql`SELECT DISTINCT category as name, LOWER(REPLACE(category, ' ', '-')) as slug FROM menu_items`
    );
    
    return result.rows.map((row: any, index: number) => ({
      id: index + 1, // Generate sequential IDs
      name: row.name,
      slug: row.slug
    }));
  }

  async getCategoryById(id: number): Promise<{id: number, name: string, slug: string} | undefined> {
    const categories = await this.getCategories();
    return categories.find(cat => cat.id === id);
  }

  // Orders
  async getOrders(): Promise<Order[]> {
    return await db.select().from(schema.orders);
  }

  async getOrderById(id: string): Promise<Order | undefined> {
    const [order] = await db.select().from(schema.orders)
      .where(eq(schema.orders.id, id));
    return order;
  }

  async getOrdersByBayId(bayId: number): Promise<Order[]> {
    return await db.select().from(schema.orders)
      .where(eq(schema.orders.bayId, bayId));
  }

  async getOrderWithItems(id: string): Promise<OrderWithItems | undefined> {
    const [order] = await db.select().from(schema.orders)
      .where(eq(schema.orders.id, id));
    
    if (!order) return undefined;
    
    const bay = await this.getBayById(order.bayId);
    if (!bay) return undefined;
    
    const orderItems = await db.select().from(schema.orderItems)
      .where(eq(schema.orderItems.orderId, id));
    
    const items = await Promise.all(orderItems.map(async (item) => {
      const menuItem = await this.getMenuItemById(item.menuItemId);
      if (!menuItem) throw new Error(`MenuItem with id ${item.menuItemId} not found`);
      return { ...item, menuItem };
    }));
    
    return { ...order, bay, items };
  }

  async getActiveOrders(): Promise<OrderSummary[]> {
    // Include SERVED and CLOSED orders too, only exclude CANCELLED orders
    const activeOrders = await db.select().from(schema.orders)
      .where(sql`${schema.orders.status} IN ('NEW', 'COOKING', 'PLATING', 'READY', 'SERVED', 'CLOSED')`);
    
    const summaries = await Promise.all(activeOrders.map(async (order) => {
      const bay = await this.getBayById(order.bayId);
      if (!bay) throw new Error(`Bay with id ${order.bayId} not found`);
      
      const orderItems = await db.select().from(schema.orderItems)
        .where(eq(schema.orderItems.orderId, order.id));
      
      const timeElapsed = Math.floor(
        (Date.now() - order.createdAt.getTime()) / (1000 * 60)
      );
      
      const isDelayed = timeElapsed > 20; // Orders delayed after 20 minutes
      
      return {
        id: order.id,
        bayId: order.bayId,
        floor: bay.floor,
        status: order.status,
        createdAt: order.createdAt,
        timeElapsed,
        totalItems: orderItems.reduce((sum, item) => sum + item.qty, 0),
        isDelayed
      };
    }));
    
    return summaries;
  }

  async getOrdersByStatus(status: string): Promise<OrderSummary[]> {
    const statusOrders = await db.select().from(schema.orders)
      .where(eq(schema.orders.status, status));
    
    const summaries = await Promise.all(statusOrders.map(async (order) => {
      const bay = await this.getBayById(order.bayId);
      if (!bay) throw new Error(`Bay with id ${order.bayId} not found`);
      
      const orderItems = await db.select().from(schema.orderItems)
        .where(eq(schema.orderItems.orderId, order.id));
      
      const timeElapsed = Math.floor(
        (Date.now() - order.createdAt.getTime()) / (1000 * 60)
      );
      
      const isDelayed = timeElapsed > 20; // Orders delayed after 20 minutes
      
      return {
        id: order.id,
        bayId: order.bayId,
        floor: bay.floor,
        status: order.status,
        createdAt: order.createdAt,
        timeElapsed,
        totalItems: orderItems.reduce((sum, item) => sum + item.qty, 0),
        isDelayed
      };
    }));
    
    return summaries;
  }

  async createOrder(order: InsertOrder, cart: Cart): Promise<Order> {
    // Start a transaction
    const [newOrder] = await db.insert(schema.orders)
      .values(order)
      .returning();
    
    // Create order items and calculate readyBy times
    for (const item of cart.items) {
      const menuItem = await this.getMenuItemById(item.menuItemId);
      
      if (!menuItem) {
        throw new Error(`Menu item with id ${item.menuItemId} not found`);
      }
      
      const firedAt = new Date();
      const readyBy = new Date(firedAt.getTime() + menuItem.prepSeconds * 1000);
      
      await db.insert(schema.orderItems).values({
        orderId: newOrder.id,
        menuItemId: item.menuItemId,
        qty: item.quantity,
        firedAt,
        readyBy,
        notes: ""
      });
    }
    
    // Update the bay status
    await this.updateBayStatus(order.bayId, "active");
    
    return newOrder;
  }

  async updateOrderStatus(id: string, status: string): Promise<Order | undefined> {
    const [updatedOrder] = await db.update(schema.orders)
      .set({ status })
      .where(eq(schema.orders.id, id))
      .returning();
    
    // Update bay status based on order status
    if (updatedOrder) {
      // Get all active orders for this bay to determine the dominant status
      const allBayOrders = await db.select().from(schema.orders)
        .where(and(
          eq(schema.orders.bayId, updatedOrder.bayId),
          sql`${schema.orders.status} NOT IN ('SERVED', 'CLOSED', 'CANCELLED')`,
          sql`${schema.orders.id} != ${updatedOrder.id}`
        ));
      
      if (status === 'SERVED' || status === 'CANCELLED' || status === 'CLOSED') {
        // If no other active orders for this bay, update bay status to "empty"
        if (allBayOrders.length === 0) {
          await this.updateBayStatus(updatedOrder.bayId, "empty");
        } else {
          // Otherwise, update bay status based on the status of remaining orders
          await this.updateBayStatusFromOrders(updatedOrder.bayId, allBayOrders);
        }
      } else {
        // For other status updates, update bay status to match the order status
        // Include the current order with the updated status
        const allOrdersWithCurrent = [...allBayOrders, {...updatedOrder, status}];
        await this.updateBayStatusFromOrders(updatedOrder.bayId, allOrdersWithCurrent);
      }
    }
    
    return updatedOrder;
  }
  
  // Helper method to update bay status based on order statuses
  private async updateBayStatusFromOrders(bayId: number, orders: Order[]): Promise<void> {
    // If no orders, set to empty
    if (orders.length === 0) {
      await this.updateBayStatus(bayId, "empty");
      return;
    }
    
    // Determine the dominant status based on priority
    // Priority: READY > PLATING > COOKING > NEW
    let bayStatus = "active"; // Default 
    
    // Normalize all status checks to uppercase for consistency
    const orderStatuses = orders.map(order => order.status.toUpperCase());
    
    // Use string comparison instead of enum to avoid import issues
    // Check for READY orders
    if (orderStatuses.includes("READY")) {
      bayStatus = "ready";
    }
    // Check for PLATING orders (if no READY orders)
    else if (orderStatuses.includes("PLATING")) {
      bayStatus = "plating";
    }
    // Check for COOKING orders (if no READY or PLATING orders)
    else if (orderStatuses.includes("COOKING")) {
      bayStatus = "cooking";
    }
    // If only NEW orders
    else if (orderStatuses.includes("NEW")) {
      bayStatus = "active";
    }
    // Check for SERVED orders
    else if (orderStatuses.includes("SERVED")) {
      bayStatus = "served";
    } 
    // Check for CLOSED orders
    else if (orderStatuses.includes("CLOSED")) {
      bayStatus = "closed";
    }
    
    console.log(`Updating bay ${bayId} status to ${bayStatus} based on order statuses:`, orderStatuses);
    await this.updateBayStatus(bayId, bayStatus);
  }

  // Order Items
  async getOrderItems(orderId: string): Promise<OrderItem[]> {
    return await db.select().from(schema.orderItems)
      .where(eq(schema.orderItems.orderId, orderId));
  }

  async createOrderItem(orderItem: InsertOrderItem): Promise<OrderItem> {
    const [item] = await db.insert(schema.orderItems)
      .values(orderItem)
      .returning();
    return item;
  }

  async updateOrderItemStatus(id: string, completed: boolean): Promise<OrderItem | undefined> {
    const [updatedItem] = await db.update(schema.orderItems)
      .set({ completed })
      .where(eq(schema.orderItems.id, id))
      .returning();
    
    // Don't automatically update the order's status
    // This caused the issue where marking one item as ready would mark all as ready
    // Instead, let the kitchen staff explicitly choose when to mark the full order ready
    
    return updatedItem;
  }

  // Initialize database with default data
  async initializeData(): Promise<void> {
    // Create bays 1-100
    const existingBays = await db.select().from(schema.bays);
    
    if (existingBays.length === 0) {
      console.log('Initializing database with default data...');
      
      // Populate bays
      for (let floor = 1; floor <= 3; floor++) {
        for (let bayNum = 1; bayNum <= 33; bayNum++) {
          const bayId = (floor - 1) * 33 + bayNum;
          await db.insert(schema.bays).values({
            id: bayId,
            floor,
            status: "empty"
          });
        }
      }
      
      // Populate menu items
      const menuData = [
        { name: "Boudin Balls", category: "Shareables", price: 1250, station: "Fry", prepSeconds: 420 },
        { name: "504 Wings", category: "Shareables", price: 1400, station: "Fry", prepSeconds: 540 },
        { name: "Cajun Crawfish Pies", category: "Shareables", price: 1300, station: "Fry", prepSeconds: 480 },
        { name: "Smoked Tuna Dip with Cajun Fried Crackers", category: "Shareables", price: 1500, station: "Cold", prepSeconds: 300 },
        { name: "Pineapple Fried Shrimp with Sriracha Sesame Salad", category: "Shareables", price: 1400, station: "Fry", prepSeconds: 480 },
        { name: "Clubhouse Nachos", category: "Shareables", price: 1550, station: "Saute", prepSeconds: 540 },
        { name: "Just Chips and Salsa", category: "Shareables", price: 600, station: "Cold", prepSeconds: 180 },
        { name: "Plus Bowl of Queso", category: "Shareables", price: 800, station: "Saute", prepSeconds: 240 },
        { name: "Just Chips and Queso", category: "Shareables", price: 950, station: "Saute", prepSeconds: 240 },
        { name: "The Hangover", category: "Smashburgers", price: 1800, station: "FlatTop", prepSeconds: 660 },
        { name: "The Classic Ride", category: "Smashburgers", price: 1700, station: "FlatTop", prepSeconds: 600 },
        { name: "Electric Blue", category: "Smashburgers", price: 1850, station: "FlatTop", prepSeconds: 660 },
        { name: "Impossible Burger", category: "Smashburgers", price: 1700, station: "FlatTop", prepSeconds: 600 },
        { name: '504 12" Pizza', category: "Pizza & Flatbreads", price: 1700, station: "PizzaOven", prepSeconds: 900 },
        { name: "Cheesy Garlic Bread", category: "Pizza & Flatbreads", price: 1250, station: "PizzaOven", prepSeconds: 540 },
        { name: "Crazy Cajun Flatbread", category: "Pizza & Flatbreads", price: 2250, station: "PizzaOven", prepSeconds: 780 },
        { name: "Barbecue Chicken Pizza", category: "Pizza & Flatbreads", price: 2100, station: "PizzaOven", prepSeconds: 900 },
        { name: "Barbecue Chicken Flatbread Pizza", category: "Pizza & Flatbreads", price: 2100, station: "PizzaOven", prepSeconds: 780 },
        { name: "Street Party Tacos 'Al Pastor'", category: "Handhelds", price: 1600, station: "Saute", prepSeconds: 600 },
        { name: "Crispy Fried Chicken Tenders", category: "Handhelds", price: 1600, station: "Fry", prepSeconds: 540 },
        { name: "Steak Frites", category: "Entrées & Mains", price: 3800, station: "FlatTop", prepSeconds: 1200 },
        { name: "Shrimp Monique", category: "Entrées & Mains", price: 2400, station: "Saute", prepSeconds: 900 },
        { name: "Gulf Catch Creole", category: "Entrées & Mains", price: 2650, station: "FlatTop", prepSeconds: 960 },
        { name: "Golden Fried Seafood Platter", category: "Entrées & Mains", price: 2300, station: "Fry", prepSeconds: 780 },
        { name: "Make It a Double and Feed an Army", category: "Entrées & Mains", price: 4600, station: "Fry", prepSeconds: 1140 },
        { name: "Sand Wedge", category: "Salads & Soups", price: 1300, station: "Cold", prepSeconds: 300 },
        { name: "Classic Caesar Salad", category: "Salads & Soups", price: 1200, station: "Cold", prepSeconds: 300 },
        { name: "Strawberries & Goat Cheese Salad", category: "Salads & Soups", price: 1400, station: "Cold", prepSeconds: 300 },
        { name: "Chicken-Andouille Gumbo (Cup)", category: "Salads & Soups", price: 800, station: "Boil", prepSeconds: 480 },
        { name: "Chicken-Andouille Gumbo (Bowl)", category: "Salads & Soups", price: 1200, station: "Boil", prepSeconds: 600 },
        { name: "Garlic Grilled Vegetables", category: "Sides", price: 700, station: "FlatTop", prepSeconds: 360 },
        { name: "Crispy Kettle Fries", category: "Sides", price: 600, station: "Fry", prepSeconds: 360 },
        { name: "House Green Salad", category: "Sides", price: 800, station: "Cold", prepSeconds: 240 },
        { name: "Chips and Salsa", category: "Sides", price: 600, station: "Cold", prepSeconds: 180 },
        { name: "Plus Bowl of Queso (Side)", category: "Sides", price: 800, station: "Saute", prepSeconds: 240 },
        { name: "The Big Kid Burger", category: "Kids", price: 1200, station: "FlatTop", prepSeconds: 540 },
        { name: "Fried Chicken Tenders (Kids)", category: "Kids", price: 1200, station: "Fry", prepSeconds: 480 },
        { name: "On the Green (Key Lime Pie)", category: "Desserts", price: 800, station: "Cold", prepSeconds: 240 },
        { name: "Very Berry Cheesecake", category: "Desserts", price: 900, station: "Cold", prepSeconds: 240 },
        { name: "Pecan Chocolate Chip Bread Pudding", category: "Desserts", price: 1200, station: "Oven", prepSeconds: 600 }
      ];
      
      for (const item of menuData) {
        await db.insert(schema.menuItems).values({
          name: item.name,
          category: item.category,
          price: item.price,
          station: item.station,
          prepSeconds: item.prepSeconds,
          description: `Delicious ${item.name}`,
          active: true
        });
      }
      
      console.log('Database initialization complete!');
    }
  }

  // Helper functions for compatibility with existing code
  async getUser(id: number): Promise<any> {
    return undefined;
  }

  async getUserByUsername(username: string): Promise<any> {
    return undefined;
  }

  async createUser(user: any): Promise<any> {
    throw new Error('Users not implemented in database storage');
  }

  async createCategory(category: any): Promise<any> {
    throw new Error('Categories not implemented in database storage');
  }
}

// Create an instance of the storage
export const dbStorage = new DatabaseStorage();