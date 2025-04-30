import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { X, ListChecks, Settings } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import ServerMenuItems from "./ServerMenuItems";
import ServerMenuCategories from "./ServerMenuCategories";
import MenuGrid from "./MenuGrid";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { CustomizationSelection, MenuItem, Category } from "@shared/schema";
import { BayStatusBadge } from "@/components/ui/bay-status-badge";
import { getItemPriceCents, formatPriceAsDollars } from "../../types/menu";

interface SimpleOrderDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bayId: number | null;
  viewExistingOrders?: boolean;
}

interface CartItem {
  menuItemId: string;
  quantity: number;
  name: string;
  priceCents: number;
  notes?: string;
  customizations?: CustomizationSelection[];
}

export default function SimpleOrderDrawer({ open, onOpenChange, bayId, viewExistingOrders = false }: SimpleOrderDrawerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [specialInstructions, setSpecialInstructions] = useState<string>("");
  const [selectedBayId, setSelectedBayId] = useState<number | null>(bayId);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  
  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setCart([]);
      setSpecialInstructions("");
      setSelectedBayId(bayId);
    }
  }, [open, bayId]);

  // Get bays for selection
  const { data: bays = [], isLoading: baysLoading } = useQuery<Array<{
    id: number;
    number: number;
    floor: number;
    status: string;
    type: string;
    displayName?: string;
  }>>({
    queryKey: ['/api/bays'],
    enabled: open && bayId === null,
  });

  // Menu data type
  type MenuDataType = Array<{
    category: Category;
    items: MenuItem[];
  }>;
  
  // Get menu data
  const { data: menuData = [], isLoading: menuLoading } = useQuery<MenuDataType>({
    queryKey: ['/api/menu'],
    enabled: open
  });

  // Debug log when component renders with menu data
  useEffect(() => {
    if (menuData && menuData.length > 0) {
      console.log('Menu data loaded:', menuData);
    }
  }, [menuData]);

  // Extract categories and menu items from data
  const categories = menuData ? menuData.map(item => item.category) : [];
  const menuItems = menuData ? menuData.flatMap(category => category.items) : [];

  // Handle adding an item to the cart
  const handleAddToCart = (item: {
    menuItemId: string;
    name: string;
    priceCents: number;
    quantity: number;
    notes?: string;
    customizations?: CustomizationSelection[];
  }) => {
    // Check if item already exists in cart - for exact match including customizations
    // If customizations are different, treat as a new item
    const existingItemIndex = cart.findIndex(cartItem => {
      // If customizations exist on either but not both, they're different
      const hasCustomizations = Boolean(item.customizations?.length);
      const cartHasCustomizations = Boolean(cartItem.customizations?.length);
      
      if (hasCustomizations !== cartHasCustomizations) return false;
      if (cartItem.menuItemId !== item.menuItemId) return false;
      
      // If no customizations on either, check only the ID
      if (!hasCustomizations) return true;
      
      // Otherwise, compare customizations in detail
      if (!item.customizations || !cartItem.customizations) return false;
      
      // Compare customizations (this is simplified - might need deeper comparison)
      return JSON.stringify(item.customizations) === JSON.stringify(cartItem.customizations);
    });
    
    if (existingItemIndex >= 0) {
      // Update quantity if item already exists
      const newCart = [...cart];
      newCart[existingItemIndex].quantity += item.quantity;
      setCart(newCart);
    } else {
      // Add new item to cart
      setCart([...cart, {
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        name: item.name,
        priceCents: item.priceCents,
        notes: item.notes,
        customizations: item.customizations
      }]);
    }
    
    // Generate description with customization info if it exists
    let description = `${item.quantity}x ${item.name}`;
    if (item.customizations && item.customizations.length > 0) {
      description += " (customized)";
    }
    
    toast({
      title: "Added to order",
      description,
    });
  };
  
  // Remove item from cart
  const removeFromCart = (index: number) => {
    const newCart = [...cart];
    newCart.splice(index, 1);
    setCart(newCart);
  };
  
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
      // Prepare order with customizations
      const payload = {
        order: {
          bayId: selectedBayId,
          specialInstructions: specialInstructions
        },
        cart: {
          items: cart.map(item => ({
            menuItemId: item.menuItemId,
            quantity: Number(item.quantity),
            notes: item.notes || undefined,
            customizations: item.customizations || undefined
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
        
        // Close dialog
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

  // Get existing orders for this bay if viewExistingOrders is true
  const { data: bayOrders = [], isLoading: ordersLoading } = useQuery<any[]>({
    queryKey: ['/api/bay', selectedBayId, 'orders'],
    queryFn: async () => {
      const response = await fetch(`/api/bay/${selectedBayId}/orders`);
      if (!response.ok) {
        throw new Error('Failed to fetch bay orders');
      }
      return response.json();
    },
    enabled: open && viewExistingOrders && selectedBayId !== null,
  });
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader>
          <DialogTitle className="text-xl text-primary">
            {viewExistingOrders 
              ? `Bay ${selectedBayId} - Active Orders` 
              : selectedBayId 
                ? `New Order - Bay ${selectedBayId}` 
                : 'New Order'}
          </DialogTitle>
          <DialogDescription>
            {viewExistingOrders
              ? "View and manage existing orders for this bay"
              : "Build your order by selecting items from the menu below"}
          </DialogDescription>
        </DialogHeader>

        {/* Main content */}
        <div className="space-y-6">
          {viewExistingOrders ? (
            <div>
              {ordersLoading ? (
                <div className="space-y-4">
                  <div className="h-16 bg-muted rounded animate-pulse" />
                  <div className="h-16 bg-muted rounded animate-pulse" />
                  <div className="h-16 bg-muted rounded animate-pulse" />
                </div>
              ) : bayOrders.length === 0 ? (
                <div className="text-center py-12 bg-muted/20 rounded-lg">
                  <div className="text-lg font-semibold mb-2">No Active Orders</div>
                  <p className="text-muted-foreground">There are no active orders for this bay</p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => onOpenChange(false)}
                  >
                    Close
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  {bayOrders.map((order: any) => (
                    <div key={order.id} className="border rounded-lg p-4 shadow-sm">
                      <div className="flex justify-between items-center mb-3">
                        <div>
                          <div className="font-semibold text-lg">Order #{order.id.substring(0, 8)}</div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(order.createdAt).toLocaleString()}
                          </div>
                        </div>
                        <BayStatusBadge status={order.status} />
                      </div>
                      
                      {order.items && (
                        <div className="space-y-3 mt-4">
                          {order.items.map((item: any) => (
                            <div key={item.id} className="flex justify-between items-center border-b pb-2">
                              <div>
                                <div className="font-medium">{item.quantity}x {item.menuItem?.name || item.menuItemId}</div>
                                
                                {/* Show customizations if any */}
                                {item.customizations && item.customizations.length > 0 && (
                                  <div className="text-xs text-gray-600 mt-1">
                                    {item.customizations.map((customization: any, custIndex: number) => (
                                      <div key={custIndex} className="ml-4">
                                        <span className="font-medium">{customization.categoryName}:</span> {' '}
                                        <span>{customization.options.map((opt: any) => opt.name).join(', ')}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                
                                {/* Show notes if any */}
                                {item.notes && (
                                  <div className="text-xs italic text-gray-500 ml-4 mt-1">
                                    Note: {item.notes}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center">
                                <BayStatusBadge status={item.status || 'new'} />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      <div className="mt-4 flex justify-end gap-2">
                        <Button 
                          variant="outline"
                          size="sm"
                          onClick={() => onOpenChange(false)}
                        >
                          Close
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Bay Selection (only if no bayId was provided) */}
              {!bayId && (
                <div>
                  <label className="block text-sm font-medium mb-1">Select Bay</label>
                  <Select 
                    value={selectedBayId?.toString() || ""} 
                    onValueChange={(value) => setSelectedBayId(parseInt(value))}
                    disabled={baysLoading}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a bay" />
                    </SelectTrigger>
                    <SelectContent>
                      {bays.map((bay) => {
                        // Get display text based on seating type
                        let displayText = "";
                        if (bay.type === "BAY") {
                          displayText = `Bay ${bay.number} (Floor ${bay.floor})`;
                        } else if (bay.type === "BAR_LEFT") {
                          displayText = `Bar Left ${bay.number % 100} (Floor ${bay.floor})`;
                        } else if (bay.type === "BAR_RIGHT") {
                          displayText = `Bar Right ${bay.number % 100} (Floor ${bay.floor})`;
                        } else if (bay.type === "TABLE") {
                          displayText = `Table ${bay.number % 100} (Floor ${bay.floor})`;
                        }
                        
                        // Use displayName if available
                        const label = bay.displayName || displayText;
                        
                        return (
                          <SelectItem key={bay.id} value={bay.id.toString()}>
                            {label}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              {/* Menu section - show only if bay is selected */}
              {selectedBayId && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Menu with search and customization - 2/3 of the space */}
                  <div className="md:col-span-2">
                    <h3 className="font-medium text-base mb-3">Menu</h3>
                    {menuLoading ? (
                      <div className="space-y-2">
                        <div className="h-8 bg-muted rounded animate-pulse w-full" />
                        <div className="grid grid-cols-2 gap-2">
                          {[1, 2, 3, 4].map(i => (
                            <div key={i} className="h-24 bg-muted rounded animate-pulse" />
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="h-[500px] overflow-y-auto pr-2">
                        {categories && categories.length > 0 && (
                          <ServerMenuCategories
                            categories={categories}
                            activeCategory={activeCategory}
                            setActiveCategory={setActiveCategory}
                          />
                        )}
                        <ServerMenuItems 
                          menuData={activeCategory === "all" 
                            ? menuData 
                            : menuData.filter(group => group.category.slug === activeCategory)
                          } 
                          onAddToCart={handleAddToCart}
                        />
                      </div>
                    )}
                  </div>
                  
                  {/* Order Summary - 1/3 of the space */}
                  <div className="border-l pl-4 md:pl-6">
                    <h3 className="font-medium text-base mb-3">Order Summary</h3>
                    
                    {cart.length === 0 ? (
                      <div className="text-center py-6 bg-muted/20 rounded-lg text-muted-foreground">
                        No items added to order yet
                      </div>
                    ) : (
                      <div>
                        <div className="space-y-4 mb-4 max-h-[300px] overflow-y-auto pr-2">
                          {cart.map((item, index) => (
                            <div key={index} className="border-b pb-3">
                              <div className="flex justify-between items-center">
                                <div className="pr-2">
                                  <span className="font-medium">{item.quantity}x</span> {item.name}
                                </div>
                                <div className="flex items-center gap-3 flex-shrink-0">
                                  <span>${formatPriceAsDollars(item.priceCents * item.quantity)}</span>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                    onClick={() => removeFromCart(index)}
                                  >
                                    <X size={16} />
                                  </Button>
                                </div>
                              </div>
                              
                              {/* Show customizations if any */}
                              {item.customizations && item.customizations.length > 0 && (
                                <div className="mt-1 pl-6 text-xs text-gray-600">
                                  {item.customizations.map((customization, custIndex) => (
                                    <div key={custIndex} className="mt-1">
                                      <span className="font-medium">{customization.categoryName}:</span>
                                      <span className="ml-1">
                                        {customization.options.map(opt => opt.name).join(', ')}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              
                              {/* Show item notes if any */}
                              {item.notes && (
                                <div className="mt-1 pl-6 text-xs italic text-gray-500">
                                  Note: {item.notes}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        
                        <div className="flex justify-between font-bold text-lg mb-4 border-t border-primary/20 pt-2">
                          <span>Total:</span>
                          <span>${formatPriceAsDollars(cart.reduce((sum, item) => sum + (item.priceCents * item.quantity), 0))}</span>
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
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        
        {/* Only show footer with Place Order button if not viewing existing orders */}
        {!viewExistingOrders && (
          <DialogFooter>
            <Button
              onClick={submitOrder}
              disabled={isSubmitting || !selectedBayId || cart.length === 0}
              className="w-full"
            >
              {isSubmitting ? "Placing Order..." : "Place Order"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}