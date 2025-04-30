/**
 * Migration to add seating type fields to bays table
 */
import { db } from "../db";
import { sql } from "drizzle-orm";

export async function up() {
  console.log('Adding seating type fields to bays table...');

  try {
    // Add type field if it doesn't exist
    await db.execute(sql`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (
          SELECT 1 
          FROM information_schema.columns 
          WHERE table_name = 'bays' AND column_name = 'type'
        ) THEN 
          ALTER TABLE bays ADD COLUMN type TEXT NOT NULL DEFAULT 'BAY';
        END IF;
      END $$;
    `);

    // Add display_name field if it doesn't exist
    await db.execute(sql`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (
          SELECT 1 
          FROM information_schema.columns 
          WHERE table_name = 'bays' AND column_name = 'display_name'
        ) THEN 
          ALTER TABLE bays ADD COLUMN display_name TEXT;
        END IF;
      END $$;
    `);

    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}