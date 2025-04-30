import { useState } from "react";
import { useOrder } from "@/contexts/OrderContext";
import { type Category, type MenuItem } from "@shared/schema";
import { toast } from "@/hooks/use-toast";
import MenuCard from "./MenuCard";

interface MenuItemsProps {
  menuData: Array<{
    category: Category;
    items: MenuItem[];
  }>;
  selectedCat: string;
}

export default function MenuItems({ menuData, selectedCat }: MenuItemsProps) {
  const { addToCart } = useOrder();
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  const allItems = menuData.flatMap(category => category.items);
  
  const displayItems = selectedCat 
    ? menuData
        .find(category => category.category.slug === selectedCat)?.items || []
    : allItems;

  const handleAddToCart = (item: MenuItem) => {
    // Set selected item for animation
    setSelectedItem(item.id);
    
    // Add to cart
    addToCart({
      menuItemId: item.id,
      name: item.name,
      priceCents: item.price_cents,
      quantity: 1
    });
    
    // Show toast
    toast({
      title: "Added to order",
      description: `${item.name} has been added to your order`,
      duration: 2000,
    });
    
    // Reset selected item after animation completes
    setTimeout(() => {
      setSelectedItem(null);
    }, 500);
  };
  
  // Format price from cents to dollars
  const formatPrice = (price: number) => {
    return `$${(price / 100).toFixed(2)}`;
  };
  
  // Format prep time from seconds to minutes
  const formatPrepTime = (seconds: number) => {
    return `${Math.ceil(seconds / 60)} min`;
  };

  return (
    <div className="space-y-6 mb-8">
      {displayItems.map((item) => (
        <MenuCard
          key={item.id}
          item={item}
          onAddToCart={handleAddToCart}
          isSelected={selectedItem === item.id}
        />
      ))}
    </div>
  );
}
