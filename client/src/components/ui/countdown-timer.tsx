import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface CountdownTimerProps {
  estimatedCompletionTime: string | Date | null;
  className?: string;
}

/**
 * Component that displays a countdown timer until estimated completion time
 * Shows time remaining or time overdue with appropriate styling
 */
export function CountdownTimer({ estimatedCompletionTime, className }: CountdownTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState<{ minutes: number; seconds: number } | null>(null);
  const [isOverdue, setIsOverdue] = useState(false);
  
  useEffect(() => {
    if (!estimatedCompletionTime) {
      setTimeRemaining(null);
      return;
    }
    
    // Function to calculate time remaining
    const calculateTimeRemaining = () => {
      const targetTime = new Date(estimatedCompletionTime).getTime();
      const now = Date.now();
      const diffMs = targetTime - now;
      
      // Check if overdue
      if (diffMs <= 0) {
        // Calculate overdue time (positive values)
        const overdueMs = Math.abs(diffMs);
        const minutes = Math.floor(overdueMs / (1000 * 60));
        const seconds = Math.floor((overdueMs % (1000 * 60)) / 1000);
        setIsOverdue(true);
        return { minutes, seconds };
      } else {
        // Calculate remaining time
        const minutes = Math.floor(diffMs / (1000 * 60));
        const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
        setIsOverdue(false);
        return { minutes, seconds };
      }
    };
    
    // Calculate initial time
    setTimeRemaining(calculateTimeRemaining());
    
    // Update time every second
    const interval = setInterval(() => {
      setTimeRemaining(calculateTimeRemaining());
    }, 1000);
    
    // Clean up on unmount
    return () => clearInterval(interval);
  }, [estimatedCompletionTime]); // Re-run effect if estimatedCompletionTime changes
  
  // If no completion time or calculation result, show placeholder
  if (!estimatedCompletionTime || !timeRemaining) {
    return <span className={cn("text-xs font-medium text-gray-400", className)}>--:--</span>;
  }
  
  // Determine styling based on time remaining
  let textColorClass = "text-green-600";
  let bgColorClass = "bg-green-100";
  let prefix = "";
  
  if (isOverdue) {
    prefix = "Overdue: ";
    if (timeRemaining.minutes > 5) {
      // Significantly overdue
      textColorClass = "text-red-600";
      bgColorClass = "bg-red-100";
    } else if (timeRemaining.minutes > 2) {
      // Moderately overdue
      textColorClass = "text-orange-600";
      bgColorClass = "bg-orange-100";
    } else {
      // Slightly overdue
      textColorClass = "text-amber-600";
      bgColorClass = "bg-amber-100";
    }
  } else {
    // Not overdue - check how much time remains
    if (timeRemaining.minutes < 2) {
      // Getting close to deadline
      textColorClass = "text-amber-600";
      bgColorClass = "bg-amber-100";
    } else if (timeRemaining.minutes < 5) {
      // Moderate time remaining
      textColorClass = "text-green-600";
      bgColorClass = "bg-green-100";
    } else {
      // Plenty of time remaining
      textColorClass = "text-blue-600";
      bgColorClass = "bg-blue-100";
    }
  }
  
  return (
    <span className={cn(
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
      bgColorClass,
      textColorClass,
      className
    )}>
      {prefix}{timeRemaining.minutes}:{timeRemaining.seconds.toString().padStart(2, '0')}
    </span>
  );
}