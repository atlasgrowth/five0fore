/**
 * Formatting utilities for consistent display of values across components
 */

/**
 * Format currency in cents to dollars with dollar sign
 * @param cents Amount in cents 
 * @returns Formatted string like "$12.34"
 */
export function formatPriceAsDollars(cents: number | undefined | null): string {
  if (cents === null || cents === undefined || isNaN(cents)) {
    return "$0.00";
  }
  return `$${(Math.max(0, cents) / 100).toFixed(2)}`;
}

/**
 * Format seconds to minutes
 * @param seconds Time in seconds
 * @returns Formatted string like "5 min" 
 */
export function formatPrepTime(seconds: number | undefined | null): string {
  // Check for null, undefined, NaN, or invalid type
  if (seconds === null || seconds === undefined || typeof seconds !== 'number' || isNaN(seconds)) {
    return '0 min';
  }
  
  // Convert safely to minutes and ensure we never go below 0
  return `${Math.ceil(Math.max(0, seconds) / 60)} min`;
}

/**
 * Get valid price in cents with fallback to 0
 * Handles various property names (price_cents, priceCents)
 * 
 * @param item Menu item or another object with price property
 * @returns Price in cents as a number
 */
export function getItemPriceCents(item: any): number {
  // Handle different property naming conventions
  let price = null;
  
  if (item?.price_cents !== undefined) {
    price = item.price_cents;
  } else if (item?.priceCents !== undefined) {
    price = item.priceCents;
  }
  
  // Ensure it's a valid number
  if (price === null || price === undefined || typeof price !== 'number' || isNaN(price)) {
    return 0;
  }
  
  return Math.max(0, price);
}

/**
 * Get valid prep seconds with fallback to 0
 * Handles various property names (prep_seconds, prepSeconds)
 * 
 * @param item Menu item or another object with prep time property
 * @returns Prep time in seconds as a number
 */
export function getItemPrepSeconds(item: any): number {
  // Handle different property naming conventions
  let seconds = null;
  
  if (item?.prep_seconds !== undefined) {
    seconds = item.prep_seconds;
  } else if (item?.prepSeconds !== undefined) {
    seconds = item.prepSeconds;
  }
  
  // Ensure it's a valid number
  if (seconds === null || seconds === undefined || typeof seconds !== 'number' || isNaN(seconds)) {
    return 0;
  }
  
  return Math.max(0, seconds);
}