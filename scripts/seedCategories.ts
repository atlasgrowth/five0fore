import { db } from '../server/db';
import { menuItems, categories } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { fileURLToPath } from 'url';
import * as path from 'path';

// Convert ESM URL to file path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to convert a string to slug
function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')     // Replace spaces with -
    .replace(/&/g, '-and-')   // Replace & with 'and'
    .replace(/[^\w\-]+/g, '') // Remove all non-word chars
    .replace(/\-\-+/g, '-');  // Replace multiple - with single -
}

async function seedCategories() {
  console.log('Starting categories seeding...');

  try {
    // Get existing categories
    const existingCategories = await db.select().from(categories);
    
    if (existingCategories.length > 0) {
      console.log(`Skipping category creation. Found ${existingCategories.length} existing categories.`);
      return;
    }

    // Get distinct categories from menu items
    const menuCategories = await db
      .selectDistinct({ category: menuItems.category })
      .from(menuItems)
      .orderBy(menuItems.category);

    console.log(`Found ${menuCategories.length} distinct categories from menu items.`);

    // Insert each category
    for (let i = 0; i < menuCategories.length; i++) {
      const categoryName = menuCategories[i].category;
      const slug = slugify(categoryName);
      
      await db.insert(categories).values({
        id: i + 1, // Assign sequential IDs
        name: categoryName,
        slug: slug
      });
      
      console.log(`Created category: ${categoryName} (${slug})`);
    }

    console.log('Categories seeding completed successfully!');
  } catch (error) {
    console.error('Error seeding categories:', error);
    throw error;
  }
}

// Run the seed function
seedCategories()
  .then(() => {
    console.log('Categories seed completed successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });