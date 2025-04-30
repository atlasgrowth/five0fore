import { useState, useEffect } from "react";
import { Category, MenuItem, CustomizationSelection } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Search, TagIcon, Clock, Info, Star, Utensils } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import MenuItemCustomizeModal from "./MenuItemCustomizeModal";
import { formatPriceAsDollars, formatPrepTime, getItemPriceCents, getItemPrepSeconds } from "../../utils/formatting";

interface ServerMenuItemsProps {
  menuData: Array<{
    category: Category;
    items: MenuItem[];
  }>;
  onAddToCart: (item: { 
    menuItemId: string; 
    name: string; 
    priceCents: number; 
    quantity: number;
    notes?: string;
    customizations?: CustomizationSelection[];
  }) => void;
}

export default function ServerMenuItems({ menuData, onAddToCart }: ServerMenuItemsProps) {
  // Flatten all menu items into a single array
  const allItems = menuData.flatMap(category => category.items);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredItems, setFilteredItems] = useState(allItems);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [customizeModalOpen, setCustomizeModalOpen] = useState(false);
  const [itemToCustomize, setItemToCustomize] = useState<MenuItem | null>(null);
  
  // Initialize filtered items with all items
  useEffect(() => {
    setFilteredItems(allItems);
  }, [allItems]);
  
  // Filter items whenever the search query changes
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredItems(allItems);
      return;
    }
    
    const query = searchQuery.toLowerCase();
    const filtered = allItems.filter(item => {
      return (
        item.name.toLowerCase().includes(query) ||
        (item.description && item.description.toLowerCase().includes(query)) ||
        item.category.toLowerCase().includes(query)
      );
    });
    
    setFilteredItems(filtered);
  }, [searchQuery, allItems]);
  
  // Simple add to cart without customization
  const handleSimpleAddToCart = (item: MenuItem) => {
    setSelectedItem(item.id);
    
    onAddToCart({
      menuItemId: item.id,
      name: item.name,
      priceCents: getItemPriceCents(item),
      quantity: 1
    });
    
    // Reset selection after brief animation
    setTimeout(() => setSelectedItem(null), 500);
  };
  
  // Open customization modal if item is customizable
  const handleItemClick = (item: MenuItem) => {
    // Use our isCustomizable function to check
    if (isCustomizable(item)) {
      setItemToCustomize(item);
      setCustomizeModalOpen(true);
    } else {
      handleSimpleAddToCart(item);
    }
  };
  
  // Handle adding to cart with customizations
  const handleCustomizedAddToCart = (
    item: MenuItem, 
    quantity: number, 
    customizations: CustomizationSelection[], 
    notes: string
  ) => {
    setSelectedItem(item.id);
    
    onAddToCart({
      menuItemId: item.id,
      name: item.name,
      priceCents: getItemPriceCents(item),
      quantity,
      notes,
      customizations
    });
    
    // Reset selection after brief animation
    setTimeout(() => setSelectedItem(null), 500);
  };

  // Get category of an item
  const getItemCategory = (item: MenuItem) => {
    const categoryGroup = menuData.find(group => 
      group.items.some(menuItem => menuItem.id === item.id)
    );
    return categoryGroup ? categoryGroup.category.name : item.category;
  };
  
  // Check if item is customizable - use customizable flag from DB if available
  const isCustomizable = (item: MenuItem) => {
    // First check the customizable flag from DB
    if (typeof item.customizable === 'boolean') {
      return item.customizable;
    }
    
    // Fallback to checking item name/category
    return (
      item.name.toLowerCase().includes("wing") || 
      item.name.toLowerCase().includes("pizza") || 
      item.name.toLowerCase().includes("flatbread") ||
      item.name.toLowerCase().includes("burger") ||
      item.category.toLowerCase().includes("burger") ||
      item.category.toLowerCase().includes("pizza")
    );
  };
  
  return (
    <div className="space-y-4 mb-8">
      {/* Search bar */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          placeholder="Search menu items by name, description or category..."
          className="pl-10 bg-white border-gray-200 focus:border-primary"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <Button 
              variant="ghost" 
              className="h-6 p-0 text-gray-400 hover:text-gray-600" 
              onClick={() => setSearchQuery("")}
            >
              Clear
            </Button>
          </div>
        )}
      </div>
      
      {searchQuery && (
        <p className="text-sm text-muted-foreground mb-4">
          {filteredItems.length === 0 
            ? "No items match your search." 
            : `Found ${filteredItems.length} items matching "${searchQuery}"`}
        </p>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredItems.map((item) => (
          <Card
            key={item.id}
            className={cn(
              "flex overflow-hidden shadow-sm border-neutral-200 transition-all duration-200 hover:shadow-md cursor-pointer",
              selectedItem === item.id ? "ring-2 ring-primary scale-[0.98]" : ""
            )}
            onClick={() => handleItemClick(item)}
          >
            {item.image_url && (
              <div className="relative w-24 h-auto">
                <img src={item.image_url} className="w-full h-full object-cover" alt={item.name} />
                <Badge variant="secondary" className="absolute top-1 left-1 text-xs">
                  <TagIcon className="h-3 w-3 mr-1" />
                  {getItemCategory(item)}
                </Badge>
              </div>
            )}
            <CardContent className="p-3 flex-1 flex flex-col">
              <div className="flex justify-between mb-1">
                <h3 className="font-medium text-neutral-800">{item.name}</h3>
                <span className="font-medium text-primary">{formatPriceAsDollars(getItemPriceCents(item))}</span>
              </div>
              {item.description && (
                <p className="text-sm text-neutral-600 mb-2 line-clamp-2">{item.description}</p>
              )}
              <div className="flex items-center gap-2 mt-1 mb-2">
                <Badge variant="outline" className="text-xs flex items-center">
                  <Clock className="h-3 w-3 mr-1" />
                  {formatPrepTime(getItemPrepSeconds(item))}
                </Badge>
                {isCustomizable(item) && (
                  <Badge variant="default" className="text-xs bg-blue-100 text-blue-800 flex items-center">
                    <Utensils className="h-3 w-3 mr-1" />
                    Customizable
                  </Badge>
                )}
              </div>
              <div className="mt-auto flex justify-end items-center">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost" 
                        size="sm" 
                        className="text-xs text-gray-500 p-1 h-auto"
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent card click from triggering
                          setItemToCustomize(item);
                          setCustomizeModalOpen(true);
                        }}
                      >
                        <Info className="h-3 w-3 mr-1" />
                        Details
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{item.description || "No detailed description available"}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {filteredItems.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-200">
          <Star className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No items match your search criteria.</p>
          <p className="text-gray-400 text-sm mt-1">Try adjusting your search terms or browse by category.</p>
        </div>
      )}
      
      {/* Customization Modal */}
      <MenuItemCustomizeModal
        open={customizeModalOpen}
        onOpenChange={setCustomizeModalOpen}
        menuItem={itemToCustomize}
        onAddToCart={handleCustomizedAddToCart}
      />
    </div>
  );
}