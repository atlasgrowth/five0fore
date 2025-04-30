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

// Global interval handlers
let statusSyncTimerId: NodeJS.Timeout | null = null;

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
 * Start kitchen background timers 
 */
export function startKitchenTimers() {
  console.log('Starting kitchen timer background tasks...');
  
  // Bay status synchronization - run every 3 seconds
  if (statusSyncTimerId) {
    clearInterval(statusSyncTimerId);
  }
  statusSyncTimerId = setInterval(synchronizeBayStatus, 3000);
}

/**
 * Stop all background timers
 */
export function stopKitchenTimers() {
  if (statusSyncTimerId) {
    clearInterval(statusSyncTimerId);
    statusSyncTimerId = null;
  }
  console.log('Stopped all kitchen timer background tasks');
}