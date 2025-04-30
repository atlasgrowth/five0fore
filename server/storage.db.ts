import { 
  users, type User, type InsertUser,
  categories, type Category, type InsertCategory,
  menuItems, type MenuItem, type InsertMenuItem,
  bays, type Bay, type InsertBay,
  orders, type Order, type InsertOrder, 
  orderItems, type OrderItem, type InsertOrderItem,
  type OrderWithItems, type OrderSummary, type Cart
} from "../shared/schema";
import { db } from './db';
import { desc, eq, and, inArray } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { IStorage } from "./storage";

export class DatabaseStorage implements IStorage {
  // Users (not used in this version, but keeping the interface for compatibility)
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }
  
  // Categories
  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories);
  }

  async getCategoryById(id: number): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.id, id));
    return category;
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [newCategory] = await db.insert(categories).values(category).returning();
    return newCategory;
  }
  
  // Menu Items
  async getMenuItems(): Promise<MenuItem[]> {
    return await db.select().from(menuItems);
  }

  async getMenuItemsByCategory(categoryId: number): Promise<MenuItem[]> {
    return await db.select().from(menuItems).where(eq(menuItems.categoryId, categoryId));
  }

  async getMenuItemById(id: number): Promise<MenuItem | undefined> {
    const [menuItem] = await db.select().from(menuItems).where(eq(menuItems.id, id));
    return menuItem;
  }

  async createMenuItem(menuItem: InsertMenuItem): Promise<MenuItem> {
    const [newMenuItem] = await db.insert(menuItems).values(menuItem).returning();
    return newMenuItem;
  }
  
  // Bays
  async getBays(): Promise<Bay[]> {
    return await db.select().from(bays);
  }

  async getBaysByFloor(floor: number): Promise<Bay[]> {
    return await db.select().from(bays).where(eq(bays.floor, floor));
  }

  async getBayByNumber(number: number): Promise<Bay | undefined> {
    const [bay] = await db.select().from(bays).where(eq(bays.number, number));
    return bay;
  }

  async getBayById(id: number): Promise<Bay | undefined> {
    const [bay] = await db.select().from(bays).where(eq(bays.id, id));
    return bay;
  }

  async createBay(bay: InsertBay): Promise<Bay> {
    const [newBay] = await db.insert(bays).values(bay).returning();
    return newBay;
  }

  async updateBayStatus(id: number, status: string): Promise<Bay | undefined> {
    const [updatedBay] = await db
      .update(bays)
      .set({ status })
      .where(eq(bays.id, id))
      .returning();
    return updatedBay;
  }
  
  // Orders
  async getOrders(): Promise<Order[]> {
    return await db.select().from(orders);
  }

  async getOrderById(id: number): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order;
  }

  async getOrderWithItems(id: number): Promise<OrderWithItems | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    if (!order) return undefined;
    
    const [bay] = await db.select().from(bays).where(eq(bays.id, order.bayId));
    if (!bay) return undefined;
    
    const orderItemsList = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
    
    const items = await Promise.all(orderItemsList.map(async (item) => {
      const [menuItem] = await db.select().from(menuItems).where(eq(menuItems.id, item.menuItemId));
      if (!menuItem) throw new Error(`MenuItem with id ${item.menuItemId} not found`);
      return { ...item, menuItem };
    }));
    
    return { ...order, bay, items };
  }

  async getOrdersByBayId(bayId: number): Promise<Order[]> {
    return await db.select().from(orders).where(eq(orders.bayId, bayId));
  }

  async getActiveOrders(): Promise<OrderSummary[]> {
    const activeOrders = await db
      .select()
      .from(orders)
      .where(inArray(orders.status, ['pending', 'preparing', 'ready']));
    
    return Promise.all(activeOrders.map(async (order) => {
      const [bay] = await db.select().from(bays).where(eq(bays.id, order.bayId));
      if (!bay) throw new Error(`Bay with id ${order.bayId} not found`);
      
      const orderItemsList = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
      
      const timeElapsed = Math.floor((Date.now() - order.createdAt.getTime()) / (1000 * 60));
      
      // Consider an order delayed if it's been more than 20 minutes since creation
      const isDelayed = timeElapsed > 20;
      
      return {
        id: order.id,
        orderNumber: order.orderNumber,
        bayId: order.bayId,
        bayNumber: bay.number,
        floor: bay.floor,
        status: order.status,
        createdAt: order.createdAt,
        timeElapsed,
        totalItems: orderItemsList.reduce((sum, item) => sum + item.quantity, 0),
        isDelayed,
      };
    }));
  }

  async getOrdersByStatus(status: string): Promise<OrderSummary[]> {
    const filteredOrders = await db
      .select()
      .from(orders)
      .where(eq(orders.status, status));
    
    return Promise.all(filteredOrders.map(async (order) => {
      const [bay] = await db.select().from(bays).where(eq(bays.id, order.bayId));
      if (!bay) throw new Error(`Bay with id ${order.bayId} not found`);
      
      const orderItemsList = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
      
      const timeElapsed = Math.floor((Date.now() - order.createdAt.getTime()) / (1000 * 60));
      const isDelayed = timeElapsed > 20;
      
      return {
        id: order.id,
        orderNumber: order.orderNumber,
        bayId: order.bayId,
        bayNumber: bay.number,
        floor: bay.floor,
        status: order.status,
        createdAt: order.createdAt,
        timeElapsed,
        totalItems: orderItemsList.reduce((sum, item) => sum + item.quantity, 0),
        isDelayed,
      };
    }));
  }

  async createOrder(insertOrder: InsertOrder, cart: Cart): Promise<Order> {
    // Generate a unique order number
    const orderNumber = `ORD-${Math.floor(Math.random() * 9000) + 1000}`;
    
    // Calculate estimated completion time based on menu items' prep times
    let maxPrepSeconds = 0;
    for (const item of cart.items) {
      const [menuItem] = await db
        .select()
        .from(menuItems)
        .where(eq(menuItems.id, item.menuItemId));
      
      if (menuItem && menuItem.prepSeconds > maxPrepSeconds) {
        maxPrepSeconds = menuItem.prepSeconds;
      }
    }
    
    const now = new Date();
    const estimatedCompletionTime = new Date(now.getTime() + maxPrepSeconds * 1000);
    
    // Insert the order
    const [order] = await db
      .insert(orders)
      .values({
        ...insertOrder,
        orderNumber,
        createdAt: now,
        estimatedCompletionTime,
        completedAt: null
      })
      .returning();
    
    // Create order items
    for (const item of cart.items) {
      await this.createOrderItem({
        orderId: order.id,
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        notes: "",
      });
    }
    
    // Update bay status to active
    await this.updateBayStatus(order.bayId, "active");
    
    return order;
  }

  async updateOrderStatus(id: number, status: string): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    if (!order) return undefined;
    
    const completedAt = ['served', 'cancelled'].includes(status) ? new Date() : order.completedAt;
    
    const [updatedOrder] = await db
      .update(orders)
      .set({ status, completedAt })
      .where(eq(orders.id, id))
      .returning();
    
    // If order is served or cancelled, update bay status
    if (status === 'served' || status === 'cancelled') {
      // Check if this is the only active order for this bay
      const bayOrders = await this.getOrdersByBayId(order.bayId);
      const activeOrders = bayOrders.filter(o => 
        o.id !== id && ['pending', 'preparing', 'ready'].includes(o.status)
      );
      
      if (activeOrders.length === 0) {
        await this.updateBayStatus(order.bayId, "occupied");
      }
    }
    
    return updatedOrder;
  }
  
  // Order Items
  async getOrderItems(orderId: number): Promise<OrderItem[]> {
    return await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  }

  async createOrderItem(orderItem: InsertOrderItem): Promise<OrderItem> {
    const [newOrderItem] = await db
      .insert(orderItems)
      .values({ ...orderItem, completed: false })
      .returning();
    return newOrderItem;
  }

  async updateOrderItemStatus(id: number, completed: boolean): Promise<OrderItem | undefined> {
    const [orderItem] = await db.select().from(orderItems).where(eq(orderItems.id, id));
    if (!orderItem) return undefined;
    
    const [updatedOrderItem] = await db
      .update(orderItems)
      .set({ completed })
      .where(eq(orderItems.id, id))
      .returning();
    
    // Check if all items in the order are completed
    const allItems = await this.getOrderItems(orderItem.orderId);
    const allCompleted = allItems.every(item => item.completed);
    
    // If all items are completed, update order status to ready
    if (allCompleted) {
      await this.updateOrderStatus(orderItem.orderId, "ready");
    }
    
    return updatedOrderItem;
  }
  
  // Initialize with sample data
  async initializeData(): Promise<void> {
    // Create bays if they don't exist
    const existingBays = await this.getBays();
    if (existingBays.length === 0) {
      console.log("Creating bays...");
      for (let floor = 1; floor <= 3; floor++) {
        for (let bayNum = 1; bayNum <= 33; bayNum++) {
          const bayNumber = (floor - 1) * 33 + bayNum;
          await this.createBay({
            number: bayNumber,
            floor,
            status: "empty",
          });
        }
      }
    }
    
    // Create some sample menu items if they don't exist
    const existingMenuItems = await this.getMenuItems();
    if (existingMenuItems.length === 0) {
      console.log("Creating sample menu items...");
      
      // Sample menu data - the actual data will come from the seedMenu script
      const menuData = [
        { name: "House-Made Guacamole & Chips", category: "Starters", price: 1400, station: "Cold", prepSeconds: 240 },
        { name: "Margherita Pizza", category: "Pizza & Flatbreads", price: 1600, station: "PizzaOven", prepSeconds: 720 },
        { name: "Crispy Fried Chicken Tenders", category: "Handhelds", price: 1600, station: "Fry", prepSeconds: 540 },
        { name: "Classic Caesar Salad", category: "Salads & Soups", price: 1200, station: "Cold", prepSeconds: 300 }
      ];
      
      for (const item of menuData) {
        await db.insert(menuItems).values({
          name: item.name,
          category: item.category,
          price_cents: item.price,
          station: item.station,
          prep_seconds: item.prepSeconds,
          description: `Delicious ${item.name}`,
          active: true
        });
      }
    }
  }
}