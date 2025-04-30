/**
 * Kitchen timing constants
 */
export const PREP_BUFFER_SECONDS = 150; // 2.5 minutes standard prep time buffer
export const EXPO_BUFFER_SECONDS = 150; // 2.5 minutes standard expo/delivery buffer
export const DEFAULT_COOK_SECONDS = 300; // 5 minutes default cooking time
export const DEFAULT_PLATING_SECONDS = 120; // 2 minutes default plating time

/**
 * Calculate total expected time for an order
 * Formula: Prep buffer + Longest cook time + Expo buffer
 * 
 * @param longestCookSeconds The cook time for the longest item in the order
 * @returns Total expected time in seconds
 */
export function calculateTotalOrderTime(longestCookSeconds: number): number {
  return PREP_BUFFER_SECONDS + longestCookSeconds + EXPO_BUFFER_SECONDS;
}

/**
 * Calculate when an order should be ready
 * 
 * @param orderCreatedAt When the order was created
 * @param longestCookSeconds The cook time for the longest item
 * @returns Date when the order should be ready
 */
export function calculateOrderReadyTime(orderCreatedAt: Date, longestCookSeconds: number): Date {
  const totalSeconds = calculateTotalOrderTime(longestCookSeconds);
  const readyAt = new Date(orderCreatedAt);
  readyAt.setSeconds(readyAt.getSeconds() + totalSeconds);
  return readyAt;
}