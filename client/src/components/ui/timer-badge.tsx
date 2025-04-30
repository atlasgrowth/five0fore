import { cn } from "@/lib/utils";

interface TimerBadgeProps {
  minutes: number;
  isDelayed?: boolean;
  className?: string;
}

export function TimerBadge({ minutes, isDelayed = false, className }: TimerBadgeProps) {
  // Determine color based on time
  let textColor = 'text-neutral-600';
  let bgColor = 'bg-neutral-200';
  
  if (isDelayed || minutes > 20) {
    textColor = 'text-danger';
    bgColor = 'bg-danger';
  } else if (minutes > 15) {
    textColor = 'text-warning';
    bgColor = 'bg-warning';
  } else {
    textColor = 'text-success';
    bgColor = 'bg-success';
  }
  
  // Format minutes
  const formatTime = (mins: number) => {
    const hours = Math.floor(mins / 60);
    const minutes = mins % 60;
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}`;
    }
    return `${minutes}:00`;
  };

  return (
    <span className={cn(
      "text-xs",
      textColor,
      className
    )}>
      {formatTime(minutes)}
    </span>
  );
}

export function TimerPill({ minutes, isDelayed = false, className }: TimerBadgeProps) {
  // Determine styles based on time and delay status
  let bgColor = 'bg-gray-200';
  let textColor = 'text-gray-700';
  let iconClass = 'inline-block mr-1';
  
  if (isDelayed) {
    bgColor = 'bg-red-500';
    textColor = 'text-white';
  } else if (minutes > 20) {
    bgColor = 'bg-red-500';
    textColor = 'text-white';
  } else if (minutes > 15) {
    bgColor = 'bg-amber-500';
    textColor = 'text-white';
  } else if (minutes > 10) {
    bgColor = 'bg-amber-400';
    textColor = 'text-amber-900';
  } else {
    bgColor = 'bg-green-500';
    textColor = 'text-white';
  }
  
  // Format minutes
  const formatTime = (mins: number) => {
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    if (hours > 0) {
      return `${hours}:${remainingMins.toString().padStart(2, '0')}`;
    }
    
    // Show fixed minutes with seconds (00) to make it look like a timer
    return `${mins}:00`;
  };

  return (
    <span className={cn(
      "text-xs font-medium px-3 py-1.5 rounded-full shadow-sm flex items-center",
      bgColor,
      textColor,
      className
    )}>
      {isDelayed && (
        <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
      )}
      {formatTime(minutes)}
    </span>
  );
}
