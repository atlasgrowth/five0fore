/**
 * Migration to add status tracking fields to order_items table
 */
import { db, pool } from '../db';
import { orderItems } from '../../shared/schema';
import { sql } from 'drizzle-orm';

/**
 * Add status, cookSeconds, readyAt, and deliveredAt columns to order_items table
 */
export async function up() {
  console.log('Running migration: Add order item status fields');

  try {
    // Add status column
    await db.execute(sql`
      ALTER TABLE order_items
      ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'NEW'
    `);

    // Add cookSeconds column (time in seconds it should take to cook)
    await db.execute(sql`
      ALTER TABLE order_items
      ADD COLUMN IF NOT EXISTS cook_seconds INTEGER DEFAULT 300
    `);

    // Add readyAt column (timestamp when the item should be ready)
    await db.execute(sql`
      ALTER TABLE order_items
      ADD COLUMN IF NOT EXISTS ready_at TIMESTAMP WITH TIME ZONE
    `);

    // Add deliveredAt column (timestamp when the item was delivered)
    await db.execute(sql`
      ALTER TABLE order_items
      ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE
    `);

    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

/**
 * Remove the added columns from order_items table
 */
export async function down() {
  console.log('Running down migration: Remove order item status fields');

  try {
    // Remove all the columns
    await db.execute(sql`
      ALTER TABLE order_items
      DROP COLUMN IF EXISTS status,
      DROP COLUMN IF EXISTS cook_seconds,
      DROP COLUMN IF EXISTS ready_at,
      DROP COLUMN IF EXISTS delivered_at
    `);

    console.log('Down migration completed successfully');
  } catch (error) {
    console.error('Down migration failed:', error);
    throw error;
  }
}