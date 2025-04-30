import { readFileSync } from "fs";
import { parse } from "csv-parse/sync";
import { db } from "../server/db";
import { menuItems } from "../shared/schema";
(async () => {
  const csv = readFileSync("scripts/creole-tavern-menu.csv", "utf8");
  const rows = parse(csv, { columns: true, skip_empty_lines: true });
  await db.delete(menuItems);          // clear existing
  await db.insert(menuItems).values(rows.map(r => ({
    id: crypto.randomUUID(),
    name: r.name,
    category: r.category || "Other", // Default category
    price_cents: Number(r.priceCents) || 0, // Ensure numeric value
    station: r.station,
    prep_seconds: Number(r.cookSeconds) || 0, // Ensure numeric value
  })));
  console.log(`Imported ${rows.length} items`);
})();