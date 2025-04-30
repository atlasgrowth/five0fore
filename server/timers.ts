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
    // Temporarily disable bay status synchronization to improve performance
    // This job is causing too many database queries and slowing down the system
    return;
  } catch (error) {
    console.error('Error in synchronizeBayStatus job:', error);
  }
}

/**
 * Periodically recalculate estimated completion times for all active orders
 * This is a lightweight version that only processes orders that are in COOKING or PLATING status
 * to reduce database load
 */
async function recalculateAllOrderTimes() {
  try {
    console.log('Running recalculate times job...');
    
    // Only get orders in COOKING or PLATING status
    // These are the ones that need time updates most critically
    const cookingOrders = await db.select()
      .from(orders)
      .where(
        inArray(orders.status, ['COOKING', 'PLATING'])
      )
      .limit(10); // Add a limit to prevent processing too many at once
    
    if (cookingOrders.length === 0) {
      console.log('No cooking/plating orders to update times for.');
      return;
    }
    
    console.log(`Found ${cookingOrders.length} cooking/plating orders to update times for.`);
    
    // Update each order's estimated completion time
    const updatedOrderIds = [];
    
    for (const order of cookingOrders) {
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
  
  // Re-enable automatic order time recalculation with a longer interval
  // to reduce performance impact (every 30 seconds instead of more frequently)
  if (timeRecalcTimerId) {
    clearInterval(timeRecalcTimerId);
  }
  timeRecalcTimerId = setInterval(recalculateAllOrderTimes, 30000); // 30 seconds
  console.log('Automatic order time recalculation enabled (30s interval)');
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
      item.status === OrderItemStatus.DELIVERED
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
    
    // Always use current time as the base for calculation - simpler approach
    let estimatedCompletionTime = new Date();
    
    if (progressFactor < 1.0) {
      // Apply a simple load factor to the cooking time
      const adjustedCookTime = applyLoadFactor(longestRemainingCookTime, loadFactor);
      
      // Always add the expo buffer for delivery/plating time
      const expoBuffer = applyLoadFactor(EXPO_BUFFER_SECONDS, loadFactor);
      
      // Total remaining seconds is simply: remaining cook time + expo buffer
      const totalRemainingSeconds = adjustedCookTime + expoBuffer;
      
      // Add the calculated remaining time to the current time
      estimatedCompletionTime.setSeconds(estimatedCompletionTime.getSeconds() + totalRemainingSeconds);
      
      console.log(`Order ${orderId} - Estimated completion in ${totalRemainingSeconds} seconds`);
      console.log(`Progress: ${progressFactor * 100}%, Items cooked: ${completedItems}/${totalItems}`);
      console.log(`Load factor: ${loadFactor}, Cook time: ${adjustedCookTime}s, Expo: ${expoBuffer}s`);
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