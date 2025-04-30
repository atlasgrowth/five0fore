import { db } from "../server/db";
import { bays, SeatingType, Bay, InsertBay } from "../shared/schema";
import { eq, sql } from "drizzle-orm";

/**
 * Migrates and updates existing bay data to support the new seating layout
 * Floor 1: Bays 101-126, Floor 2: Bays 202-226
 * Bar seating: Left side (7 seats per floor), Right side (8 seats per floor)
 * Tables: 15 tables per floor
 */
(async () => {
  try {
    console.log("Fetching existing bay data...");
    const existingBays = await db.select().from(bays);
    console.log(`Found ${existingBays.length} existing bays`);
    
    // Map of bay ID to new data
    const bayUpdates = new Map<number, {
      number: number;
      floor: number;
      type: SeatingType;
      displayName: string;
    }>();
    
    // Calculate the updates for each bay
    
    // First, update existing bays to Floor 1 (101-126)
    let bayIndex = 0;
    for (let i = 1; i <= 26 && bayIndex < existingBays.length; i++) {
      const bayNumber = 100 + i; // 101, 102, ..., 126
      const existingBay = existingBays[bayIndex++];
      if (existingBay) {
        bayUpdates.set(existingBay.id, {
          number: bayNumber,
          floor: 1,
          type: SeatingType.BAY,
          displayName: `Bay ${bayNumber}`
        });
      }
    }

    // Update the second set to Floor 2 (202-226) if there are more existing bays
    for (let i = 2; i <= 26 && bayIndex < existingBays.length; i++) {
      const bayNumber = 200 + i; // 202, 203, ..., 226
      const existingBay = existingBays[bayIndex++];
      if (existingBay) {
        bayUpdates.set(existingBay.id, {
          number: bayNumber,
          floor: 2,
          type: SeatingType.BAY,
          displayName: `Bay ${bayNumber}`
        });
      }
    }
    
    // If we have more bays, add other types sequentially
    // Bar Left
    for (let floor = 1; floor <= 2 && bayIndex < existingBays.length; floor++) {
      for (let i = 1; i <= 7 && bayIndex < existingBays.length; i++) {
        const existingBay = existingBays[bayIndex++];
        if (existingBay) {
          bayUpdates.set(existingBay.id, {
            number: i,
            floor: floor,
            type: SeatingType.BAR_LEFT,
            displayName: `Bar L${i} (F${floor})`
          });
        }
      }
    }
    
    // Bar Right
    for (let floor = 1; floor <= 2 && bayIndex < existingBays.length; floor++) {
      for (let i = 1; i <= 8 && bayIndex < existingBays.length; i++) {
        const existingBay = existingBays[bayIndex++];
        if (existingBay) {
          bayUpdates.set(existingBay.id, {
            number: i,
            floor: floor,
            type: SeatingType.BAR_RIGHT,
            displayName: `Bar R${i} (F${floor})`
          });
        }
      }
    }
    
    // Tables
    for (let floor = 1; floor <= 2 && bayIndex < existingBays.length; floor++) {
      for (let i = 1; i <= 15 && bayIndex < existingBays.length; i++) {
        const tableNumber = (floor * 100) + i; // 101-115, 201-215
        const existingBay = existingBays[bayIndex++];
        if (existingBay) {
          bayUpdates.set(existingBay.id, {
            number: tableNumber,
            floor: floor,
            type: SeatingType.TABLE,
            displayName: `Table ${tableNumber}`
          });
        }
      }
    }
    
    // Apply updates to each bay
    console.log(`Updating ${bayUpdates.size} bays...`);
    for (const [id, updateData] of bayUpdates.entries()) {
      await db.update(bays)
        .set({
          number: updateData.number,
          floor: updateData.floor,
          type: updateData.type,
          displayName: updateData.displayName
        })
        .where(eq(bays.id, id));
    }
    
    console.log("Bay updates completed successfully");
    
    // If we need more bays than we have, insert new ones
    if (bayIndex < 51) { // 26 + 25 + 7*2 + 8*2 + 15*2 = potential max bays
      console.log("Adding new bay records as needed...");
      const newBays: InsertBay[] = [];
      let maxId = Math.max(...existingBays.map(b => b.id));
      
      // Add missing bay types in ascending order
      let idCounter = maxId + 1;
      
      // Add any missing bays on Floor 1
      const floor1Bays = existingBays.filter(b => bayUpdates.get(b.id)?.floor === 1 && bayUpdates.get(b.id)?.type === SeatingType.BAY);
      if (floor1Bays.length < 26) {
        for (let i = floor1Bays.length + 1; i <= 26; i++) {
          const bayNumber = 100 + i;
          newBays.push({
            id: idCounter++,
            number: bayNumber,
            floor: 1,
            status: "empty",
            type: SeatingType.BAY,
            displayName: `Bay ${bayNumber}`
          });
        }
      }
      
      // Add any missing bays on Floor 2
      const floor2Bays = existingBays.filter(b => bayUpdates.get(b.id)?.floor === 2 && bayUpdates.get(b.id)?.type === SeatingType.BAY);
      if (floor2Bays.length < 25) {
        for (let i = floor2Bays.length + 2; i <= 26; i++) {
          const bayNumber = 200 + i;
          newBays.push({
            id: idCounter++,
            number: bayNumber,
            floor: 2,
            status: "empty",
            type: SeatingType.BAY,
            displayName: `Bay ${bayNumber}`
          });
        }
      }
      
      // Insert any new bays if needed
      if (newBays.length > 0) {
        console.log(`Adding ${newBays.length} new bays...`);
        for (const newBay of newBays) {
          await db.insert(bays).values(newBay);
        }
      }
    }
    
    console.log("Migration and update completed successfully");
  } catch (error) {
    console.error("Error seeding bays:", error);
    process.exit(1);
  }
})();