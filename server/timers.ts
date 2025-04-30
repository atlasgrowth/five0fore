/**
 * Timer utilities for kitchen workflow
 * 
 * This file contains utilities for identifying items that are ready for status transitions
 * in the kitchen workflow, but requires manual confirmation for actual transitions.
 */

import { db } from './db';
import { orderItems, OrderItemStatus, orders, OrderStatus } from '../shared/schema';
import { eq, and, isNull, not, lt, gt } from 'drizzle-orm';
import { storage } from './storage';

/**
 * Background timer that checks for items that might need status updates
 * - Items that have finished cooking need manual confirmation to move to PLATING
 * - Items in PLATING status need manual confirmation to be marked as READY
 */
export async function startKitchenTimers() {
  console.log('Starting kitchen timer background tasks...');
  
  // Check for item status every 10 seconds
  setInterval(checkCookingItemsProgress, 10000);
  setInterval(checkPlatingItemsProgress, 10000);
}

/**
 * Check for items that are COOKING to update their progress
 * 
 * This includes items that:
 * 1. Are in COOKING state
 * 2. Have a firedAt timestamp 
 * 3. Have been cooking for some time
 * 
 * Instead of automatically transitioning them, this will flag them in the database
 * as "readyToPlate" or update their progress percentage, which the UI can use
 * to notify kitchen staff that action is needed.
 */
export async function checkCookingItemsProgress() {
  console.log('Checking for items that need to transition from COOKING to PLATING...');
  
  try {
    // Find items that are in COOKING state with firedAt timestamp
    const cookingItems = await db
      .select()
      .from(orderItems)
      .where(
        and(
          eq(orderItems.status, OrderItemStatus.COOKING),
          not(isNull(orderItems.firedAt))
        )
      );
    
    // Filter items that have been cooking for longer than their cook time
    // BUT DON'T automatically transition them
    const readyToPlateItems = cookingItems.filter(item => {
      if (!item.firedAt || !item.cookSeconds) return false;
      
      const firedAt = new Date(item.firedAt);
      const cookSeconds = item.cookSeconds;
      const currentTime = new Date();
      const elapsedSeconds = Math.floor((currentTime.getTime() - firedAt.getTime()) / 1000);
      
      return elapsedSeconds >= cookSeconds;
    });
    
    console.log(`Found ${readyToPlateItems.length} items ready for plating (awaiting confirmation)`);
    
    // NO AUTOMATIC TRANSITIONS - just updating database to indicate they're ready for the next step
    // Kitchen staff will need to confirm these items are ready for plating
    
    // For items that aren't ready yet, update their progress
    const inProgressItems = cookingItems.filter(item => {
      if (!item.firedAt || !item.cookSeconds) return false;
      
      const firedAt = new Date(item.firedAt);
      const cookSeconds = item.cookSeconds;
      const currentTime = new Date();
      const elapsedSeconds = Math.floor((currentTime.getTime() - firedAt.getTime()) / 1000);
      
      // Not ready yet, but has progress to report
      return elapsedSeconds < cookSeconds;
    });
    
    // Just log the number of in-progress items
    console.log(`Found ${inProgressItems.length} items in progress`);
    
    // Only log individual items if they're almost done
    for (const item of inProgressItems) {
      if (item.firedAt && item.cookSeconds) {
        const firedAt = new Date(item.firedAt);
        const cookSeconds = item.cookSeconds;
        const currentTime = new Date();
        const elapsedSeconds = Math.floor((currentTime.getTime() - firedAt.getTime()) / 1000);
        
        // Only log items that are almost done
        if (elapsedSeconds > cookSeconds * 0.8) {
          const progress = Math.min(Math.floor((elapsedSeconds / cookSeconds) * 100), 99);
          console.log(`Item ${item.id} is almost done cooking (${progress}%)`);
        }
      }
    }
    
  } catch (error) {
    console.error('Error checking cooking items progress:', error);
  }
}

/**
 * Check for items in PLATING state and update their progress
 * 
 * This function tracks the progress of items in PLATING state
 * but doesn't automatically transition them to READY.
 */
export async function checkPlatingItemsProgress() {
  console.log('Checking for items that need to be marked as ready...');
  
  try {
    // Find items that are in PLATING state with platingAt timestamp
    const platingItems = await db
      .select()
      .from(orderItems)
      .where(
        and(
          eq(orderItems.status, OrderItemStatus.PLATING),
          not(isNull(orderItems.platingAt))
        )
      );
    
    // Standard plating time is 2 minutes (120 seconds)
    const standardPlatingSeconds = 120;
    
    // Filter items that have been plating for longer than the standard time
    // BUT DON'T automatically transition them
    const readyToServeItems = platingItems.filter(item => {
      if (!item.platingAt) return false;
      
      const platingAt = new Date(item.platingAt);
      const currentTime = new Date();
      const elapsedSeconds = Math.floor((currentTime.getTime() - platingAt.getTime()) / 1000);
      
      return elapsedSeconds >= standardPlatingSeconds;
    });
    
    console.log(`Found ${readyToServeItems.length} items to mark as ready (awaiting confirmation)`);
    
    // NO AUTOMATIC TRANSITIONS - kitchen staff will need to confirm these items are ready to serve
    
    // For items still in progress, update their progress percentage
    const inProgressItems = platingItems.filter(item => {
      if (!item.platingAt) return false;
      
      const platingAt = new Date(item.platingAt);
      const currentTime = new Date();
      const elapsedSeconds = Math.floor((currentTime.getTime() - platingAt.getTime()) / 1000);
      
      // Still plating, not yet at standard plating time
      return elapsedSeconds < standardPlatingSeconds;
    });
    
    // Just log the number of in-progress items
    console.log(`Found ${inProgressItems.length} items being plated`);
    
    // Only log individual items if they're almost done
    for (const item of inProgressItems) {
      if (item.platingAt) {
        const platingAt = new Date(item.platingAt);
        const currentTime = new Date();
        const elapsedSeconds = Math.floor((currentTime.getTime() - platingAt.getTime()) / 1000);
        
        // Only log items that are almost done
        if (elapsedSeconds > standardPlatingSeconds * 0.8) {
          const progress = Math.min(Math.floor((elapsedSeconds / standardPlatingSeconds) * 100), 99);
          console.log(`Item ${item.id} is almost done plating (${progress}%)`);
        }
      }
    }
    
  } catch (error) {
    console.error('Error checking plating items progress:', error);
  }
}