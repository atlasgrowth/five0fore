import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface ElapsedClockProps {
  createdAt: string | Date;
  className?: string;
}

export function ElapsedClock({ createdAt, className }: ElapsedClockProps) {
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  
  useEffect(() => {
    // Calculate initial elapsed time
    const orderDate = new Date(createdAt);
    const initialElapsed = Math.floor((Date.now() - orderDate.getTime()) / 1000);
    setElapsedTime(initialElapsed);
    
    // Update elapsed time every second
    const timer = setInterval(() => {
      const orderDate = new Date(createdAt);
      const newElapsed = Math.floor((Date.now() - orderDate.getTime()) / 1000);
      setElapsedTime(newElapsed);
    }, 1000);
    
    // Cleanup on unmount
    return () => clearInterval(timer);
  }, [createdAt]);
  
  // Format seconds to mm:ss
  const formatElapsedTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  
  // Determine color based on elapsed time
  let textColor = 'text-neutral-600';
  
  if (elapsedTime > 1200) { // 20+ minutes
    textColor = 'text-danger';
  } else if (elapsedTime > 900) { // 15+ minutes
    textColor = 'text-warning';
  } else {
    textColor = 'text-success';
  }

  return (
    <span className={cn(
      "text-sm font-medium",
      textColor,
      className
    )}>
      {formatElapsedTime(elapsedTime)}
    </span>
  );
}