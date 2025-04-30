import { db } from '../server/db';
import { menuItems, bays } from '../shared/schema';
import { eq } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Convert ESM URL to file path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function seedDatabase() {
  console.log('Starting database seeding...');

  // Check if we already have data
  const existingBays = await db.select().from(bays);
  const existingMenuItems = await db.select().from(menuItems);

  // Create bays if they don't exist
  if (existingBays.length === 0) {
    console.log('Creating bays...');
    for (let floor = 1; floor <= 3; floor++) {
      for (let bayNum = 1; bayNum <= 33; bayNum++) {
        const bayNumber = (floor - 1) * 33 + bayNum;
        await db.insert(bays).values({
          id: bayNumber,
          number: bayNumber,
          floor,
          status: "empty"
        });
      }
    }
    console.log('Created 100 bays across 3 floors.');
  } else {
    console.log(`Skipping bay creation. Found ${existingBays.length} existing bays.`);
  }

  // Import menu items if they don't exist
  if (existingMenuItems.length === 0) {
    console.log('Importing menu items...');
    const menuFilePath = path.join(__dirname, 'menu.json');
    
    if (!fs.existsSync(menuFilePath)) {
      throw new Error(`Menu file not found at ${menuFilePath}`);
    }
    
    const menuData = JSON.parse(fs.readFileSync(menuFilePath, 'utf8'));
    
    // Batch insert menu items
    for (const item of menuData) {
      await db.insert(menuItems).values({
        name: item.name,
        category: item.category,
        price_cents: item.price,
        station: item.station,
        prep_seconds: item.prepSeconds,
        description: `Delicious ${item.name}`,
        active: true
      });
    }
    
    console.log(`Imported ${menuData.length} menu items.`);
  } else {
    console.log(`Skipping menu item import. Found ${existingMenuItems.length} existing menu items.`);
  }

  console.log('Database seeding completed successfully!');
}

// Run the seed function
seedDatabase()
  .then(() => {
    console.log('Seed completed successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error seeding database:', error);
    process.exit(1);
  });