import { AttentionLevel } from "@shared/schema";

// Default timing values
export const DEFAULT_COOK_SECONDS = 300; // 5 minutes default cook time
export const DEFAULT_PLATING_SECONDS = 120; // 2 minutes default plating time
export const PREP_BUFFER_SECONDS = 60; // 1 minute from order to firing
export const EXPO_BUFFER_SECONDS = 60; // 1 minute from ready to delivery

// Thresholds for attention levels in seconds (converted to percentages at runtime)
export const ATTENTION_THRESHOLD = 0.8; // 80% of expected time
export const PRIORITY_THRESHOLD = 1.0; // 100% of expected time (right on time)
export const CRITICAL_THRESHOLD = 1.25; // 125% of expected time (25% overdue)

// ETA calculation helpers
/**
 * Apply a load factor to cook time
 * 
 * @param baseSeconds Base cook time in seconds
 * @param loadFactor Current kitchen load factor (1.0 = normal)
 * @param impact How much the load factor impacts this calculation (0-1)
 * @returns Adjusted cook time in seconds
 */
export function applyLoadFactor(
  baseSeconds: number, 
  loadFactor: number,
  impact: number = 0.5
): number {
  // Ensure we have some base time
  if (baseSeconds <= 0) baseSeconds = DEFAULT_COOK_SECONDS;
  
  // Normalize impact to 0-1 range
  impact = Math.max(0, Math.min(1, impact));
  
  // Calculate adjustment factor: load factor * impact
  // For example: 1.5 load with 0.5 impact = 1.25 multiplier
  // This means a 50% loaded kitchen with 50% impact adds 25% to cook time
  const adjustment = 1 + ((loadFactor - 1) * impact);
  
  // Apply adjustment and round to whole seconds
  return Math.round(baseSeconds * adjustment);
}

/**
 * Calculate attention level based on thresholds and ETA
 * 
 * @param estimatedCompletionTime The order's ETA
 * @param attentionThreshold Threshold for ATTENTION level (percentage of expected time)
 * @param priorityThreshold Threshold for PRIORITY level (percentage of expected time)
 * @param criticalThreshold Threshold for CRITICAL level (percentage of expected time) 
 * @returns The attention level (NORMAL, ATTENTION, PRIORITY, CRITICAL)
 */
export function calculateAttentionLevel(
  estimatedCompletionTime: Date | null,
  attentionThreshold: number = ATTENTION_THRESHOLD,
  priorityThreshold: number = PRIORITY_THRESHOLD,
  criticalThreshold: number = CRITICAL_THRESHOLD
): AttentionLevel {
  // If no ETA, assume normal
  if (!estimatedCompletionTime) return AttentionLevel.NORMAL;
  
  const now = new Date();
  const etaTimestamp = new Date(estimatedCompletionTime).getTime();
  
  // Already past ETA? Calculate how far past
  if (now > estimatedCompletionTime) {
    // Get the estimated total time (from creation to completion)
    const expectedMinutes = 10; // Default to 10 minutes if we can't calculate
    
    // How far past the ETA we are, as a ratio of the total expected time
    const minutesPastEta = (now.getTime() - etaTimestamp) / 60000;
    const overdueFactor = minutesPastEta / expectedMinutes;
    
    // Assign attention level based on how overdue
    if (overdueFactor > criticalThreshold - 1) {
      return AttentionLevel.CRITICAL;
    } else if (overdueFactor > priorityThreshold - 1) {
      return AttentionLevel.PRIORITY;
    } else {
      return AttentionLevel.ATTENTION;
    }
  }
  
  // How close we are to the ETA as a ratio
  // 1.0 = at ETA, 0 = just started
  // This ratio DECREASES as we get closer to ETA
  const msUntilEta = etaTimestamp - now.getTime();
  const minutesUntilEta = msUntilEta / 60000;
  
  // Estimate the total expected time (10 minute default)
  const expectedMinutes = 10; 
  const remainingRatio = minutesUntilEta / expectedMinutes;
  
  // Assign attention level based on how close to ETA
  if (remainingRatio < 1 - criticalThreshold) {
    return AttentionLevel.CRITICAL;
  } else if (remainingRatio < 1 - priorityThreshold) {
    return AttentionLevel.PRIORITY;
  } else if (remainingRatio < 1 - attentionThreshold) {
    return AttentionLevel.ATTENTION;
  } else {
    return AttentionLevel.NORMAL;
  }
}

/**
 * Calculate a priority score for an order
 * 
 * Higher score = higher priority
 * This is used to sort orders on the kitchen dashboard
 * 
 * @param createdAt When the order was created
 * @param estimatedCompletionTime Expected completion time
 * @param itemCount Number of items in the order
 * @param longestCookTime Longest cook time among items
 * @param waitRatioWeight Weight for the wait ratio (how close to ETA)
 * @param orderAgeWeight Weight for the order age (how long since created)
 * @param cookComplexityWeight Weight for the cooking complexity
 */
export function calculatePriorityScore(
  createdAt: Date,
  estimatedCompletionTime: Date | null,
  itemCount: number,
  longestCookTime: number,
  waitRatioWeight: number = 2.0,
  orderAgeWeight: number = 1.0,
  cookComplexityWeight: number = 0.5
): number {
  const now = new Date();
  
  // Calculate wait ratio (how close to ETA)
  // Higher = closer to or past ETA
  let waitRatio = 0;
  if (estimatedCompletionTime) {
    const etaTimestamp = new Date(estimatedCompletionTime).getTime();
    const totalWaitTime = etaTimestamp - new Date(createdAt).getTime();
    const elapsedTime = now.getTime() - new Date(createdAt).getTime();
    
    if (totalWaitTime > 0) {
      waitRatio = Math.min(2.0, elapsedTime / totalWaitTime);
    }
  }
  
  // Calculate order age score (how long since created)
  // Older orders get higher priority
  const orderAgeMinutes = (now.getTime() - new Date(createdAt).getTime()) / 60000;
  const orderAgeScore = Math.min(1.0, orderAgeMinutes / 30); // Cap at 30 minutes old
  
  // Calculate cook complexity score
  // More complex orders (more items, longer cook times) get higher priority
  const itemCountScore = Math.min(1.0, itemCount / 10); // Cap at 10 items
  const cookTimeScore = Math.min(1.0, longestCookTime / 900); // Cap at 15 minutes (900s)
  const cookComplexityScore = (itemCountScore + cookTimeScore) / 2;
  
  // Calculate final priority score
  const priorityScore = (
    (waitRatio * waitRatioWeight) +
    (orderAgeScore * orderAgeWeight) +
    (cookComplexityScore * cookComplexityWeight)
  ) / (waitRatioWeight + orderAgeWeight + cookComplexityWeight);
  
  // Convert to 0-100 scale and round
  return Math.round(priorityScore * 100);
}