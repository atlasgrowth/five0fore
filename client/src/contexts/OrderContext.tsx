import React, { createContext, useContext, useState, ReactNode } from 'react';
import { type Cart, type CartItem } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';

interface OrderContextType {
  cart: Cart;
  addToCart: (item: CartItem) => void;
  removeFromCart: (menuItemId: string) => void;
  updateQuantity: (menuItemId: string, quantity: number) => void;
  clearCart: () => void;
  updateSpecialInstructions: (instructions: string) => void;
  totalItems: number;
  totalPrice: number;
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

export const OrderProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<Cart>({ items: [] });
  const { toast } = useToast();

  const addToCart = (item: CartItem) => {
    setCart(prevCart => {
      const existingItem = prevCart.items.find(i => i.menuItemId === item.menuItemId);
      
      if (existingItem) {
        // Update existing item quantity
        const updatedItems = prevCart.items.map(i => 
          i.menuItemId === item.menuItemId 
            ? { ...i, quantity: i.quantity + item.quantity } 
            : i
        );
        
        toast({
          title: "Item updated",
          description: `${item.name} quantity updated in your order.`,
        });
        
        return { 
          ...prevCart, 
          items: updatedItems 
        };
      } else {
        // Add new item
        toast({
          title: "Item added",
          description: `${item.name} added to your order.`,
        });
        
        return { 
          ...prevCart, 
          items: [...prevCart.items, item] 
        };
      }
    });
  };

  const removeFromCart = (menuItemId: string) => {
    setCart(prevCart => {
      const item = prevCart.items.find(i => i.menuItemId === menuItemId);
      
      if (item) {
        toast({
          title: "Item removed",
          description: `${item.name} removed from your order.`,
        });
      }
      
      return { 
        ...prevCart, 
        items: prevCart.items.filter(item => item.menuItemId !== menuItemId)
      };
    });
  };

  const updateQuantity = (menuItemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(menuItemId);
      return;
    }
    
    setCart(prevCart => {
      const updatedItems = prevCart.items.map(item => 
        item.menuItemId === menuItemId 
          ? { ...item, quantity } 
          : item
      );
      
      return { 
        ...prevCart, 
        items: updatedItems 
      };
    });
  };

  const clearCart = () => {
    setCart({ items: [] });
    
    toast({
      title: "Cart cleared",
      description: "All items have been removed from your order.",
    });
  };

  const updateSpecialInstructions = (instructions: string) => {
    setCart(prevCart => ({
      ...prevCart,
      specialInstructions: instructions
    }));
  };

  // Calculate total items and price
  const totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.items.reduce((sum, item) => sum + (item.priceCents * item.quantity), 0);

  return (
    <OrderContext.Provider value={{
      cart,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      updateSpecialInstructions,
      totalItems,
      totalPrice
    }}>
      {children}
    </OrderContext.Provider>
  );
};

export const useOrder = (): OrderContextType => {
  const context = useContext(OrderContext);
  if (context === undefined) {
    throw new Error('useOrder must be used within an OrderProvider');
  }
  return context;
};
