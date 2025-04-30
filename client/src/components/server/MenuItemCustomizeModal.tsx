import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { MenuItem, CustomizationSelection } from "@shared/schema";
import { PlusCircle, MinusCircle } from "lucide-react";
import { formatPriceAsDollars, getItemPriceCents } from "../../utils/formatting";

interface MenuItemCustomizeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  menuItem: MenuItem | null;
  onAddToCart: (item: MenuItem, quantity: number, customizations: CustomizationSelection[], notes: string) => void;
}

interface CustomizationOption {
  id: number;
  name: string;
  priceCents: number;
}

export default function MenuItemCustomizeModal({
  open,
  onOpenChange,
  menuItem,
  onAddToCart
}: MenuItemCustomizeModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [customizations, setCustomizations] = useState<CustomizationSelection[]>([]);
  
  // Reset form when modal opens with new item
  useEffect(() => {
    if (open && menuItem) {
      setQuantity(1);
      setNotes("");
      
      // Add default customizations based on item type
      // This is a temporary solution until we have the database schema for customizations
      const defaultCustomizations: CustomizationSelection[] = [];
      
      // For wings, add sauce options
      if (menuItem.name.toLowerCase().includes("wing")) {
        defaultCustomizations.push({
          categoryId: 1,
          categoryName: "Wing Sauce",
          options: []
        });
      }
      
      // For burgers, add toppings and temperature
      if (menuItem.name.toLowerCase().includes("burger") || menuItem.category.toLowerCase().includes("burger")) {
        defaultCustomizations.push({
          categoryId: 2,
          categoryName: "Burger Temperature",
          options: []
        });
        defaultCustomizations.push({
          categoryId: 3,
          categoryName: "Additional Toppings",
          options: []
        });
      }
      
      // For pizzas and flatbreads
      if (menuItem.name.toLowerCase().includes("pizza") || 
          menuItem.name.toLowerCase().includes("flatbread") ||
          menuItem.category.toLowerCase().includes("pizza")) {
        defaultCustomizations.push({
          categoryId: 4, 
          categoryName: "Extra Toppings",
          options: []
        });
      }
      
      setCustomizations(defaultCustomizations);
    }
  }, [open, menuItem]);
  
  if (!menuItem) return null;
  
  // Format price from cents to dollars
  const formatPrice = (price: number) => {
    return formatPriceAsDollars(price);
  };
  
  // Get temporary customization options based on category
  // This would normally come from the database
  const getOptionsForCategory = (categoryId: number): CustomizationOption[] => {
    switch (categoryId) {
      case 1: // Wing Sauce
        return [
          { id: 1, name: "Buffalo", priceCents: 0 },
          { id: 2, name: "BBQ", priceCents: 0 },
          { id: 3, name: "Garlic Parmesan", priceCents: 0 },
          { id: 4, name: "Lemon Pepper", priceCents: 0 },
          { id: 5, name: "Hot Honey", priceCents: 0 }
        ];
      case 2: // Burger Temperature
        return [
          { id: 6, name: "Rare", priceCents: 0 },
          { id: 7, name: "Medium Rare", priceCents: 0 },
          { id: 8, name: "Medium", priceCents: 0 },
          { id: 9, name: "Medium Well", priceCents: 0 },
          { id: 10, name: "Well Done", priceCents: 0 }
        ];
      case 3: // Burger Toppings
        return [
          { id: 11, name: "Bacon", priceCents: 200 },
          { id: 12, name: "Avocado", priceCents: 150 },
          { id: 13, name: "Extra Cheese", priceCents: 100 },
          { id: 14, name: "Fried Egg", priceCents: 150 },
          { id: 15, name: "Grilled Onions", priceCents: 50 },
          { id: 16, name: "Jalapeños", priceCents: 50 }
        ];
      case 4: // Pizza Toppings
        return [
          { id: 17, name: "Pepperoni", priceCents: 150 },
          { id: 18, name: "Mushrooms", priceCents: 100 },
          { id: 19, name: "Extra Cheese", priceCents: 150 },
          { id: 20, name: "Sausage", priceCents: 150 },
          { id: 21, name: "Olives", priceCents: 100 },
          { id: 22, name: "Onions", priceCents: 100 },
          { id: 23, name: "Bell Peppers", priceCents: 100 }
        ];
      default:
        return [];
    }
  };
  
  // Add or remove an option from a category
  const toggleOption = (categoryId: number, option: CustomizationOption, isRadio: boolean = false) => {
    setCustomizations(prev => {
      return prev.map(cat => {
        if (cat.categoryId !== categoryId) return cat;
        
        // If it's a radio button, replace all options
        if (isRadio) {
          return { ...cat, options: [option] };
        }
        
        // For checkboxes, toggle the option
        const optionExists = cat.options.some(o => o.id === option.id);
        
        if (optionExists) {
          return { ...cat, options: cat.options.filter(o => o.id !== option.id) };
        } else {
          return { ...cat, options: [...cat.options, option] };
        }
      });
    });
  };
  
  // Calculate total price with customizations
  const calculateTotalPrice = () => {
    let total = getItemPriceCents(menuItem);
    
    // Add prices of all selected customization options
    customizations.forEach(cat => {
      cat.options.forEach(opt => {
        total += opt.priceCents;
      });
    });
    
    // Multiply by quantity
    return total * quantity;
  };
  
  // Check if an option is selected
  const isOptionSelected = (categoryId: number, optionId: number) => {
    const category = customizations.find(c => c.categoryId === categoryId);
    if (!category) return false;
    return category.options.some(o => o.id === optionId);
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold flex items-center justify-between">
            {menuItem.name}
            <span className="text-primary">{formatPrice(menuItem.price_cents)}</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 my-4">
          {/* Quantity selector */}
          <div>
            <Label htmlFor="quantity" className="text-base font-medium">Quantity</Label>
            <div className="flex items-center mt-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity <= 1}
              >
                <MinusCircle className="h-4 w-4" />
              </Button>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-16 mx-2 text-center"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setQuantity(quantity + 1)}
              >
                <PlusCircle className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Customization options */}
          {customizations.map((category) => (
            <div key={category.categoryId} className="space-y-3">
              <Label className="text-base font-medium">{category.categoryName}</Label>
              
              {/* If it's wing sauce or burger temperature, use radio buttons */}
              {(category.categoryId === 1 || category.categoryId === 2) ? (
                <RadioGroup 
                  defaultValue={category.options[0]?.id.toString()}
                  className="space-y-2"
                >
                  {getOptionsForCategory(category.categoryId).map((option) => (
                    <div key={option.id} className="flex items-center space-x-2">
                      <RadioGroupItem
                        id={`option-${option.id}`}
                        value={option.id.toString()}
                        checked={isOptionSelected(category.categoryId, option.id)}
                        onClick={() => toggleOption(category.categoryId, option, true)}
                      />
                      <Label htmlFor={`option-${option.id}`} className="cursor-pointer text-sm">
                        {option.name}
                        {option.priceCents > 0 && (
                          <span className="text-xs text-muted-foreground ml-1">
                            (+{formatPrice(option.priceCents)})
                          </span>
                        )}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              ) : (
                /* For toppings, use checkboxes */
                <div className="space-y-2">
                  {getOptionsForCategory(category.categoryId).map((option) => (
                    <div key={option.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`option-${option.id}`}
                        checked={isOptionSelected(category.categoryId, option.id)}
                        onCheckedChange={() => toggleOption(category.categoryId, option)}
                      />
                      <Label htmlFor={`option-${option.id}`} className="cursor-pointer text-sm">
                        {option.name}
                        {option.priceCents > 0 && (
                          <span className="text-xs text-muted-foreground ml-1">
                            (+{formatPrice(option.priceCents)})
                          </span>
                        )}
                      </Label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          
          {/* Special instructions */}
          <div>
            <Label htmlFor="notes" className="text-base font-medium">Special Instructions</Label>
            <Textarea
              id="notes"
              placeholder="Any special requests or preparation instructions..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-2"
            />
          </div>
        </div>
        
        <DialogFooter className="flex flex-col sm:flex-row items-center gap-4">
          <div className="text-lg font-semibold">
            Total: {formatPrice(calculateTotalPrice())}
          </div>
          <Button
            className="w-full sm:w-auto"
            onClick={() => {
              onAddToCart(menuItem, quantity, customizations, notes);
              onOpenChange(false);
            }}
          >
            Add to Order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}