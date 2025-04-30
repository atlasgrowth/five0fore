import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import * as schema from '../shared/schema';

/**
 * This script initializes the database tables based on the schema.
 * It's used for development and testing purposes.
 */
async function main() {
  // Create tables if they don't exist
  await createTables();
  
  console.log('Database migration complete!');
  process.exit(0);
}

async function createTables() {
  const client = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    await client.connect();
    const db = drizzle(client, { schema });
    
    console.log('Running database migrations...');
    await db.execute(/*sql*/`
      ALTER TABLE IF EXISTS "orders" 
      ADD COLUMN IF NOT EXISTS "estimated_completion_time" TIMESTAMP;
      
      ALTER TABLE IF EXISTS "order_items" 
      ADD COLUMN IF NOT EXISTS "station" TEXT;
    `);
    
    console.log('Schema migration complete');
  } catch (error) {
    console.error('Error migrating schema:', error);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});