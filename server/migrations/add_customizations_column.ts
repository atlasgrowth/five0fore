import { db } from '../db';

export async function up() {
  // Add customizations column to order_items table
  try {
    await db.execute(`
      ALTER TABLE order_items 
      ADD COLUMN IF NOT EXISTS customizations JSONB;
    `);
    console.log('Migration successful: Added customizations column to order_items table');
    return true;
  } catch (error) {
    console.error('Migration failed:', error);
    return false;
  }
}

// If we need to roll back this migration
export async function down() {
  try {
    await db.execute(`
      ALTER TABLE order_items 
      DROP COLUMN IF EXISTS customizations;
    `);
    console.log('Rollback successful: Removed customizations column from order_items table');
    return true;
  } catch (error) {
    console.error('Rollback failed:', error);
    return false;
  }
}

// Run the migration immediately
up().then(() => {
  console.log("Migration complete");
  process.exit(0);
}).catch(error => {
  console.error("Migration failed:", error);
  process.exit(1);
});