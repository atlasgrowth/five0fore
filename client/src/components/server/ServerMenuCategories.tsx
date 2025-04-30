import { cn } from "@/lib/utils";
import { Category } from "@shared/schema";

interface ServerMenuCategoriesProps {
  categories: Category[];
  activeCategory: string;
  setActiveCategory: (category: string) => void;
}

export default function ServerMenuCategories({ 
  categories, 
  activeCategory, 
  setActiveCategory 
}: ServerMenuCategoriesProps) {
  return (
    <div className="mb-6">
      <div className="flex overflow-x-auto pb-2 space-x-2 no-scrollbar">
        <button 
          className={cn(
            "px-4 py-2 rounded-full whitespace-nowrap",
            activeCategory === "all" 
              ? "bg-primary text-white" 
              : "bg-white border border-neutral-300 text-neutral-700"
          )}
          onClick={() => setActiveCategory("all")}
        >
          All Items
        </button>
        
        {categories.map((category) => (
          <button
            key={category.id}
            className={cn(
              "px-4 py-2 rounded-full whitespace-nowrap",
              activeCategory === category.slug 
                ? "bg-primary text-white" 
                : "bg-white border border-neutral-300 text-neutral-700"
            )}
            onClick={() => setActiveCategory(category.slug)}
          >
            {category.name}
          </button>
        ))}
      </div>
    </div>
  );
}