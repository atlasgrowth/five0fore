import { OrderWithItems, OrderItem, AttentionLevel } from "@shared/schema";
import { KitchenMetrics } from "./metrics";
import { DEFAULT_COOK_SECONDS, DEFAULT_PLATING_SECONDS, PREP_BUFFER_SECONDS, EXPO_BUFFER_SECONDS, applyLoadFactor, calculateAttentionLevel, calculatePriorityScore } from "./constants";

/**
 * Calculate ETA for an order based on its items and current kitchen metrics
 * 
 * @param order The order to calculate ETA for
 * @param metrics Current kitchen metrics
 * @returns The calculated ETA, attention level, and priority score
 */
export function computeOrderETA(order: OrderWithItems, metrics: KitchenMetrics) {
  // If the order is already closed or served, return the actual completion time
  if (order.status === 'CLOSED' || order.status === 'SERVED') {
    return {
      estimatedCompletionTime: order.closedAt || new Date(),
      attentionLevel: AttentionLevel.NORMAL,
      priority: 0
    };
  }
  
  // Current time
  const now = new Date();
  
  // Calculate ETA based on remaining cooking steps
  const { estimatedCompletionTime, longestCookTime } = calculateOrderReadyTime(order, metrics, now);
  
  // Calculate attention level
  const attentionLevel = calculateAttentionLevel(estimatedCompletionTime);
  
  // Calculate priority score (higher = more important)
  const priority = calculatePriorityScore(
    order.createdAt,
    estimatedCompletionTime,
    order.items.length,
    longestCookTime
  );
  
  return {
    estimatedCompletionTime,
    attentionLevel,
    priority
  };
}

/**
 * Calculate the estimated time when an order will be ready
 * 
 * @param order The order with its items
 * @param metrics Current kitchen metrics
 * @param now Current time
 * @returns Estimated completion time and the longest cook time
 */
function calculateOrderReadyTime(
  order: OrderWithItems,
  metrics: KitchenMetrics,
  now: Date = new Date()
): { estimatedCompletionTime: Date, longestCookTime: number } {
  // Default if we can't calculate
  const defaultEta = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes from now
  
  // If no items, return default
  if (!order.items || order.items.length === 0) {
    return { 
      estimatedCompletionTime: defaultEta,
      longestCookTime: 0
    };
  }
  
  // Copy items to avoid modifying the original
  const items = [...order.items];
  
  // Calculate total preparation time based on item statuses
  const { totalTime, longestCookTime } = calculateTotalOrderTime(items, metrics);
  
  // Calculate ready time based on current time and remaining steps
  const readyTime = calculateCompletionTime(order, items, totalTime, now);
  
  return {
    estimatedCompletionTime: readyTime,
    longestCookTime
  };
}

/**
 * Calculate the total time needed to prepare an order
 * 
 * @param items The order items
 * @param metrics Current kitchen metrics
 * @returns Total time in milliseconds and the longest cook time
 */
function calculateTotalOrderTime(
  items: OrderItem[],
  metrics: KitchenMetrics
): { totalTime: number, longestCookTime: number } {
  let totalTime = 0;
  let longestCookTime = 0;
  
  // Track time for each work center (to account for parallelism)
  const stationTimes: { [station: string]: number } = {};
  
  // Process each item
  for (const item of items) {
    // Skip items that are already complete or void
    if (item.status === 'READY' || item.status === 'DELIVERED' || item.status === 'VOIDED') {
      continue;
    }
    
    // Get cooking seconds, defaulting if not available
    const station = item.station || 'default';
    const quantity = item.quantity || 1;
    
    // Use stored cook time or default
    let cookSeconds = item.cookSeconds || 
                     metrics.averageCookTimes[station] || 
                     DEFAULT_COOK_SECONDS;
    
    // Apply load factor based on kitchen busyness
    cookSeconds = applyLoadFactor(cookSeconds, metrics.loadFactor);
    
    // Multiply by quantity for bulk items
    const totalCookTime = cookSeconds * Math.sqrt(quantity); // Square root to account for batch efficiency
    
    // Keep track of longest individual cook time
    longestCookTime = Math.max(longestCookTime, totalCookTime);
    
    // Add preparation time to station
    stationTimes[station] = (stationTimes[station] || 0) + totalCookTime;
  }
  
  // The total prep time is the longest station time
  // This accounts for parallelism across stations
  totalTime = Math.max(0, ...Object.values(stationTimes));
  
  // Convert seconds to milliseconds
  return { 
    totalTime: totalTime * 1000,
    longestCookTime
  };
}

/**
 * Calculate the expected completion time for an order
 * 
 * @param order The order
 * @param items The order items
 * @param totalTime Total preparation time in milliseconds
 * @param now Current time
 * @returns Expected completion time
 */
function calculateCompletionTime(
  order: OrderWithItems,
  items: OrderItem[],
  totalTime: number,
  now: Date
): Date {
  // If the order is already being prepared, adjust based on current status
  const newItems = items.filter(i => i.status === 'NEW' || !i.status);
  const cookingItems = items.filter(i => i.status === 'COOKING');
  const platingItems = items.filter(i => i.status === 'PLATING');
  
  // If there are items being plated, we're close to ready
  if (platingItems.length > 0) {
    // Add plating time plus expo buffer
    const remainingMs = DEFAULT_PLATING_SECONDS * 1000 + EXPO_BUFFER_SECONDS * 1000;
    return new Date(now.getTime() + remainingMs);
  }
  
  // If cooking has started but no plating yet
  if (cookingItems.length > 0 && newItems.length === 0) {
    // Use the earliest cooking start time to estimate remaining time
    const cookingStartTimes = cookingItems
      .map(i => i.startedAt)
      .filter((t): t is Date => t !== null)
      .sort((a, b) => a.getTime() - b.getTime());
    
    if (cookingStartTimes.length > 0) {
      const earliestStart = cookingStartTimes[0];
      const elapsedMs = now.getTime() - earliestStart.getTime();
      const remainingMs = Math.max(0, totalTime - elapsedMs) + 
                        DEFAULT_PLATING_SECONDS * 1000 + 
                        EXPO_BUFFER_SECONDS * 1000;
      
      return new Date(now.getTime() + remainingMs);
    }
  }
  
  // If we have new items not yet cooking
  if (newItems.length > 0) {
    // Add prep buffer time to total time
    const totalTimePlusBuffer = totalTime + 
                              PREP_BUFFER_SECONDS * 1000 + 
                              DEFAULT_PLATING_SECONDS * 1000 + 
                              EXPO_BUFFER_SECONDS * 1000;
    
    return new Date(now.getTime() + totalTimePlusBuffer);
  }
  
  // Fallback: use the stored estimatedCompletionTime or default to 10 minutes
  if (order.estimatedCompletionTime) {
    return new Date(order.estimatedCompletionTime);
  }
  
  // Default to 10 minutes if we can't calculate
  return new Date(now.getTime() + 10 * 60 * 1000);
}