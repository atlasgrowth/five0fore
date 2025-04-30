/**
 * Background jobs for kitchen timing functions 
 * and bay status synchronization
 */
import { db } from './db';
import { orders, orderItems, bays } from '@shared/schema';
import { eq, and, inArray, notInArray, sql } from 'drizzle-orm';
import { broadcastUpdate } from './ws';
import { storage } from './storage';
import { toBayDTO, toOrderDTO } from './dto';
import { OrderItemStatus, OrderStatus } from '@shared/types';
import { 
  calculateTotalOrderTime, 
  calculateOrderReadyTime,
  applyLoadFactor,
  PREP_BUFFER_SECONDS, 
  EXPO_BUFFER_SECONDS, 
  DEFAULT_COOK_SECONDS 
} from './constants';

// Global interval handlers
let statusSyncTimerId: NodeJS.Timeout | null = null;
let timeRecalcTimerId: NodeJS.Timeout | null = null;

/**
 * Check bay status for all bays that have active orders and update accordingly
 * This is a blunt-force approach to ensure bays always show the correct status 
 */
async function synchronizeBayStatus() {
  try {
    console.log('Running synchronizeBayStatus job...');
    
    // 1. Get all bays with active orders 
    const baysWithOrders = await db.select({ bayId: orders.bayId })
      .from(orders)
      .where(notInArray(orders.status, ['CLOSED', 'CANCELLED']))
      .groupBy(orders.bayId);
    
    if (baysWithOrders.length === 0) {
      console.log('No bays with active orders found.');
      return;
    }
    
    console.log(`Found ${baysWithOrders.length} bays with active orders:`, baysWithOrders.map(b => b.bayId));
    
    // 2. For each bay, determine the proper status
    for (const { bayId } of baysWithOrders) {
      // Find all active order items for this bay 
      const items = await db.select({ status: orderItems.status })
        .from(orderItems)
        .leftJoin(orders, eq(orders.id, orderItems.orderId))
        .where(and(
          eq(orders.bayId, bayId),
          notInArray(orders.status, ['CLOSED', 'CANCELLED'])
        ));
      
      console.log(`Bay ${bayId} has ${items.length} active items with statuses:`, items.map(i => i.status));
      
      // Determine bay status from order items - use lowercase consistently
      const statuses = items.map(i => i.status?.toLowerCase());
      let bayStatus = 'empty'; // Default - should be 'active' if we have any items
      
      if (statuses.length > 0) {
        // Default to active if we have any items that aren't served
        bayStatus = 'active'; 
        
        // Override with more specific status if we meet specific conditions
        if (statuses.some(s => s === 'cooking')) {
          bayStatus = 'cooking';
        } else if (statuses.some(s => s === 'plating')) {
          bayStatus = 'plating';
        } else if (statuses.length > 0 && statuses.every(s => s === 'ready')) {
          bayStatus = 'ready';
        } else if (statuses.length > 0 && statuses.every(s => s === 'served')) {
          bayStatus = 'served';
        }
      }
      
      // 3. Update bay status
      console.log(`Setting bay ${bayId} status to: ${bayStatus}`);
      
      const updatedBay = await db.update(bays)
        .set({ status: bayStatus })
        .where(eq(bays.id, bayId))
        .returning();
      
      if (updatedBay.length > 0) {
        console.log(`Successfully updated bay ${bayId} status to ${bayStatus}`);
        
        // Get active orders for this bay
        const bayOrders = await storage.getOrdersByBayId(bayId);
        
        // 4. Broadcast bay update
        broadcastUpdate('bay_updated', {
          bay: toBayDTO(updatedBay[0]),
          orders: bayOrders.map(toOrderDTO),
          status: bayStatus
        });
      }
    }
  } catch (error) {
    console.error('Error in synchronizeBayStatus job:', error);
  }
}

/**
 * Periodically recalculate estimated completion times for all active orders
 */
async function recalculateAllOrderTimes() {
  try {
    console.log('Running recalculate times job...');
    
    // Get all active orders
    const activeOrders = await storage.getActiveOrders();
    
    if (activeOrders.length === 0) {
      console.log('No active orders to update times for.');
      return;
    }
    
    console.log(`Found ${activeOrders.length} active orders to update times for.`);
    
    // Update each order's estimated completion time
    const updatedOrderIds = [];
    
    for (const order of activeOrders) {
      try {
        const updatedOrder = await updateOrderEstimatedCompletionTime(order.id);
        if (updatedOrder) {
          updatedOrderIds.push(order.id);
        }
      } catch (err) {
        console.error(`Error updating order ${order.id} time: `, err);
      }
    }
    
    console.log(`Successfully updated ${updatedOrderIds.length} order times.`);
  } catch (error) {
    console.error('Error in recalculateAllOrderTimes job:', error);
  }
}

/**
 * Start kitchen background timers 
 */
export function startKitchenTimers() {
  console.log('Starting kitchen timer background tasks...');
  
  // Bay status synchronization - run every 3 seconds
  if (statusSyncTimerId) {
    clearInterval(statusSyncTimerId);
  }
  statusSyncTimerId = setInterval(synchronizeBayStatus, 3000);
  
  // Order time recalculation - run every 10 seconds
  if (timeRecalcTimerId) {
    clearInterval(timeRecalcTimerId);
  }
  timeRecalcTimerId = setInterval(recalculateAllOrderTimes, 10000);
  
  // Run an immediate recalculation of all order times on startup
  recalculateAllOrderTimes();
}

/**
 * Stop all background timers
 */
export function stopKitchenTimers() {
  if (statusSyncTimerId) {
    clearInterval(statusSyncTimerId);
    statusSyncTimerId = null;
  }
  
  if (timeRecalcTimerId) {
    clearInterval(timeRecalcTimerId);
    timeRecalcTimerId = null;
  }
  
  console.log('Stopped all kitchen timer background tasks');
}

/**
 * Dynamically updates the estimated completion time for an order based on:
 * 1. Current progress (completed items vs total items)
 * 2. Kitchen load factor
 * 3. Remaining longest cook time for items still cooking
 * 
 * @param orderId The order ID to update
 * @returns The updated order with new estimated completion time, or undefined if error
 */
export async function updateOrderEstimatedCompletionTime(orderId: string) {
  try {
    console.log(`Updating estimated completion time for order ${orderId}`);
    
    // Get the order and all its items
    const orderWithItems = await storage.getOrderWithItems(orderId);
    if (!orderWithItems || !orderWithItems.items || orderWithItems.items.length === 0) {
      console.warn(`Cannot update estimated time: Order ${orderId} not found or has no items`);
      return undefined;
    }
    
    // Extract the order and items from the result
    const items = orderWithItems.items;
    const order = orderWithItems;
    
    // Calculate current kitchen load based on number of active orders
    // This is a simple approach - in a real system, you might have a more complex calculation
    const activeOrders = await storage.getOrdersByStatus('COOKING');
    const activeOrdersCount = activeOrders.length;
    
    // Calculate load factor: 1.0 is normal, >1.0 is busy, <1.0 is light
    // Max load factor of 2.0 (twice as long when very busy)
    const loadFactor = Math.min(2.0, Math.max(0.8, 0.8 + (activeOrdersCount * 0.1)));
    
    // Calculate progress factor based on completed items
    const totalItems = items.length;
    const completedItems = items.filter(item => 
      item.status === OrderItemStatus.READY || 
      item.status === OrderItemStatus.DELIVERED || 
      item.status === OrderItemStatus.SERVED // Using enum now that we've defined it
    ).length;
    
    // Progress from 0.0 (no items done) to 1.0 (all items done)
    const progressFactor = totalItems > 0 ? completedItems / totalItems : 0;
    
    // Find the longest remaining cook time for items still cooking
    let longestRemainingCookTime = 0;
    
    items.forEach(item => {
      if (item.status === OrderItemStatus.COOKING && item.firedAt) {
        const cookTime = item.cookSeconds || item.menuItem?.prep_seconds || DEFAULT_COOK_SECONDS;
        const elapsedSeconds = Math.floor((new Date().getTime() - new Date(item.firedAt).getTime()) / 1000);
        const remainingSeconds = Math.max(0, cookTime - elapsedSeconds);
        
        if (remainingSeconds > longestRemainingCookTime) {
          longestRemainingCookTime = remainingSeconds;
        }
      } else if (item.status === OrderItemStatus.NEW) {
        // For new items, consider their full cook time
        const cookTime = item.cookSeconds || item.menuItem?.prep_seconds || DEFAULT_COOK_SECONDS;
        if (cookTime > longestRemainingCookTime) {
          longestRemainingCookTime = cookTime;
        }
      }
    });
    
    // Always use current time as the base for calculation, not the original creation time
    // This ensures that for orders already in progress, we're projecting from now
    let estimatedCompletionTime = new Date();
    
    if (progressFactor < 1.0) {
      // Apply damping to load factor (50% damping by default)
      // Formula: Load factor × (1 - progress)
      const adjustedLoadFactor = loadFactor * (1 - (progressFactor * 0.5));
      
      // Calculate prep buffer + remaining longest cook time + expo buffer
      const remainingPrepBuffer = progressFactor < 0.3 ? 
        applyLoadFactor(PREP_BUFFER_SECONDS * (1 - progressFactor/0.3), adjustedLoadFactor) : 0;
      
      const adjustedCookTime = applyLoadFactor(longestRemainingCookTime, adjustedLoadFactor);
      
      const remainingExpoBuffer = progressFactor < 0.8 ?
        applyLoadFactor(EXPO_BUFFER_SECONDS * (1 - (progressFactor - 0.3)/0.5), adjustedLoadFactor) : 0;
      
      // Total remaining seconds
      const totalRemainingSeconds = remainingPrepBuffer + adjustedCookTime + remainingExpoBuffer;
      
      // Add the calculated remaining time to the current time
      estimatedCompletionTime.setSeconds(estimatedCompletionTime.getSeconds() + totalRemainingSeconds);
      
      console.log(`Order ${orderId} - Estimated completion in ${totalRemainingSeconds} seconds`);
      console.log(`Progress: ${progressFactor * 100}%, Load factor: ${loadFactor}, Adjusted load: ${adjustedLoadFactor}`);
      console.log(`Remaining prep: ${remainingPrepBuffer}s, Cook time: ${adjustedCookTime}s, Expo: ${remainingExpoBuffer}s`);
    }
    
    // Update the order in the database
    const [updatedOrder] = await db.update(orders)
      .set({ estimatedCompletionTime })
      .where(eq(orders.id, orderId))
      .returning();
    
    if (updatedOrder) {
      // Broadcast the update to clients
      broadcastUpdate('order_updated', {
        order: toOrderDTO(updatedOrder),
        bayId: updatedOrder.bayId,
        status: updatedOrder.status
      });
      
      return updatedOrder;
    }
    
    return undefined;
  } catch (error) {
    console.error(`Error updating estimated completion time for order ${orderId}:`, error);
    return undefined;
  }
}