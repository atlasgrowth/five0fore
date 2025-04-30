import { useState } from "react";
import { useOrder } from "@/contexts/OrderContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ShoppingCart, Trash2, Minus, Plus, Info, Receipt, Send, Utensils } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface OrderSummaryProps {
  bayNumber: number;
}

export default function OrderSummary({ bayNumber }: OrderSummaryProps) {
  const { cart, totalItems, totalPrice, updateQuantity, removeFromCart, updateSpecialInstructions, clearCart } = useOrder();
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  
  // Format price from cents to dollars
  const formatPrice = (price: number) => {
    return `$${(price / 100).toFixed(2)}`;
  };
  
  const placeOrder = async () => {
    try {
      setIsSubmitting(true);
      
      // Get bay ID from bay number
      const bayResponse = await fetch(`/api/bay/${bayNumber}`);
      const bay = await bayResponse.json();
      
      if (!bay || !bay.id) {
        throw new Error(`Bay ${bayNumber} not found`);
      }
      
      // Create order
      const orderData = {
        order: {
          orderNumber: "", // Will be generated server-side
          bayId: bay.id,
          status: "pending",
          orderType: "customer",
          specialInstructions: cart.specialInstructions || "",
        },
        cart
      };
      
      const response = await apiRequest('POST', '/api/orders', orderData);
      const newOrder = await response.json();
      
      clearCart();
      setOrderDialogOpen(false);
      
      // Use order's formatted ID (first 6 characters) if orderNumber is not available
      const orderDisplayNumber = newOrder.orderNumber || (newOrder.id ? `#${newOrder.id.substring(0, 6)}` : 'unknown');
      toast({
        title: "Order Placed",
        description: `Your order ${orderDisplayNumber} has been placed successfully!`,
      });
    } catch (error) {
      console.error("Failed to place order:", error);
      toast({
        title: "Order Failed",
        description: "There was an error placing your order. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="relative">
      <div className="absolute -top-16 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent pointer-events-none"></div>
      
      <div className="bg-white glassmorphism rounded-t-xl border-t border-t-white/30 shadow-lg px-5 pt-5 pb-6 mt-4">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center">
            <ShoppingCart className="w-5 h-5 mr-2 text-primary" />
            <h2 className="font-semibold text-lg">Your Order</h2>
            {totalItems > 0 && (
              <Badge variant="secondary" className="ml-2 animate-pulse-subtle">
                {totalItems} item{totalItems !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          
          <Dialog open={orderDialogOpen} onOpenChange={setOrderDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-primary hover:text-primary/80 hover:bg-primary/10"
                disabled={totalItems === 0}
              >
                <Receipt className="w-4 h-4 mr-1" />
                Details
              </Button>
            </DialogTrigger>
            
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center text-xl">
                  <ShoppingCart className="w-5 h-5 mr-2 text-primary" />
                  Order Summary
                </DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4 mt-4 max-h-[60vh] overflow-y-auto pr-1">
                {cart.items.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground flex flex-col items-center">
                    <Utensils className="w-12 h-12 mb-2 text-muted" />
                    <p>Your cart is empty</p>
                    <p className="text-sm mt-1">Add some delicious items to get started</p>
                  </div>
                ) : (
                  cart.items.map((item) => (
                    <div 
                      key={item.menuItemId} 
                      className="flex justify-between items-center p-3 rounded-lg hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex-1 mr-4">
                        <h3 className="font-medium">{item.name}</h3>
                        <p className="text-sm text-muted-foreground">{formatPrice(item.priceCents || 0)} each</p>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="h-7 w-7 rounded-full"
                          onClick={() => updateQuantity(item.menuItemId, item.quantity - 1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        
                        <span className="w-5 text-center">{item.quantity}</span>
                        
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="h-7 w-7 rounded-full"
                          onClick={() => updateQuantity(item.menuItemId, item.quantity + 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => removeFromCart(item.menuItemId)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
                
                <div className="space-y-1 pt-2">
                  <div className="flex items-center text-sm font-medium">
                    <Info className="w-4 h-4 mr-1 text-muted-foreground" />
                    <label className="text-muted-foreground">
                      Special Instructions
                    </label>
                  </div>
                  
                  <Textarea 
                    placeholder="Allergies, preferences, or special requests"
                    value={cart.specialInstructions || ""}
                    onChange={(e) => updateSpecialInstructions(e.target.value)}
                    className="w-full bg-muted/30 border-muted transition-all focus:ring-1 focus:ring-primary/50"
                    rows={3}
                  />
                </div>
                
                <div className="flex justify-between items-center font-medium text-lg pt-4 border-t">
                  <span>Total:</span>
                  <span className="text-primary font-bold">{formatPrice(totalPrice)}</span>
                </div>
              </div>
              
              <DialogFooter className="sm:justify-between gap-3 mt-2">
                <Button 
                  variant="outline" 
                  onClick={() => setOrderDialogOpen(false)}
                  className="sm:w-1/2"
                >
                  Continue Shopping
                </Button>
                
                <Button 
                  className="sm:w-1/2 bg-primary hover:bg-primary/90 group" 
                  onClick={placeOrder}
                  disabled={isSubmitting || totalItems === 0}
                >
                  {isSubmitting ? (
                    <div className="flex items-center">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Processing...
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <Send className="mr-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                      Confirm Order
                    </div>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        
        <div className="flex justify-between items-center p-3 mb-5 bg-muted/30 rounded-lg">
          <div className="flex flex-col">
            <span className="text-sm text-muted-foreground">Total Price</span>
            <span className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
              {formatPrice(totalPrice)}
            </span>
          </div>
          
          <div className="flex flex-col items-end">
            <span className="text-sm text-muted-foreground">Bay</span>
            <span className="font-medium">{bayNumber}</span>
          </div>
        </div>
        
        <Button 
          className="w-full py-6 bg-primary hover:bg-primary/90 rounded-xl btn-modern group"
          disabled={totalItems === 0 || isSubmitting}
          onClick={placeOrder}
        >
          {isSubmitting ? (
            <div className="flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
              Processing...
            </div>
          ) : (
            <div className="flex items-center justify-center">
              <Send className="mr-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              {totalItems === 0 ? "Add items to order" : "Place Order"}
            </div>
          )}
        </Button>
      </div>
    </div>
  );
}
