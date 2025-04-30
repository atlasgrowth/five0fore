import { AttentionLevel } from '@shared/schema';

/**
 * Kitchen timing constants
 */
export const PREP_BUFFER_SECONDS = 150; // 2.5 minutes standard prep time buffer
export const EXPO_BUFFER_SECONDS = 150; // 2.5 minutes standard expo/delivery buffer
export const DEFAULT_COOK_SECONDS = 300; // 5 minutes default cooking time
export const DEFAULT_PLATING_SECONDS = 120; // 2 minutes default plating time

// Default load factor of 1.0 means normal kitchen load
const DEFAULT_LOAD_FACTOR = 1.0;

// Load factor damping to prevent wild swings (0.5 means 50% damping)
const DEFAULT_LOAD_DAMPING = 0.5;

/**
 * Apply load factor with damping to prevent wild time estimates
 * Formula: Base time × (damping + (1-damping) × loadFactor)
 * 
 * @param baseSeconds The base time in seconds
 * @param loadFactor The current kitchen load factor (1.0 = normal)
 * @param dampingCoefficient How much to dampen the load factor (0.5 = 50%)
 * @returns Adjusted time in seconds
 */
export function applyLoadFactor(
  baseSeconds: number, 
  loadFactor: number = DEFAULT_LOAD_FACTOR,
  dampingCoefficient: number = DEFAULT_LOAD_DAMPING
): number {
  // Ensure load factor is positive
  const safeLoadFactor = Math.max(0.1, loadFactor);
  
  // Apply damping: adjusted = base × (damping + (1-damping) × loadFactor)
  // This keeps the adjustment from swinging wildly
  return Math.round(baseSeconds * (dampingCoefficient + (1 - dampingCoefficient) * safeLoadFactor));
}

/**
 * Calculate total expected time for an order with load factor adjustment
 * Formula: Prep buffer + Longest cook time + Expo buffer, all adjusted by load
 * 
 * @param longestCookSeconds The cook time for the longest item in the order
 * @param loadFactor Current kitchen load factor (default 1.0)
 * @param loadDamping Damping coefficient (default 0.5)
 * @returns Total expected time in seconds
 */
export function calculateTotalOrderTime(
  longestCookSeconds: number,
  loadFactor: number = DEFAULT_LOAD_FACTOR,
  loadDamping: number = DEFAULT_LOAD_DAMPING
): number {
  const adjustedPrepBuffer = applyLoadFactor(PREP_BUFFER_SECONDS, loadFactor, loadDamping);
  const adjustedCookTime = applyLoadFactor(longestCookSeconds, loadFactor, loadDamping);
  const adjustedExpoBuffer = applyLoadFactor(EXPO_BUFFER_SECONDS, loadFactor, loadDamping);
  
  return adjustedPrepBuffer + adjustedCookTime + adjustedExpoBuffer;
}

/**
 * Calculate when an order should be ready with load factor adjustment
 * 
 * @param orderCreatedAt When the order was created
 * @param longestCookSeconds The cook time for the longest item
 * @param loadFactor Current kitchen load factor (default 1.0)
 * @param loadDamping Damping coefficient (default 0.5)
 * @returns Date when the order should be ready
 */
export function calculateOrderReadyTime(
  orderCreatedAt: Date, 
  longestCookSeconds: number, 
  loadFactor: number = DEFAULT_LOAD_FACTOR,
  loadDamping: number = DEFAULT_LOAD_DAMPING
): Date {
  const totalSeconds = calculateTotalOrderTime(longestCookSeconds, loadFactor, loadDamping);
  const readyAt = new Date(orderCreatedAt);
  readyAt.setSeconds(readyAt.getSeconds() + totalSeconds);
  return readyAt;
}

/**
 * Calculate the attention level for an order based on its estimated completion time
 * 
 * @param estimatedCompletionTime When the order is expected to be ready
 * @param attentionThreshold Percentage of time when order needs attention (default 80%)
 * @param priorityThreshold Percentage of time when order becomes priority (default 100%)
 * @param criticalThreshold Percentage of time when order becomes critical (default 125%)
 * @returns The attention level for the order
 */
export function calculateAttentionLevel(
  estimatedCompletionTime: Date | string | null,
  attentionThreshold: number = 0.8,
  priorityThreshold: number = 1.0,
  criticalThreshold: number = 1.25
): AttentionLevel {
  if (!estimatedCompletionTime) {
    return AttentionLevel.NORMAL;
  }
  
  const estCompleteTime = typeof estimatedCompletionTime === 'string' 
    ? new Date(estimatedCompletionTime) 
    : estimatedCompletionTime;
    
  const now = new Date();
  const orderCreatedAt = new Date(estCompleteTime);
  orderCreatedAt.setMinutes(orderCreatedAt.getMinutes() - 10); // Assuming 10 min total time as rough estimate
  
  // Calculate how much of the estimated time has elapsed (as a percentage)
  const totalEstimatedSeconds = (estCompleteTime.getTime() - orderCreatedAt.getTime()) / 1000;
  const elapsedSeconds = (now.getTime() - orderCreatedAt.getTime()) / 1000;
  const percentComplete = elapsedSeconds / totalEstimatedSeconds;
  
  // Determine attention level based on percentage of completion
  if (percentComplete >= criticalThreshold) {
    return AttentionLevel.CRITICAL;
  } else if (percentComplete >= priorityThreshold) {
    return AttentionLevel.PRIORITY;
  } else if (percentComplete >= attentionThreshold) {
    return AttentionLevel.ATTENTION;
  } else {
    return AttentionLevel.NORMAL;
  }
}

/**
 * Calculate the priority score for an order
 * Higher scores = higher priority in the queue
 * 
 * @param createdAt When the order was created
 * @param estimatedCompletionTime When the order should be ready
 * @param totalItems Number of items in the order
 * @param longestCookTime Cook time of the longest item (seconds)
 * @param waitRatioWeight Weight for time waited / expected ratio (default 2.0)
 * @param orderAgeWeight Weight for order age in minutes (default 1.0)
 * @param cookComplexityWeight Weight for cooking complexity (default 0.5)
 * @returns Priority score (higher = more urgent)
 */
export function calculatePriorityScore(
  createdAt: Date | string,
  estimatedCompletionTime: Date | string | null,
  totalItems: number,
  longestCookTime: number,
  waitRatioWeight: number = 2.0,
  orderAgeWeight: number = 1.0,
  cookComplexityWeight: number = 0.5
): number {
  const orderTime = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
  const now = new Date();
  
  // Component 1: Order age in minutes
  const orderAgeMinutes = (now.getTime() - orderTime.getTime()) / (1000 * 60);
  
  // Component 2: Wait ratio (current time / expected time)
  let waitRatio = 0;
  if (estimatedCompletionTime) {
    const estCompleteTime = typeof estimatedCompletionTime === 'string' 
      ? new Date(estimatedCompletionTime) 
      : estimatedCompletionTime;
      
    // Expected wait time in minutes
    const expectedWaitMinutes = (estCompleteTime.getTime() - orderTime.getTime()) / (1000 * 60);
    
    // Actual wait time so far
    waitRatio = orderAgeMinutes / expectedWaitMinutes;
  }
  
  // Component 3: Cooking complexity (based on items and cook time)
  const cookComplexity = totalItems * (longestCookTime / DEFAULT_COOK_SECONDS);
  
  // Calculate final priority score
  const priorityScore = 
    (waitRatio * waitRatioWeight) + 
    (orderAgeMinutes * orderAgeWeight / 10) + // Divide by 10 to normalize age contribution
    (cookComplexity * cookComplexityWeight);
    
  return Number(priorityScore.toFixed(2)); // Round to 2 decimal places
}