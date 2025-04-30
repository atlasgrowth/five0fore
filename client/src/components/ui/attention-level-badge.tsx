import { cn } from "@/lib/utils";
import { AttentionLevel } from "@shared/schema";
import { AlertCircle, AlertOctagon, AlertTriangle, CheckCircle } from "lucide-react";

interface AttentionLevelBadgeProps {
  level: AttentionLevel;
  className?: string;
  showIcon?: boolean;
  showLabel?: boolean;
  compact?: boolean;
}

/**
 * Component to visually represent attention levels with appropriate styling
 * Supports different levels of visual intensity based on attention level
 * No flashing effects - removed per user request
 */
export function AttentionLevelBadge({
  level,
  className,
  showIcon = true,
  showLabel = true,
  compact = false,
}: AttentionLevelBadgeProps) {
  // Map attention levels to colors and icons
  const getAttentionStyles = () => {
    switch (level) {
      case AttentionLevel.NORMAL:
        return {
          containerClass: "bg-green-100 text-green-800 border-green-300",
          icon: <CheckCircle className="h-4 w-4" />,
          label: "Normal",
        };
      case AttentionLevel.ATTENTION:
        return {
          containerClass: "bg-amber-100 text-amber-800 border-amber-300",
          icon: <AlertCircle className="h-4 w-4" />,
          label: "Attention",
        };
      case AttentionLevel.PRIORITY:
        return {
          containerClass: "bg-orange-100 text-orange-800 border-orange-300", 
          icon: <AlertTriangle className="h-4 w-4" />,
          label: "Priority",
        };
      case AttentionLevel.CRITICAL:
        return {
          // No flashing, just a strong visual indicator
          containerClass: "bg-red-100 text-red-800 border-red-500 border-2",
          icon: <AlertOctagon className="h-4 w-4" />,
          label: "Critical",
        };
      default:
        return {
          containerClass: "bg-gray-100 text-gray-800 border-gray-300",
          icon: <CheckCircle className="h-4 w-4" />,
          label: "Unknown",
        };
    }
  };

  const { containerClass, icon, label } = getAttentionStyles();

  return (
    <div
      className={cn(
        "inline-flex items-center rounded border px-2 py-1 text-xs font-medium",
        containerClass,
        compact ? "py-0 px-1" : "",
        className
      )}
    >
      {showIcon && icon}
      {showLabel && <span className={cn(showIcon ? "ml-1" : "")}>{label}</span>}
    </div>
  );
}