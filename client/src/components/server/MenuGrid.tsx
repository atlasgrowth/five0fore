import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, ChefHat, Utensils, Pizza, Coffee } from "lucide-react";
import { MenuItem, Category, getItemPriceCents, getItemPrepSeconds, formatPriceAsDollars, formatSecondsAsMinutes } from "../../types/menu";

interface MenuGridProps {
  categories: Category[];
  menuItems: MenuItem[];
  onSelectItem: (item: MenuItem, quantity: number) => void;
}

export default function MenuGrid({ categories, menuItems, onSelectItem }: MenuGridProps) {
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [quantity, setQuantity] = useState(1);

  // Filter items by selected category
  const filteredItems = selectedCategory ? 
    menuItems.filter(item => {
      const category = categories.find(c => c.slug === selectedCategory);
      return category && item.category === category.name;
    }) : 
    menuItems;

  // Function to get appropriate icon for category
  const getCategoryIcon = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('pizza') || n.includes('flatbread')) return <Pizza size={16} />;
    if (n.includes('dessert')) return <Coffee size={16} />;
    return <Utensils size={16} />;
  };

  return (
    <div className="space-y-4">
      {/* Category pills */}
      <div className="flex overflow-x-auto gap-2 pb-3">
        <Button
          variant={selectedCategory === "" ? "default" : "outline"}
          className="rounded-full whitespace-nowrap flex gap-1 items-center px-4"
          onClick={() => setSelectedCategory("")}
        >
          <Utensils size={16} />
          <span>All Items</span>
        </Button>
        
        {categories.map(category => (
          <Button
            key={category.id}
            variant={selectedCategory === category.slug ? "default" : "outline"}
            className="rounded-full whitespace-nowrap flex gap-1 items-center px-4"
            onClick={() => setSelectedCategory(category.slug)}
          >
            {getCategoryIcon(category.name)}
            <span>{category.name}</span>
          </Button>
        ))}
      </div>
      
      {/* Menu items grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {filteredItems.map(item => (
          <Card 
            key={item.id} 
            className={`cursor-pointer transition-all ${
              selectedItem?.id === item.id ? 'border-primary ring-1 ring-primary' : ''
            }`}
            onClick={() => {
              setSelectedItem(item);
              setQuantity(1);
            }}
          >
            <CardContent className="p-2">
              <div className="font-medium text-sm mb-1 line-clamp-2 h-10">{item.name}</div>
              
              <div className="flex justify-between items-end mt-1">
                <div className="text-xs text-muted-foreground">
                  <div className="flex items-center">
                    <Clock size={12} className="mr-1" />
                    <span>{formatSecondsAsMinutes(getItemPrepSeconds(item))}</span>
                  </div>
                  <div className="flex items-center">
                    <ChefHat size={12} className="mr-1" />
                    <span>{item.station || 'Kitchen'}</span>
                  </div>
                </div>
                
                <div className="text-primary font-semibold">
                  ${formatPriceAsDollars(getItemPriceCents(item))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {/* Quantity control - only appears when an item is selected */}
      {selectedItem && (
        <div className="mt-4 pt-4 border-t flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="icon" 
              className="h-8 w-8" 
              onClick={() => setQuantity(q => Math.max(1, q - 1))}
              disabled={quantity <= 1}
            >
              -
            </Button>
            <span className="w-8 text-center">{quantity}</span>
            <Button 
              variant="outline" 
              size="icon" 
              className="h-8 w-8" 
              onClick={() => setQuantity(q => Math.min(20, q + 1))}
              disabled={quantity >= 20}
            >
              +
            </Button>
          </div>
          
          <Button onClick={() => {
            if (selectedItem) {
              onSelectItem(selectedItem, quantity);
              setSelectedItem(null);
            }
          }}>
            Add to Order
          </Button>
        </div>
      )}
    </div>
  );
}