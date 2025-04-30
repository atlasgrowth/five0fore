import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Bay, Category, MenuItem, Cart } from "@shared/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ServerOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ServerOrderDialog({ open, onOpenChange }: ServerOrderDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedBay, setSelectedBay] = useState<number | null>(null);
  const [selectedTab, setSelectedTab] = useState<string>("all");
  const [cart, setCart] = useState<Cart>({
    items: [],
    specialInstructions: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Fetch bays
  const { data: bays = [], isLoading: baysLoading } = useQuery<Bay[]>({
    queryKey: ['/api/bays'],
  });
  
  // Fetch categories
  const { data: categories = [], isLoading: categoriesLoading } = useQuery<Category[]>({
    queryKey: ['/api/menu'],
  });
  
  // Fetch menu items based on selected category
  const endpoint = selectedTab === "all" ? "/api/menu" : `/api/menu/${selectedTab}`;
  const { data: menuData = [], isLoading: menuLoading } = useQuery<Array<{
    category: Category;
    items: MenuItem[];
  }>>({
    queryKey: [endpoint],
  });

  // Reset cart when dialog closes
  useEffect(() => {
    if (!open) {
      setCart({
        items: [],
        specialInstructions: ""
      });
      setSelectedBay(null);
    }
  }, [open]);
  
  // Add item to cart
  const addToCart = (item: { menuItemId: string; name: string; priceCents: number; quantity: number; station?: string }) => {
    // Make sure priceCents is always included
    const cartItem = {
      ...item,
      priceCents: item.priceCents || 0 // Ensure priceCents has a value
    };
    
    setCart(prevCart => {
      const existingItem = prevCart.items.find(i => i.menuItemId === cartItem.menuItemId);
      
      if (existingItem) {
        return {
          ...prevCart,
          items: prevCart.items.map(i => 
            i.menuItemId === cartItem.menuItemId 
              ? { ...i, quantity: i.quantity + cartItem.quantity } 
              : i
          )
        };
      } else {
        return {
          ...prevCart,
          items: [...prevCart.items, cartItem]
        };
      }
    });
    
    console.log('Added item to cart:', cartItem);
  };
  
  // Remove item from cart
  const removeFromCart = (menuItemId: string) => {
    setCart(prevCart => ({
      ...prevCart,
      items: prevCart.items.filter(item => item.menuItemId !== menuItemId)
    }));
  };
  
  // Update item quantity
  const updateQuantity = (menuItemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(menuItemId);
      return;
    }
    
    setCart(prevCart => ({
      ...prevCart,
      items: prevCart.items.map(item => 
        item.menuItemId === menuItemId 
          ? { ...item, quantity } 
          : item
      )
    }));
  };
  
  // Update special instructions
  const updateSpecialInstructions = (instructions: string) => {
    setCart(prevCart => ({
      ...prevCart,
      specialInstructions: instructions
    }));
  };
  
  // Calculate total
  const totalPrice = cart.items.reduce((sum, item) => sum + (item.priceCents * item.quantity), 0);
  const totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0);
  
  // Format price from cents to dollars
  const formatPrice = (price: number) => {
    return `$${(price / 100).toFixed(2)}`;
  };
  
  // Place order
  const placeOrder = async () => {
    if (!selectedBay) {
      toast({
        title: "Bay Required",
        description: "Please select a bay for this order.",
        variant: "destructive",
      });
      return;
    }
    
    if (cart.items.length === 0) {
      toast({
        title: "Empty Order",
        description: "Please add items to the order.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      // Get bay by number
      const bayData = bays.find(bay => bay.number === selectedBay);
      
      if (!bayData) {
        throw new Error(`Bay ${selectedBay} not found`);
      }
      
      // Create order
      const orderData = {
        order: {
          orderNumber: "", // Will be generated server-side
          bayId: bayData.id,
          status: "pending",
          orderType: "server",
          specialInstructions: cart.specialInstructions || "",
        },
        cart
      };
      
      const response = await apiRequest('POST', '/api/orders', orderData);
      const newOrder = await response.json();
      
      // Reset form and close dialog
      setCart({
        items: [],
        specialInstructions: ""
      });
      setSelectedBay(null);
      onOpenChange(false);
      
      // Invalidate orders query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      
      toast({
        title: "Order Placed",
        description: `Order #${newOrder.id || 'unknown'} has been placed successfully!`,
      });
    } catch (error) {
      console.error("Failed to place order:", error);
      toast({
        title: "Order Failed",
        description: "There was an error placing the order. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-xl w-[90%] max-w-4xl h-[80vh] flex flex-col p-6 overflow-hidden relative shadow-2xl">
        <button 
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 transition-colors rounded-full hover:bg-gray-100 p-1"
          onClick={() => onOpenChange(false)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
        
        <div className="mb-5 border-b pb-3">
          <h2 className="text-2xl font-semibold text-primary">Create New Order</h2>
        </div>
        
        <div className="flex flex-1 gap-6 overflow-hidden">
          {/* Left side - Menu */}
          <div className="w-2/3 overflow-y-auto pr-4">
            <div className="mb-5 bg-neutral-50 p-4 rounded-lg border border-neutral-100">
              <label className="block text-sm font-medium text-neutral-700 mb-2 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 text-primary">
                  <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z"></path>
                </svg>
                Select Bay
              </label>
              <Select value={selectedBay?.toString()} onValueChange={(value) => setSelectedBay(Number(value))}>
                <SelectTrigger className="border-neutral-200 bg-white focus:ring-2 focus:ring-primary/20">
                  <SelectValue placeholder="Select a bay" />
                </SelectTrigger>
                <SelectContent>
                  {baysLoading ? (
                    <SelectItem value="loading">Loading...</SelectItem>
                  ) : (
                    bays.map((bay) => (
                      <SelectItem key={bay.id} value={bay.number.toString()}>
                        Bay {bay.number} (Floor {bay.floor})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            
            <Tabs defaultValue="menu" className="mt-4">
              <TabsList className="w-full grid grid-cols-2 mb-2">
                <TabsTrigger value="menu" className="text-base py-2 data-[state=active]:bg-primary data-[state=active]:text-white">Menu</TabsTrigger>
                <TabsTrigger value="specials" className="text-base py-2 data-[state=active]:bg-primary data-[state=active]:text-white">Daily Specials</TabsTrigger>
              </TabsList>
              
              <TabsContent value="menu" className="pt-4">
                {categoriesLoading ? (
                  <div className="flex items-center justify-center h-20">
                    <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
                    <span className="ml-2 text-neutral-600">Loading categories...</span>
                  </div>
                ) : (
                  <div className="mb-6">
                    <div className="flex overflow-x-auto pb-3 space-x-2 no-scrollbar">
                      <button 
                        key="all-items"
                        className={`px-4 py-2 rounded-full whitespace-nowrap transition-all duration-200 ${
                          selectedTab === "all" 
                            ? "bg-primary text-white shadow-md" 
                            : "bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                        }`}
                        onClick={() => setSelectedTab("all")}
                      >
                        All Items
                      </button>
                      
                      {categories.map((category) => (
                        <button
                          key={category.id}
                          className={`px-4 py-2 rounded-full whitespace-nowrap transition-all duration-200 ${
                            selectedTab === category.slug 
                              ? "bg-primary text-white shadow-md" 
                              : "bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                          }`}
                          onClick={() => setSelectedTab(category.slug)}
                        >
                          {category.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                {menuLoading ? (
                  <div className="flex items-center justify-center h-40">
                    <div className="animate-spin h-8 w-8 border-3 border-primary border-t-transparent rounded-full"></div>
                    <span className="ml-3 text-neutral-600">Loading menu items...</span>
                  </div>
                ) : (
                  <div className="space-y-8 mb-8">
                    {selectedTab === "all" ? (
                      // Display items grouped by category
                      menuData.map((categoryGroup) => (
                        <div key={categoryGroup.category.id} className="space-y-4">
                          <h3 className="text-lg font-semibold text-primary border-b pb-2 mb-3">
                            {categoryGroup.category.name}
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {categoryGroup.items.map((item) => (
                              <div key={item.id} className="flex border border-neutral-200 rounded-lg overflow-hidden shadow-sm h-full hover:shadow-md transition-shadow duration-200 bg-white">
                                {item.image_url && (
                                  <img src={item.image_url} className="w-28 h-full object-cover" alt={item.name} />
                                )}
                                <div className="p-4 flex-1 flex flex-col">
                                  <div className="flex justify-between items-start mb-1">
                                    <h3 className="font-medium text-neutral-800 leading-tight">{item.name}</h3>
                                    <span className="font-semibold text-primary ml-2">{formatPrice(item.priceCents)}</span>
                                  </div>
                                  <p className="text-sm text-neutral-600 mb-3 flex-grow line-clamp-2">{item.description}</p>
                                  <div className="flex justify-between items-center mt-auto">
                                    <span className="text-xs flex items-center text-neutral-500">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                                        <circle cx="12" cy="12" r="10"></circle>
                                        <polyline points="12 6 12 12 16 14"></polyline>
                                      </svg>
                                      {Math.ceil(item.prepSeconds / 60)} min
                                    </span>
                                    <Button 
                                      size="sm"
                                      variant="outline"
                                      className="px-3 py-1 border-primary text-primary hover:bg-primary hover:text-white transition-colors"
                                      onClick={() => addToCart({
                                        menuItemId: item.id,
                                        name: item.name,
                                        priceCents: item.priceCents,
                                        quantity: 1
                                      })}
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 mr-1">
                                        <line x1="12" y1="5" x2="12" y2="19"></line>
                                        <line x1="5" y1="12" x2="19" y2="12"></line>
                                      </svg>
                                      Add
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    ) : (
                      // Display items for the selected category
                      <div>
                        {/* Selected category header */}
                        {(() => {
                          const categoryObject = menuData.find(cat => cat.category.slug === selectedTab);
                          return categoryObject ? (
                            <h3 className="text-lg font-semibold text-primary border-b pb-2 mb-3">
                              {categoryObject.category.name}
                            </h3>
                          ) : null;
                        })()}
                        
                        {/* Items grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {menuData.flatMap(category => 
                            category.category.slug === selectedTab ? category.items : []
                          ).map((item) => (
                            <div key={item.id} className="flex border border-neutral-200 rounded-lg overflow-hidden shadow-sm h-full hover:shadow-md transition-shadow duration-200 bg-white">
                              {item.image_url && (
                                <img src={item.image_url} className="w-28 h-full object-cover" alt={item.name} />
                              )}
                              <div className="p-4 flex-1 flex flex-col">
                                <div className="flex justify-between items-start mb-1">
                                  <h3 className="font-medium text-neutral-800 leading-tight">{item.name}</h3>
                                  <span className="font-semibold text-primary ml-2">{formatPrice(item.priceCents)}</span>
                                </div>
                                <p className="text-sm text-neutral-600 mb-3 flex-grow line-clamp-2">{item.description}</p>
                                <div className="flex justify-between items-center mt-auto">
                                  <span className="text-xs flex items-center text-neutral-500">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                                      <circle cx="12" cy="12" r="10"></circle>
                                      <polyline points="12 6 12 12 16 14"></polyline>
                                    </svg>
                                    {Math.ceil(item.prepSeconds / 60)} min
                                  </span>
                                  <Button 
                                    size="sm"
                                    variant="outline"
                                    className="px-3 py-1 border-primary text-primary hover:bg-primary hover:text-white transition-colors"
                                    onClick={() => addToCart({
                                      menuItemId: item.id,
                                      name: item.name,
                                      priceCents: item.priceCents,
                                      quantity: 1
                                    })}
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 mr-1">
                                      <line x1="12" y1="5" x2="12" y2="19"></line>
                                      <line x1="5" y1="12" x2="19" y2="12"></line>
                                    </svg>
                                    Add
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="specials" className="pt-4">
                <div className="p-4 bg-neutral-100 rounded-md text-center">
                  <p>Daily specials will be displayed here.</p>
                </div>
              </TabsContent>
            </Tabs>
          </div>
          
          {/* Right side - Cart */}
          <div className="w-1/3 bg-neutral-50 p-5 rounded-lg overflow-y-auto border border-neutral-100 shadow-inner">
            <h3 className="font-semibold text-lg mb-4 flex items-center text-primary">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                <circle cx="9" cy="21" r="1"></circle>
                <circle cx="20" cy="21" r="1"></circle>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
              </svg>
              Order Summary
            </h3>
            
            {cart.items.length === 0 ? (
              <div className="text-center py-10 text-neutral-500 bg-white rounded-lg border border-dashed border-neutral-200">
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2 text-neutral-300">
                  <circle cx="9" cy="21" r="1"></circle>
                  <circle cx="20" cy="21" r="1"></circle>
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                </svg>
                <p>No items in cart</p>
                <p className="text-xs mt-1">Add menu items to begin</p>
              </div>
            ) : (
              <div className="space-y-3 mb-4">
                {cart.items.map((item) => (
                  <div key={item.menuItemId} className="flex justify-between border-b pb-3 mb-2">
                    <div>
                      <p className="font-medium text-neutral-800">{item.name}</p>
                      <p className="text-sm text-neutral-500">{formatPrice(item.priceCents)} each</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button 
                        className="w-8 h-8 flex items-center justify-center bg-white border border-neutral-200 rounded-full text-neutral-700 hover:bg-neutral-100 transition-colors"
                        onClick={() => updateQuantity(item.menuItemId, item.quantity - 1)}
                        aria-label="Decrease quantity"
                      >
                        -
                      </button>
                      <span className="w-8 text-center font-medium">{item.quantity}</span>
                      <button 
                        className="w-8 h-8 flex items-center justify-center bg-white border border-neutral-200 rounded-full text-neutral-700 hover:bg-neutral-100 transition-colors"
                        onClick={() => updateQuantity(item.menuItemId, item.quantity + 1)}
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-neutral-700 mb-2 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
                Special Instructions
              </label>
              <Textarea 
                placeholder="Any special requests or allergies?"
                value={cart.specialInstructions || ""}
                onChange={(e) => updateSpecialInstructions(e.target.value)}
                className="w-full border-neutral-200 focus:border-primary focus:ring focus:ring-primary/20"
                rows={3}
              />
            </div>
            
            <div className="border-t pt-4 mt-auto">
              <div className="flex justify-between mb-2 text-neutral-700">
                <span>Items:</span>
                <span className="font-medium">{totalItems}</span>
              </div>
              <div className="flex justify-between font-bold text-xl text-primary">
                <span>Total:</span>
                <span>{formatPrice(totalPrice)}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-5 pt-4 border-t flex justify-end space-x-4">
          <button 
            className="px-5 py-2.5 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors text-neutral-700 font-medium"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </button>
          <button 
            className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            onClick={placeOrder}
            disabled={isSubmitting || cart.items.length === 0 || !selectedBay}
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Placing Order...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                  <path d="M9 11l3 3L22 4"></path>
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                </svg>
                Place Order
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}