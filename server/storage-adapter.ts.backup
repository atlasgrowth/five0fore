import { IStorage } from './storage';
import { dbStorage } from './db-storage';
import {
  Bay, InsertBay,
  MenuItem, InsertMenuItem,
  Order, InsertOrder,
  OrderItem, InsertOrderItem,
  Cart
} from "@shared/schema";

// This adapter ensures compatibility between our new database implementation
// and the existing IStorage interface expected by our application code
export class StorageAdapter implements IStorage {
  private dbStorage = dbStorage;

  async getUser(id: number): Promise<any> {
    return await this.dbStorage.getUser(id);
  }

  async getUserByUsername(username: string): Promise<any> {
    return await this.dbStorage.getUserByUsername(username);
  }

  async createUser(user: any): Promise<any> {
    return await this.dbStorage.createUser(user);
  }

  async getCategories(): Promise<any[]> {
    return await this.dbStorage.getCategories();
  }

  async getCategoryById(id: number): Promise<any> {
    return await this.dbStorage.getCategoryById(id);
  }

  async createCategory(category: any): Promise<any> {
    return await this.dbStorage.createCategory(category);
  }

  async getMenuItems(): Promise<MenuItem[]> {
    return await this.dbStorage.getMenuItems();
  }

  async getMenuItemsByCategory(categoryId: number): Promise<MenuItem[]> {
    // Our database expects a string category, but our existing code uses ID
    // Get the category first, then query by name
    const category = await this.getCategoryById(categoryId);
    return category ? await this.dbStorage.getMenuItemsByCategory(category.name) : [];
  }

  async getMenuItemById(id: number): Promise<MenuItem | undefined> {
    // Convert number ID to string for the database
    return await this.dbStorage.getMenuItemById(String(id));
  }

  async createMenuItem(menuItem: InsertMenuItem): Promise<MenuItem> {
    return await this.dbStorage.createMenuItem(menuItem);
  }

  async getBays(): Promise<Bay[]> {
    return await this.dbStorage.getBays();
  }

  async getBaysByFloor(floor: number): Promise<Bay[]> {
    return await this.dbStorage.getBaysByFloor(floor);
  }

  async getBayByNumber(number: number): Promise<Bay | undefined> {
    return await this.dbStorage.getBayByNumber(number);
  }

  async getBayById(id: number): Promise<Bay | undefined> {
    return await this.dbStorage.getBayById(id);
  }

  async createBay(bay: InsertBay): Promise<Bay> {
    return await this.dbStorage.createBay(bay);
  }

  async updateBayStatus(id: number, status: string): Promise<Bay | undefined> {
    return await this.dbStorage.updateBayStatus(id, status);
  }

  async getOrders(): Promise<Order[]> {
    return await this.dbStorage.getOrders();
  }

  async getOrderById(id: number): Promise<Order | undefined> {
    // Convert number ID to string for the database
    return await this.dbStorage.getOrderById(String(id));
  }

  async getOrderWithItems(id: number): Promise<any> {
    // Convert number ID to string for the database
    return await this.dbStorage.getOrderWithItems(String(id));
  }

  async getOrdersByBayId(bayId: number): Promise<Order[]> {
    return await this.dbStorage.getOrdersByBayId(bayId);
  }

  async getActiveOrders(): Promise<any[]> {
    return await this.dbStorage.getActiveOrders();
  }

  async getOrdersByStatus(status: string): Promise<any[]> {
    return await this.dbStorage.getOrdersByStatus(status);
  }

  async createOrder(order: InsertOrder, cart: Cart): Promise<Order> {
    return await this.dbStorage.createOrder(order, cart);
  }

  async updateOrderStatus(id: number, status: string): Promise<Order | undefined> {
    // Convert number ID to string for the database
    return await this.dbStorage.updateOrderStatus(String(id), status);
  }

  async getOrderItems(orderId: number): Promise<OrderItem[]> {
    // Convert number ID to string for the database
    return await this.dbStorage.getOrderItems(String(orderId));
  }

  async createOrderItem(orderItem: InsertOrderItem): Promise<OrderItem> {
    return await this.dbStorage.createOrderItem(orderItem);
  }

  async updateOrderItemStatus(id: number, completed: boolean): Promise<OrderItem | undefined> {
    // Convert number ID to string for the database
    return await this.dbStorage.updateOrderItemStatus(String(id), completed);
  }

  async initializeData(): Promise<void> {
    return await this.dbStorage.initializeData();
  }
}

// Create and export an instance of the adapter
export const storage = new StorageAdapter();