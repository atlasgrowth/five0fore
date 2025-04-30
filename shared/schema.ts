import { pgTable, text, serial, integer, boolean, timestamp, uuid, smallint, real, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// AttentionLevel enum is defined below in the file
// This enum is used for order prioritization

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("customer"), // admin, server, kitchen, customer
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  role: true,
});

// Categories table
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
});

export const insertCategorySchema = createInsertSchema(categories).pick({
  name: true,
  slug: true,
});

// Customization options table 
export const customizationCategories = pgTable("customization_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // single_select, multi_select
  required: boolean("required").default(false),
});

export const insertCustomizationCategorySchema = createInsertSchema(customizationCategories).pick({
  name: true,
  type: true,
  required: true,
});

// Customization options table
export const customizationOptions = pgTable("customization_options", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").notNull().references(() => customizationCategories.id),
  name: text("name").notNull(),
  price_cents: integer("price_cents").default(0), // Additional price in cents
});

export const insertCustomizationOptionSchema = createInsertSchema(customizationOptions).pick({
  categoryId: true,
  name: true,
  price_cents: true,
});

// Menu items table
export const menuItems = pgTable("menu_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  category: text("category").notNull(),  // Shareables, Smashburgers, etc.
  price_cents: integer("price_cents").notNull(), // Price in cents
  station: text("station").notNull(),   // Fry, Cold, FlatTop, etc.
  prep_seconds: integer("prep_seconds").notNull(), // Prep time in seconds
  description: text("description"), // Optional description
  image_url: text("image_url"), // Optional image URL
  active: boolean("active").notNull().default(true),
  customizable: boolean("customizable").default(false), // Whether this item can be customized
});

export const insertMenuItemSchema = createInsertSchema(menuItems).pick({
  name: true, 
  category: true,
  price_cents: true,
  station: true,
  prep_seconds: true,
  description: true,
  image_url: true,
  active: true,
  customizable: true,
});

// Define seating location types
export enum SeatingType {
  BAY = "BAY",           // Golf bays (driving range positions)
  BAR_LEFT = "BAR_LEFT", // Left side of the bar
  BAR_RIGHT = "BAR_RIGHT", // Right side of the bar
  TABLE = "TABLE"        // Regular tables
}

// Bays/Seating Locations table
export const bays = pgTable("bays", {
  id: smallint("id").primaryKey(), // Unique ID for the seating location
  number: smallint("number").notNull(), // Bay/table/seat number (e.g., 101, 102, etc.)
  floor: smallint("floor").notNull(), // Floor number (1-2)
  status: text("status").notNull().default("empty"), // empty, occupied, active, flagged
  type: text("type").$type<SeatingType>().notNull().default(SeatingType.BAY), // Type of seating location
  displayName: text("display_name"), // Optional custom display name (e.g., "Bar L1" for Bar Left seat 1)
});

export const insertBaySchema = createInsertSchema(bays).pick({
  id: true,
  number: true,
  floor: true,
  status: true,
  type: true,
  displayName: true,
});

// Orders table
export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  bayId: smallint("bay_id").notNull().references(() => bays.id),
  status: text("status").notNull().default("NEW"), // Use OrderStatus.NEW as default
  createdAt: timestamp("created_at").notNull().defaultNow(),
  // Removed specialInstructions field - special instructions should only be at the item level
  orderType: text("order_type").notNull().default("customer"), // customer, server
  estimatedCompletionTime: timestamp("estimated_completion_time"), // New field for P2
  closedAt: timestamp("closed_at"), // When the order was marked as closed
});

export const insertOrderSchema = createInsertSchema(orders).pick({
  bayId: true,
  status: true,
  orderType: true,
  estimatedCompletionTime: true,
}).transform(data => ({
  ...data,
  // Use NEW as default if status is not specified
  status: data.status || OrderStatus.NEW
}));

// Order item status enum
export enum OrderItemStatus {
  NEW = "NEW",
  COOKING = "COOKING",
  PLATING = "PLATING",
  READY = "READY",
  DELIVERED = "DELIVERED",
  VOIDED = "VOIDED"
}

// Order status enum
export enum OrderStatus {
  NEW = "NEW",         // Order placed but not started
  COOKING = "COOKING", // Kitchen is preparing the order
  PLATING = "PLATING", // Kitchen is plating/finishing the order
  READY = "READY",     // Order is ready for pickup/delivery
  SERVED = "SERVED",   // Food delivered to the customer
  CLOSED = "CLOSED",   // Order has been paid and is complete
  CANCELLED = "CANCELLED" // Order was cancelled
}

// Order items table
export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id),
  menuItemId: uuid("menu_item_id").notNull().references(() => menuItems.id),
  quantity: integer("qty").notNull(), // Changed column name to match database
  station: text("station"), // The station responsible for preparing the item
  status: text("status").$type<OrderItemStatus>().default(OrderItemStatus.NEW), // Current status of the item
  cookSeconds: integer("cook_seconds").default(300), // Time in seconds it should take to cook
  price_cents: integer("price_cents").default(0), // Price in cents
  
  // Timing fields
  firedAt: timestamp("fired_at", { withTimezone: true }), // Legacy - when cooking started
  readyAt: timestamp("ready_at", { withTimezone: true }), // Expected time when item should be ready
  readyBy: timestamp("ready_by", { withTimezone: true }), // Legacy field - use readyAt instead
  deliveredAt: timestamp("delivered_at", { withTimezone: true }), // Legacy - when delivered to customer
  
  // Enhanced timing fields
  expectedTotalTime: integer("expected_total_time"), // Total expected time in seconds from order to ready
  startedAt: timestamp("started_at", { withTimezone: true }), // When cooking actually started (human action)
  platingAt: timestamp("plating_at", { withTimezone: true }), // When moved to plating
  actualReadyAt: timestamp("actual_ready_at", { withTimezone: true }), // When actually marked ready
  servedAt: timestamp("served_at", { withTimezone: true }), // When delivered to customer
  
  completed: boolean("completed").notNull().default(false), // Legacy field - true if delivered/completed
  notes: text("notes"), // Special preparation instructions
  customizations: jsonb("customizations").$type<CustomizationSelection[]>(), // Stored customization selections
});

export const insertOrderItemSchema = createInsertSchema(orderItems).pick({
  orderId: true,
  menuItemId: true,
  quantity: true,
  notes: true,
  station: true,
  customizations: true,
});

// Menu item customizations junction table
export const menuItemCustomizations = pgTable("menu_item_customizations", {
  id: serial("id").primaryKey(),
  menuItemId: uuid("menu_item_id").notNull().references(() => menuItems.id),
  customizationCategoryId: integer("customization_category_id").notNull().references(() => customizationCategories.id),
});

export const insertMenuItemCustomizationSchema = createInsertSchema(menuItemCustomizations).pick({
  menuItemId: true,
  customizationCategoryId: true,
});

// Define relations
export const menuItemsRelations = relations(menuItems, ({ many }) => ({
  orderItems: many(orderItems),
  customizations: many(menuItemCustomizations),
}));

export const customizationCategoriesRelations = relations(customizationCategories, ({ many, one }) => ({
  options: many(customizationOptions),
  menuItems: many(menuItemCustomizations),
}));

export const customizationOptionsRelations = relations(customizationOptions, ({ one }) => ({
  category: one(customizationCategories, { 
    fields: [customizationOptions.categoryId], 
    references: [customizationCategories.id] 
  }),
}));

export const menuItemCustomizationsRelations = relations(menuItemCustomizations, ({ one }) => ({
  menuItem: one(menuItems, { 
    fields: [menuItemCustomizations.menuItemId], 
    references: [menuItems.id] 
  }),
  customizationCategory: one(customizationCategories, { 
    fields: [menuItemCustomizations.customizationCategoryId], 
    references: [customizationCategories.id] 
  }),
}));

export const baysRelations = relations(bays, ({ many }) => ({
  orders: many(orders),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  bay: one(bays, { fields: [orders.bayId], references: [bays.id] }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  menuItem: one(menuItems, { fields: [orderItems.menuItemId], references: [menuItems.id] }),
}));

// Kitchen settings table for load factor and configuration
export const kitchenSettings = pgTable("kitchen_settings", {
  id: serial("id").primaryKey(),
  loadFactor: real("load_factor").notNull().default(1.0),
  
  // Attention level thresholds (% of estimated time)
  attentionThreshold: real("attention_threshold").notNull().default(0.80), // 80% of expected time
  priorityThreshold: real("priority_threshold").notNull().default(1.0),   // 100% of expected time (exactly due)
  criticalThreshold: real("critical_threshold").notNull().default(1.25),  // 125% of expected time
  
  // Priority calculation weights (for scoring algorithm)
  waitRatioWeight: real("wait_ratio_weight").notNull().default(2.0),     // Weight for time waited / expected ratio
  orderAgeWeight: real("order_age_weight").notNull().default(1.0),       // Weight for order age in minutes
  cookComplexityWeight: real("cook_complexity_weight").notNull().default(0.5), // Weight for cooking complexity
  
  // Load factor damping (to prevent wild swings)
  loadFactorDamping: real("load_factor_damping").notNull().default(0.5), // Damping coefficient
  
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text("updated_by"), // User who made the change
});

// Order item customizations table
export const orderItemCustomizations = pgTable("order_item_customizations", {
  id: serial("id").primaryKey(),
  orderItemId: uuid("order_item_id").notNull().references(() => orderItems.id),
  customizationOptionId: integer("customization_option_id").notNull().references(() => customizationOptions.id),
});

export const insertOrderItemCustomizationSchema = createInsertSchema(orderItemCustomizations).pick({
  orderItemId: true,
  customizationOptionId: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Category = typeof categories.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;

export type CustomizationCategory = typeof customizationCategories.$inferSelect;
export type InsertCustomizationCategory = z.infer<typeof insertCustomizationCategorySchema>;

export type CustomizationOption = typeof customizationOptions.$inferSelect;
export type InsertCustomizationOption = z.infer<typeof insertCustomizationOptionSchema>;

export type MenuItemCustomization = typeof menuItemCustomizations.$inferSelect;
export type InsertMenuItemCustomization = z.infer<typeof insertMenuItemCustomizationSchema>;

export type OrderItemCustomization = typeof orderItemCustomizations.$inferSelect;
export type InsertOrderItemCustomization = z.infer<typeof insertOrderItemCustomizationSchema>;

export type MenuItem = typeof menuItems.$inferSelect;
export type InsertMenuItem = z.infer<typeof insertMenuItemSchema>;

export type Bay = typeof bays.$inferSelect;
export type InsertBay = z.infer<typeof insertBaySchema>;

export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;

export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;

export type KitchenSetting = typeof kitchenSettings.$inferSelect;

// Composite types for requests/responses
export type OrderWithItems = Order & { 
  items: (OrderItem & { 
    menuItem: MenuItem,
    customizations?: CustomizationSelection[] | null
  })[], 
  bay: Bay,
  estimatedCompletionTime?: string | Date | null
};

// Define attention levels for orders
export enum AttentionLevel {
  NORMAL = "normal",
  ATTENTION = "attention", // approaching expected time
  PRIORITY = "priority",   // exceeded time by small margin
  CRITICAL = "critical"    // severely delayed
}

export type OrderSummary = {
  id: string;
  bayId: number;
  bayNumber?: number;
  orderNumber?: string | number; // Display number for kitchen (usually derived from ID)
  floor: number;
  status: string;
  createdAt: Date;
  timeElapsed: number; // minutes since creation
  totalItems: number;
  isDelayed: boolean; // Keeping for backward compatibility
  attentionLevel: AttentionLevel; // New field - indicates urgency level
  priority?: number; // Numerical priority score
  estimatedCompletionTime?: string | Date | null;
  seatingType?: SeatingType; // Type of seating (BAY, BAR_LEFT, BAR_RIGHT, TABLE)
  displayName?: string; // Custom display name (e.g., "Bar L1")
};

export type CustomizationSelection = {
  categoryId: number;
  categoryName: string;
  options: {
    id: number;
    name: string;
    priceCents: number;
  }[];
};

export type CartItem = {
  menuItemId: string;
  name?: string;
  priceCents?: number;
  quantity: number;
  station?: string;
  notes?: string;
  customizations?: CustomizationSelection[];
};

export type Cart = {
  items: CartItem[];
  // Removed specialInstructions - special instructions should be at the item level only
};