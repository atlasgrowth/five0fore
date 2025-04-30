import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle
} from "@/components/ui/drawer";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, Plus, X, Clock } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ServerOrderDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bayId: number | null;
}

interface CartItem {
  menuItemId: string;
  quantity: number;
  name: string;
  priceCents: number;
}

interface OrderPayload {
  order: {
    bayId: number;
    specialInstructions: string;
  };
  cart: {
    items: {
      menuItemId: string;
      quantity: number;
    }[];
  };
}

interface Bay {
  id: number;
  number: number;
  floor: number;
  status: string;
}

interface Category {
  id: number;
  name: string;
  slug: string;
}

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  category: string;
  price_cents: number;
  station: string;
  prep_seconds: number;
  image_url: string | null;
  active: boolean;
}

export default function ServerOrderDrawer({ open, onOpenChange, bayId }: ServerOrderDrawerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedMenuItem, setSelectedMenuItem] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [specialInstructions, setSpecialInstructions] = useState<string>("");
  const [selectedBayId, setSelectedBayId] = useState<number | null>(bayId);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  
  // Reset form when drawer opens
  useEffect(() => {
    if (open) {
      setSelectedCategory("");
      setSelectedMenuItem(null);
      setQuantity(1);
      setCart([]);
      setSpecialInstructions("");
      setSelectedBayId(bayId);
    }
  }, [open, bayId]);

  // Get bays for selection
  const { data: bays = [], isLoading: baysLoading } = useQuery<Bay[]>({
    queryKey: ['/api/bays'],
    enabled: open && bayId === null,
  });

  // Get menu data
  const { data: menuData = [], isLoading: menuLoading } = useQuery<Array<{
    category: Category;
    items: MenuItem[];
  }>>({
    queryKey: ['/api/menu'],
    enabled: open,
  });
  
  // Extract all categories from menu data
  const categories = menuData.map(item => item.category);
  
  // Get menu items based on selection
  const allItems = menuData.flatMap(category => category.items);
  const displayItems = selectedCategory 
    ? menuData.find(cat => cat.category.slug === selectedCategory)?.items || []
    : allItems;
  
  // Get selected menu item details
  const selectedMenuItemDetails = allItems.find(item => item.id === selectedMenuItem);
  
  // Add item to cart
  const addToCart = () => {
    if (!selectedMenuItemDetails || !selectedMenuItem || quantity <= 0) {
      toast({
        title: "Error",
        description: "Please select a menu item and valid quantity",
        variant: "destructive",
      });
      return;
    }
    
    // Check if item already exists in cart
    const existingItemIndex = cart.findIndex(item => item.menuItemId === selectedMenuItem);
    
    if (existingItemIndex >= 0) {
      // Update quantity if item already exists
      const newCart = [...cart];
      newCart[existingItemIndex].quantity += quantity;
      setCart(newCart);
    } else {
      // Add new item to cart
      setCart([...cart, {
        menuItemId: selectedMenuItem,
        quantity: quantity,
        name: selectedMenuItemDetails.name,
        priceCents: selectedMenuItemDetails.price_cents
      }]);
    }
    
    // Reset selection but keep the category
    setSelectedMenuItem(null);
    setQuantity(1);
    
    toast({
      title: "Added to order",
      description: `${quantity}x ${selectedMenuItemDetails.name}`,
    });
  };
  
  // Remove item from cart
  const removeFromCart = (index: number) => {
    const newCart = [...cart];
    newCart.splice(index, 1);
    setCart(newCart);
  };
  
  // Calculate total price
  const totalPrice = cart.reduce((sum, item) => sum + (item.priceCents * item.quantity) / 100, 0);
  
  // Handle order submission
  const submitOrder = async () => {
    if (!selectedBayId) {
      toast({
        title: "Error",
        description: "Please select a bay for this order",
        variant: "destructive",
      });
      return;
    }
    
    if (cart.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one item to the order",
        variant: "destructive",
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const payload: OrderPayload = {
        order: {
          bayId: selectedBayId,
          specialInstructions: specialInstructions
        },
        cart: {
          items: cart.map(item => ({
            menuItemId: item.menuItemId,
            quantity: item.quantity
          }))
        }
      };
      
      const response = await apiRequest('POST', '/api/orders', payload);
      
      if (response.ok) {
        toast({
          title: "Order Placed",
          description: `Order placed successfully for Bay ${selectedBayId}`,
        });
        
        // Invalidate queries to refresh data
        queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
        queryClient.invalidateQueries({ queryKey: ['/api/bays'] });
        
        // Close drawer
        onOpenChange(false);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to place order");
      }
    } catch (error) {
      console.error("Error placing order:", error);
      toast({
        title: "Error",
        description: "Failed to place order. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[95vh]">
        <DrawerHeader className="border-b pb-4">
          <DrawerTitle className="text-xl font-bold text-primary">
            {selectedBayId ? `New Order - Bay ${selectedBayId}` : 'New Order'}
          </DrawerTitle>
          <DrawerDescription>
            Add items to order and submit when ready
          </DrawerDescription>
        </DrawerHeader>
        
        <div className="px-4 py-2 h-full flex flex-col">
          {/* Bay Selection (only if no bayId was provided) */}
          {!bayId && (
            <div className="mb-6 pt-2">
              <label className="block text-sm font-medium text-neutral-700 mb-1">Select Bay</label>
              <Select 
                value={selectedBayId?.toString() || ""} 
                onValueChange={(value) => setSelectedBayId(parseInt(value))}
                disabled={baysLoading}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a bay" />
                </SelectTrigger>
                <SelectContent>
                  {bays.map((bay) => (
                    <SelectItem key={bay.id} value={bay.id.toString()}>
                      Bay {bay.number} (Floor {bay.floor})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          {/* Item Selection - Only show if bay is selected */}
          {selectedBayId && (
            <>
              <div className="flex-1 overflow-hidden flex flex-col">
                {/* Menu section */}
                <div className="flex-1 min-h-0">
                  <Tabs defaultValue="menu" className="h-full flex flex-col">
                    <TabsList className="mb-2">
                      <TabsTrigger value="menu">Menu Items</TabsTrigger>
                      <TabsTrigger value="cart">Order Summary ({cart.length})</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="menu" className="flex-1 overflow-hidden flex flex-col">
                      {/* Category tabs */}
                      <div className="mb-2">
                        <div className="flex overflow-x-auto pb-2 gap-2 scrollbar-none">
                          <button 
                            onClick={() => setSelectedCategory("")}
                            className={`px-4 py-2 rounded-lg whitespace-nowrap text-sm font-medium transition-all 
                              ${selectedCategory === "" ? "bg-primary text-white" : "bg-muted"}`}
                          >
                            All Items
                          </button>
                          
                          {categories.map((category) => (
                            <button
                              key={category.id}
                              onClick={() => setSelectedCategory(category.slug)}
                              className={`px-4 py-2 rounded-lg whitespace-nowrap text-sm font-medium transition-all 
                                ${selectedCategory === category.slug ? "bg-primary text-white" : "bg-muted"}`}
                            >
                              {category.name}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      {/* Menu items grid */}
                      <ScrollArea className="flex-1">
                        <div className="grid grid-cols-2 gap-3 pb-4">
                          {menuLoading ? (
                            // Loading skeleton
                            Array(6).fill(0).map((_, i) => (
                              <div key={i} className="h-28 bg-muted rounded-lg animate-pulse"></div>
                            ))
                          ) : (
                            // Actual menu items
                            displayItems.map((item) => (
                              <button
                                key={item.id}
                                onClick={() => setSelectedMenuItem(item.id)}
                                className={`p-3 rounded-lg border text-left transition hover:shadow-md
                                  ${selectedMenuItem === item.id 
                                    ? "border-primary bg-primary/5 ring-1 ring-primary" 
                                    : "border-border hover:border-primary/30"}`}
                              >
                                <div className="font-medium truncate">{item.name}</div>
                                <div className="flex items-center text-xs text-muted-foreground mt-1">
                                  <span className="capitalize">{item.station}</span>
                                  <span className="mx-1">•</span>
                                  <Clock className="h-3 w-3 mr-1" />
                                  <span>{Math.ceil(item.prep_seconds/60)} min</span>
                                </div>
                                <div className="font-semibold text-primary mt-2">${(item.price_cents/100).toFixed(2)}</div>
                              </button>
                            ))
                          )}
                        </div>
                        
                        {displayItems.length === 0 && !menuLoading && (
                          <div className="text-center py-8 text-muted-foreground">
                            No menu items available for this category
                          </div>
                        )}
                      </ScrollArea>
                      
                      {/* Quantity and add button - only show when item is selected */}
                      {selectedMenuItem && (
                        <div className="border-t pt-4 mt-2 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <label className="text-sm font-medium">Qty:</label>
                            <Input
                              type="number"
                              min={1}
                              max={20}
                              value={quantity}
                              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                              className="w-16 h-9"
                            />
                          </div>
                          
                          <Button
                            onClick={addToCart}
                            size="sm"
                            className="gap-1"
                          >
                            <Plus className="h-4 w-4" />
                            Add to Order
                          </Button>
                        </div>
                      )}
                    </TabsContent>
                    
                    <TabsContent value="cart" className="flex-1 overflow-hidden flex flex-col">
                      <ScrollArea className="flex-1">
                        {cart.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            No items added to order yet
                          </div>
                        ) : (
                          <div className="space-y-3 mb-4">
                            {cart.map((item, index) => (
                              <div key={index} className="flex justify-between items-center border-b pb-2">
                                <div>
                                  <span className="font-medium">{item.quantity}x</span> {item.name}
                                </div>
                                <div className="flex items-center space-x-4">
                                  <span>${((item.priceCents * item.quantity) / 100).toFixed(2)}</span>
                                  <button
                                    onClick={() => removeFromCart(index)}
                                    className="text-muted-foreground hover:text-destructive"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </ScrollArea>
                      
                      {cart.length > 0 && (
                        <div className="border-t pt-4 mt-2">
                          <div className="flex justify-between font-bold text-lg mb-4">
                            <span>Total:</span>
                            <span>${totalPrice.toFixed(2)}</span>
                          </div>
                          
                          {/* Special Instructions */}
                          <div>
                            <label className="block text-sm font-medium mb-1">Special Instructions</label>
                            <Input
                              value={specialInstructions}
                              onChange={(e) => setSpecialInstructions(e.target.value)}
                              placeholder="Any special instructions..."
                              className="w-full"
                            />
                          </div>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
            </>
          )}
        </div>
        
        <DrawerFooter className="border-t pt-4">
          <Button
            onClick={submitOrder}
            disabled={isSubmitting || !selectedBayId || cart.length === 0}
            className="bg-primary hover:bg-primary-dark text-white w-full"
          >
            {isSubmitting ? "Placing Order..." : "Place Order"}
          </Button>
          <DrawerClose asChild>
            <Button variant="outline">Cancel</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}