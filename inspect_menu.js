import { readFileSync } from 'fs';

try {
  const data = readFileSync('menu_response.json', 'utf8');
  const menu = JSON.parse(data);
  
  // Display a sample item with all its properties
  if (menu.length > 0 && menu[0].items.length > 0) {
    const sampleItem = menu[0].items[0];
    console.log('Sample Menu Item Properties:');
    console.log(JSON.stringify(sampleItem, null, 2));
  }
} catch (error) {
  console.error('Error:', error);
}