import { useState } from "react";
import { cn } from "@/lib/utils";
import { Category } from "@shared/schema";
import { motion } from "framer-motion";
import { GaugeCircle, Pizza, Coffee, Beef, Salad, UtensilsCrossed } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface MenuCategoriesProps {
  categories: Category[];
  selected: string;
  onChange: (value: string) => void;
}

export default function MenuCategories({ categories, selected, onChange }: MenuCategoriesProps) {
  // Map category names to icons
  const getCategoryIcon = (name: string) => {
    const normalizedName = name.toLowerCase();
    
    if (normalizedName.includes('dessert')) return <Coffee className="w-3 h-3" />;
    if (normalizedName.includes('burger') || normalizedName.includes('sandwich')) return <Beef className="w-3 h-3" />;
    if (normalizedName.includes('pizza') || normalizedName.includes('italian')) return <Pizza className="w-3 h-3" />;
    if (normalizedName.includes('salad') || normalizedName.includes('healthy')) return <Salad className="w-3 h-3" />;
    
    return <UtensilsCrossed className="w-3 h-3" />;
  };

  return (
    <div className="mb-4">
      <RadioGroup 
        value={selected} 
        onValueChange={onChange}
        className="flex overflow-x-auto pb-2 gap-2 scrollbar-none"
      >
        <div className="relative">
          <RadioGroupItem 
            value="" 
            id="all" 
            className="peer sr-only" 
          />
          <Label 
            htmlFor="all"
            className={cn(
              "px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-all shadow-sm cursor-pointer flex items-center",
              selected === "" 
                ? "bg-primary text-white shadow-md" 
                : "bg-white/70 backdrop-blur-sm border border-white/30 text-foreground hover:bg-white/90"
            )}
          >
            <GaugeCircle className="w-3 h-3 mr-1.5" />
            All Items
          </Label>
        </div>
        
        {categories.map((category) => (
          <div key={category.id} className="relative">
            <RadioGroupItem 
              value={category.slug} 
              id={category.slug} 
              className="peer sr-only" 
            />
            <Label 
              htmlFor={category.slug}
              className={cn(
                "px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-all shadow-sm cursor-pointer flex items-center",
                selected === category.slug 
                  ? "bg-primary text-white shadow-md" 
                  : "bg-white/70 backdrop-blur-sm border border-white/30 text-foreground hover:bg-white/90"
              )}
            >
              {getCategoryIcon(category.name)}
              <span className="ml-1.5">{category.name}</span>
            </Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}
