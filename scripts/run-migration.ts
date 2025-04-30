/**
 * Migration runner script
 * 
 * This script runs the specified migration or all migrations in sequence.
 * 
 * Usage:
 * npm run db:migrate [migration_name]
 * 
 * If migration_name is provided, only that migration is run.
 * If no migration_name is provided, all migrations are run in sequence.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  // Get the migration name from command line arguments if provided
  const migrationName = process.argv[2];
  
  try {
    // Directory containing migration files
    const migrationsDir = path.join(__dirname, '../server/migrations');
    
    // Get all migration files
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.ts') || file.endsWith('.js'))
      .sort(); // Ensure consistent order
    
    if (migrationFiles.length === 0) {
      console.log('No migration files found.');
      return;
    }
    
    if (migrationName) {
      // Run the specific migration
      const matchingFile = migrationFiles.find(file => 
        file.includes(migrationName) || 
        path.parse(file).name === migrationName
      );
      
      if (!matchingFile) {
        console.error(`Migration ${migrationName} not found.`);
        return;
      }
      
      await runMigration(path.join(migrationsDir, matchingFile));
    } else {
      // Run all migrations in sequence
      console.log(`Running ${migrationFiles.length} migrations...`);
      
      for (const file of migrationFiles) {
        await runMigration(path.join(migrationsDir, file));
      }
      
      console.log('All migrations completed.');
    }
  } catch (error) {
    console.error('Migration runner failed:', error);
    process.exit(1);
  }
}

async function runMigration(filePath: string) {
  try {
    const fileName = path.basename(filePath);
    console.log(`Running migration: ${fileName}`);
    
    // Import the migration module
    const migration = await import(filePath);
    
    // Run the up() method
    if (typeof migration.up === 'function') {
      await migration.up();
      console.log(`Migration ${fileName} completed successfully.`);
    } else {
      console.warn(`Migration ${fileName} does not have an up() method.`);
    }
  } catch (error) {
    console.error(`Migration ${filePath} failed:`, error);
    throw error;
  }
}

// Run the script
runMigrations().catch(error => {
  console.error('Migration runner failed:', error);
  process.exit(1);
});