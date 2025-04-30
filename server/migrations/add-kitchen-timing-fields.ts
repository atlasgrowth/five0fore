/**
 * Migration script to add kitchen timing-related fields to order_items table
 * 
 * This adds fields to support the enhanced kitchen timing and analytics system:
 * - expectedTotalTime: The total expected time for this item from order to completion
 * - startedAt: When cooking actually started (replaces firedAt for clarity)
 * - platingAt: When moved to plating station
 * - actualReadyAt: When actually marked ready (timestamp when ready button pressed)
 * - servedAt: When delivered to customer (replaces deliveredAt for consistency)
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';

export async function up() {
  console.log('Adding kitchen timing fields to order_items table...');
  
  try {
    // Add the new fields to the order_items table
    await db.execute(sql`
      ALTER TABLE "order_items"
      ADD COLUMN IF NOT EXISTS "expected_total_time" INTEGER,
      ADD COLUMN IF NOT EXISTS "started_at" TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS "plating_at" TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS "actual_ready_at" TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS "served_at" TIMESTAMPTZ
    `);

    console.log('Successfully added kitchen timing fields');
    
    // Add kitchen load factor to the restaurant system
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "kitchen_settings" (
        "id" SERIAL PRIMARY KEY, 
        "load_factor" FLOAT NOT NULL DEFAULT 1.0,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_by" TEXT
      )
    `);
    
    // Insert default record if none exists
    await db.execute(sql`
      INSERT INTO "kitchen_settings" ("load_factor", "updated_by")
      SELECT 1.0, 'system'
      WHERE NOT EXISTS (SELECT 1 FROM "kitchen_settings")
    `);
    
    console.log('Successfully set up kitchen settings table');
    
    return { success: true, message: 'Kitchen timing fields migration completed successfully' };
  } catch (error) {
    console.error('Error during migration:', error);
    return { success: false, message: 'Migration failed', error };
  }
}

// Function to remove the added fields and tables
export async function down() {
  try {
    // Remove the fields from order_items 
    await db.execute(sql`
      ALTER TABLE "order_items"
      DROP COLUMN IF EXISTS "expected_total_time",
      DROP COLUMN IF EXISTS "started_at",
      DROP COLUMN IF EXISTS "plating_at",
      DROP COLUMN IF EXISTS "actual_ready_at",
      DROP COLUMN IF EXISTS "served_at"
    `);
    
    // Drop the kitchen settings table if it exists
    await db.execute(sql`DROP TABLE IF EXISTS "kitchen_settings"`);
    
    return { success: true, message: 'Successfully reverted kitchen timing fields migration' };
  } catch (error) {
    console.error('Error during migration rollback:', error);
    return { success: false, message: 'Migration rollback failed', error };
  }
}