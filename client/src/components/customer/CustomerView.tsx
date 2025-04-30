import { Link, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import MenuCategories from "./MenuCategories";
import MenuItems from "./MenuItems";
import OrderSummary from "./OrderSummary";
import { useWebSocket } from "@/hooks/use-websocket";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Utensils, Trophy } from "lucide-react";
import golfLogo from "@/assets/golf-logo.svg";

interface CustomerViewProps {
  bayNumber: number;
}

export default function CustomerView({ bayNumber }: CustomerViewProps) {
  const { toast } = useToast();
  const { lastMessage } = useWebSocket(bayNumber);
  const [selectedCategory, setSelectedCategory] = useState("");
  
  const { data: bay, isLoading: bayLoading } = useQuery<{
    id: number;
    number: number;
    floor: number;
    status: string;
  }>({
    queryKey: [`/api/bay/${bayNumber}`],
  });

  // Get menu
  const { data: menu = [], isLoading: menuLoading } = useQuery<Array<{
    category: {
      id: number;
      name: string;
      slug: string;
    };
    items: Array<{
      id: string;
      name: string;
      description: string | null;
      category: string;
      price_cents: number;
      station: string;
      prep_seconds: number;
      image_url: string | null;
      active: boolean;
    }>;
  }>>({
    queryKey: ['/api/menu'],
  });

  // Handle WebSocket messages
  useEffect(() => {
    if (lastMessage?.type === 'orderStatusUpdate') {
      toast({
        title: 'Order Status Updated',
        description: `Your order is now ${lastMessage.data.status}`,
        variant: 'default',
      });
    }
  }, [lastMessage, toast]);

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* Fixed Header */}
      <header className="sticky top-0 z-20 glassmorphism shadow-sm px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center">
            <div className="mr-3 bg-primary/10 p-2 rounded-full">
              <img src={golfLogo} alt="SwingEats Logo" className="w-6 h-6" />
            </div>
            <h1 className="font-bold text-xl text-primary">
              Five O Four Golf
            </h1>
          </div>
          
          <div className="flex items-center bg-muted/40 px-3 py-1 rounded-full">
            <MapPin className="h-4 w-4 text-primary mr-1" />
            {bayLoading ? (
              <Skeleton className="h-5 w-16" />
            ) : (
              <span className="text-sm font-medium">Bay {bayNumber} • Floor {bay?.floor}</span>
            )}
          </div>
        </div>
      </header>
      
      <main className="max-w-md mx-auto px-4 pt-5 pb-32">
        {/* Banner */}
        <div className="relative mb-6 overflow-hidden rounded-xl">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/90 to-secondary/90 z-0"></div>
          <div className="relative z-10 p-4 text-white">
            <div className="flex items-start">
              <div className="flex-1">
                <h2 className="text-xl font-bold mb-1">Golf Course Dining</h2>
                <p className="text-sm text-white/90">
                  Order delicious food right to your bay
                </p>
              </div>
              <div className="p-2 bg-white/20 backdrop-blur-sm rounded-full">
                <Trophy className="h-8 w-8" />
              </div>
            </div>
          </div>
        </div>
        
        {/* Menu Categories */}
        {menuLoading ? (
          <div className="mb-6 animate-pulse">
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
        ) : (
          <div className="mb-6">
            <MenuCategories 
              categories={menu?.map(item => item.category) || []} 
              selected={selectedCategory}
              onChange={setSelectedCategory}
            />
          </div>
        )}
        
        {/* Menu Items */}
        {menuLoading ? (
          <div className="space-y-6 mb-8">
            {Array(3).fill(0).map((_, index) => (
              <div key={index} className="animate-pulse">
                <div className="flex flex-col sm:flex-row rounded-xl overflow-hidden bg-muted/30">
                  <div className="w-full sm:w-32 h-32 bg-muted"></div>
                  <div className="p-4 flex-1">
                    <div className="h-6 bg-muted rounded w-3/4 mb-2"></div>
                    <div className="h-4 bg-muted/60 rounded w-1/4 mb-3"></div>
                    <div className="h-4 bg-muted/60 rounded w-full mb-2"></div>
                    <div className="h-4 bg-muted/60 rounded w-5/6"></div>
                    <div className="flex justify-end mt-4">
                      <div className="h-8 bg-muted/80 rounded-full w-28"></div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <MenuItems menuData={menu || []} selectedCat={selectedCategory} />
        )}
      </main>
      
      {/* Fixed Order Summary at bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-10">
        <div className="max-w-md mx-auto">
          <OrderSummary bayNumber={bayNumber} />
        </div>
      </div>
    </div>
  );
}
