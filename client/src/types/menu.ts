/**
 * Represents a menu item with support for both snake_case and camelCase property names
 * to handle API inconsistencies
 */
export interface MenuItem {
  id: string;
  name: string;
  category: string;
  price_cents?: number;
  priceCents?: number;
  station: string;
  prep_seconds?: number;
  prepSeconds?: number;
  description: string | null;
  image_url?: string | null;
  imageUrl?: string | null;
  active: boolean;
  customizable?: boolean;
}

/**
 * Represents a menu category
 */
export interface Category {
  id: number;
  name: string;
  slug: string;
}

/**
 * Utility function to get the price in cents from a menu item
 * Handles both snake_case and camelCase property names
 */
export function getItemPriceCents(item: MenuItem): number {
  if (typeof item.priceCents === 'number' && !isNaN(item.priceCents)) {
    return item.priceCents;
  } 
  if (typeof item.price_cents === 'number' && !isNaN(item.price_cents)) {
    return item.price_cents;
  }
  return 0;
}

/**
 * Utility function to get the prep time in seconds from a menu item
 * Handles both snake_case and camelCase property names
 */
export function getItemPrepSeconds(item: MenuItem): number {
  if (typeof item.prepSeconds === 'number' && !isNaN(item.prepSeconds)) {
    return item.prepSeconds;
  } 
  if (typeof item.prep_seconds === 'number' && !isNaN(item.prep_seconds)) {
    return item.prep_seconds;
  }
  return 0;
}

/**
 * Formats a price in cents as a dollar string with 2 decimal places
 */
export function formatPriceAsDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * Formats seconds as minutes (rounded up) with "min" suffix
 */
export function formatSecondsAsMinutes(seconds: number): string {
  return `${Math.ceil(seconds / 60)} min`;
}