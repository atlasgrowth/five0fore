import { 
  users, type User, type InsertUser,
  categories, type Category, type InsertCategory,
  menuItems, type MenuItem, type InsertMenuItem,
  bays, type Bay, type InsertBay,
  orders, type Order, type InsertOrder, 
  orderItems, type OrderItem, type InsertOrderItem,
  type OrderWithItems, type OrderSummary, type Cart
} from "@shared/schema";

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
  getMenuItemById(id: number): Promise<MenuItem | undefined>;
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
  updateOrderItemStatus(id: string, completed: boolean): Promise<OrderItem | undefined>;
  
  // Initialize with sample data
  initializeData(): Promise<void>;
}

// Import database instance and helpers
import { db } from "./db";
import { eq, asc, desc, and, or, like } from "drizzle-orm";

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

  async getMenuItemById(id: number): Promise<MenuItem | undefined> {
    const [menuItem] = await db
      .select()
      .from(menuItems)
      .where(eq(menuItems.id, id.toString()));
    return menuItem || undefined;
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
    const [newBay] = await db
      .insert(bays)
      .values(bay)
      .returning();
    return newBay;
  }

  async updateBayStatus(id: number, status: string): Promise<Bay | undefined> {
    const [updatedBay] = await db
      .update(bays)
      .set({ status })
      .where(eq(bays.id, id))
      .returning();
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
    const order = await this.getOrderById(id);
    if (!order) return undefined;

    const bay = await this.getBayById(order.bayId);
    if (!bay) return undefined;

    const orderItemsList = await this.getOrderItems(id);
    
    // Fetch menu items for each order item
    const items = await Promise.all(
      orderItemsList.map(async (item) => {
        const menuItem = await this.getMenuItemById(Number(item.menuItemId));
        return { ...item, menuItem: menuItem! };
      })
    );

    return {
      ...order,
      bay,
      items,
    };
  }

  async getOrdersByBayId(bayId: number): Promise<Order[]> {
    return db
      .select()
      .from(orders)
      .where(eq(orders.bayId, bayId))
      .orderBy(desc(orders.createdAt));
  }

  async getActiveOrders(): Promise<OrderSummary[]> {
    // Active orders are ones that are not SERVED or CANCELLED
    const activeOrders = await db
      .select()
      .from(orders)
      .where(
        and(
          or(
            eq(orders.status, "NEW"),
            eq(orders.status, "COOKING"),
            eq(orders.status, "READY")
          )
        )
      )
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
          orderNumber: order.orderNumber || undefined,
          bayId: order.bayId,
          bayNumber: bay?.number,
          floor: bay?.floor || 0,
          status: order.status,
          createdAt: order.createdAt,
          timeElapsed,
          totalItems: items.reduce((sum, item) => sum + item.qty, 0),
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
          orderNumber: order.orderNumber || undefined,
          bayId: order.bayId,
          bayNumber: bay?.number,
          floor: bay?.floor || 0,
          status: order.status,
          createdAt: order.createdAt,
          timeElapsed,
          totalItems: items.reduce((sum, item) => sum + item.qty, 0),
          isDelayed,
        };
      })
    );

    return summaries;
  }

  async createOrder(order: InsertOrder, cart: Cart): Promise<Order> {
    // First, create the order
    const [newOrder] = await db
      .insert(orders)
      .values(order)
      .returning();

    // Then create order items from the cart
    for (const item of cart.items) {
      await this.createOrderItem({
        orderId: newOrder.id,
        menuItemId: item.menuItemId,
        qty: item.quantity,
        notes: cart.specialInstructions,
      });
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
    return db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));
  }

  async createOrderItem(orderItem: InsertOrderItem): Promise<OrderItem> {
    const [newOrderItem] = await db
      .insert(orderItems)
      .values(orderItem)
      .returning();
    return newOrderItem;
  }

  async updateOrderItemStatus(id: string, completed: boolean): Promise<OrderItem | undefined> {
    const [updatedOrderItem] = await db
      .update(orderItems)
      .set({ completed })
      .where(eq(orderItems.id, id))
      .returning();
    
    return updatedOrderItem || undefined;
  }

  // Initialize with sample data
  async initializeData(): Promise<void> {
    // This method is for development/testing purposes
    // In a production app, you'd typically have migrations and seed scripts
    console.log("Database already initialized!");
  }
}

export const storage = new DatabaseStorage();