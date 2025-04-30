import { MenuItem } from "@shared/schema";
import { PlusCircle, Clock, ChefHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface MenuCardProps {
  item: MenuItem;
  onAddToCart: (item: MenuItem) => void;
  isSelected: boolean;
}

export default function MenuCard({ item, onAddToCart, isSelected }: MenuCardProps) {
  // Format price from cents to dollars
  const price = (item.price_cents / 100).toFixed(2);
  
  // Format prep time from seconds to minutes
  const cook = item.prep_seconds ? `${Math.ceil(item.prep_seconds / 60)} min` : '';
  
  return (
    <div 
      className={`glassmorphism rounded-xl overflow-hidden transition-all duration-300 hover:shadow-lg
                ${isSelected ? 'animate-jelly' : 'hover-lift'}`}
    >
      <div className="flex flex-col sm:flex-row">
        {item.image_url ? (
          <div className="relative w-full sm:w-32 h-32">
            <img 
              src={item.image_url} 
              className="w-full h-32 object-cover" 
              alt={item.name} 
            />
            <div className="absolute top-0 right-0 m-2">
              <Badge variant="secondary" className="shadow-md">
                {item.category}
              </Badge>
            </div>
          </div>
        ) : (
          <div className="hidden sm:flex w-32 h-32 bg-muted/50 items-center justify-center">
            <ChefHat className="h-10 w-10 text-muted-foreground/50" />
          </div>
        )}
        
        <div className="p-4 flex-1 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap justify-between items-start gap-2 mb-1">
              <h3 className="text-lg font-semibold text-foreground">{item.name}</h3>
              <div className="text-lg font-semibold text-primary">
                ${price}
              </div>
            </div>
            
            {item.description && (
              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{item.description}</p>
            )}
            
            <div className="flex items-center space-x-4 text-xs text-muted-foreground mb-3">
              <div className="flex items-center">
                <Clock className="h-3 w-3 mr-1" />
                <span>{cook}</span>
              </div>
              <div className="flex items-center">
                <ChefHat className="h-3 w-3 mr-1" />
                <span>{item.station}</span>
              </div>
            </div>
          </div>
          
          <Button 
            size="sm"
            variant="outline"
            className="btn-modern self-end group"
            onClick={() => onAddToCart(item)}
          >
            <span className="mr-2 group-hover:scale-110 transition-transform">
              <PlusCircle className="h-4 w-4" />
            </span>
            Add to Order
          </Button>
        </div>
      </div>
    </div>
  );
}