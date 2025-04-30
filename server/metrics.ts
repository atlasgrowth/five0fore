import { storage } from './storage';
import { log } from './vite';

/**
 * Kitchen metrics used for ETA calculations and load estimation
 */
export interface KitchenMetrics {
  // Current kitchen load factor (1.0 = normal, 2.0 = double, etc.)
  loadFactor: number;
  
  // Number of active orders
  activeOrders: number;
  
  // Number of items in each state
  itemCounts: {
    [station: string]: number;
  };
  
  // Average cook times in seconds for each station
  averageCookTimes: {
    [station: string]: number;
  };
  
  // Last time the metrics were updated
  lastUpdated: Date;
}

// Cached metrics to avoid database queries for each ETA calculation
let cachedMetrics: KitchenMetrics = {
  loadFactor: 1.0,
  activeOrders: 0,
  itemCounts: {},
  averageCookTimes: {},
  lastUpdated: new Date()
};

/**
 * Get the current kitchen metrics (from cache)
 * 
 * @returns Current kitchen metrics
 */
export function getKitchenMetrics(): KitchenMetrics {
  return cachedMetrics;
}

/**
 * Update kitchen metrics from the database
 * 
 * @returns Updated kitchen metrics
 */
export async function updateKitchenMetrics(): Promise<KitchenMetrics> {
  try {
    // Get number of active orders
    const activeOrders = await storage.countActiveOrders();
    
    // Get count of active items by station
    const itemCountsByStation = await storage.countActiveItemsByStation();
    
    // Calculate load factor
    // Base load is 1.0, with load increasing as active items increase
    // We'll assume the kitchen can handle 20 items comfortably
    const totalActiveItems = Object.values(itemCountsByStation).reduce((sum, count) => sum + count, 0);
    const comfortableItemCount = 20;
    const loadFactor = Math.max(1.0, Math.min(3.0, totalActiveItems / comfortableItemCount));
    
    // Update cached metrics
    cachedMetrics = {
      ...cachedMetrics,
      loadFactor,
      activeOrders,
      itemCounts: itemCountsByStation,
      lastUpdated: new Date()
    };
    
    log(`Kitchen metrics updated: loadFactor=${loadFactor.toFixed(2)}, activeOrders=${activeOrders}`);
    
    return cachedMetrics;
  } catch (error) {
    log(`Error updating kitchen metrics: ${error}`);
    return cachedMetrics;
  }
}

/**
 * Update average cook times from the database
 * 
 * This is a more expensive operation, so we do it less frequently
 * 
 * @returns Updated kitchen metrics
 */
export async function updateAverageCookTimes(): Promise<KitchenMetrics> {
  try {
    // Get average cook times for completed items in the last 24 hours
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    const averageCookTimes = await storage.getAverageCookTimeForCompletedItemsSince(since);
    
    // Update cached metrics
    cachedMetrics = {
      ...cachedMetrics,
      averageCookTimes,
    };
    
    log('Average cook times updated');
    
    return cachedMetrics;
  } catch (error) {
    log(`Error updating average cook times: ${error}`);
    return cachedMetrics;
  }
}