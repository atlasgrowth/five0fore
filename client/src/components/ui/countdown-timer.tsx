import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface CountdownTimerProps {
  estimatedCompletionTime: Date | string | null;
  className?: string;
}

export function CountdownTimer({ estimatedCompletionTime, className }: CountdownTimerProps) {
  const [remaining, setRemaining] = useState<{ minutes: number, seconds: number } | null>(null);
  const [isOverdue, setIsOverdue] = useState(false);
  
  useEffect(() => {
    if (!estimatedCompletionTime) return;
    
    // Function to calculate remaining time
    const calculateRemaining = () => {
      const targetTime = new Date(estimatedCompletionTime).getTime();
      const now = Date.now();
      const diffMs = targetTime - now;
      
      if (diffMs <= 0) {
        setIsOverdue(true);
        // Show the absolute value of overdue time
        const absDiffMs = Math.abs(diffMs);
        const minutes = Math.floor(absDiffMs / (1000 * 60));
        const seconds = Math.floor((absDiffMs % (1000 * 60)) / 1000);
        return { minutes, seconds };
      } else {
        setIsOverdue(false);
        const minutes = Math.floor(diffMs / (1000 * 60));
        const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
        return { minutes, seconds };
      }
    };
    
    // Calculate initial time
    setRemaining(calculateRemaining());
    
    // Update time every second
    const interval = setInterval(() => {
      setRemaining(calculateRemaining());
    }, 1000);
    
    // Clean up on unmount
    return () => clearInterval(interval);
  }, [estimatedCompletionTime]); // Re-run effect if estimatedCompletionTime changes
  
  if (!remaining) {
    return null;
  }
  
  // Determine styling based on remaining time
  let bgColor = 'bg-green-500'; // Default - plenty of time left
  
  // Change colors based on time remaining
  if (isOverdue) {
    bgColor = 'bg-red-500'; // Overdue
  } else if (remaining.minutes < 2) {
    bgColor = 'bg-amber-500'; // Less than 2 minutes - getting close
  } else if (remaining.minutes < 5) {
    bgColor = 'bg-yellow-500'; // Less than 5 minutes - heads up
  }
  
  return (
    <div className={cn(
      "flex flex-col text-xs",
      className
    )}>
      <div className="text-gray-500 mb-1">
        {isOverdue ? 'Overdue by:' : 'Ready in:'}
      </div>
      <span className={cn(
        "font-medium px-3 py-1.5 rounded-full shadow-sm flex items-center justify-center",
        bgColor,
        "text-white"
      )}>
        {`${remaining.minutes}:${remaining.seconds.toString().padStart(2, '0')}`}
      </span>
    </div>
  );
}