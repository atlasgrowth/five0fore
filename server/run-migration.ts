import { pool } from './db';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Run all migrations in order
 */
async function runMigrations() {
  console.log('Running migrations...');
  
  // Read all migration files
  const migrationsDir = path.join(__dirname, 'migrations');
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort(); // Sort to ensure migrations run in order
  
  if (migrationFiles.length === 0) {
    console.log('No migrations found.');
    return;
  }
  
  for (const file of migrationFiles) {
    console.log(`Running migration: ${file}`);
    const filePath = path.join(migrationsDir, file);
    
    try {
      // Read the migration file
      const sql = fs.readFileSync(filePath, 'utf8');
      
      // Execute the migration
      await pool.query(sql);
      
      console.log(`Migration ${file} completed successfully.`);
    } catch (error) {
      console.error(`Error running migration ${file}:`);
      console.error(error);
      throw error; // Rethrow to stop the migration process
    }
  }
  
  console.log('All migrations completed successfully!');
}

/**
 * Run a specific migration
 */
async function runMigration(migrationName: string) {
  console.log(`Running migration: ${migrationName}`);
  
  const migrationsDir = path.join(__dirname, 'migrations');
  const filePath = path.join(migrationsDir, migrationName);
  
  if (!fs.existsSync(filePath)) {
    console.error(`Migration file ${migrationName} not found.`);
    return;
  }
  
  try {
    // Read the migration file
    const sql = fs.readFileSync(filePath, 'utf8');
    
    // Execute the migration
    await pool.query(sql);
    
    console.log(`Migration ${migrationName} completed successfully.`);
  } catch (error) {
    console.error(`Error running migration ${migrationName}:`, error);
    throw error;
  }
}

// Check if a specific migration was requested
const specificMigration = process.argv[2];

if (specificMigration) {
  runMigration(specificMigration)
    .then(() => {
      console.log('Migration process completed.');
      process.exit(0);
    })
    .catch(() => {
      console.error('Migration process failed.');
      process.exit(1);
    });
} else {
  runMigrations()
    .then(() => {
      console.log('Migration process completed.');
      process.exit(0);
    })
    .catch(() => {
      console.error('Migration process failed.');
      process.exit(1);
    });
}