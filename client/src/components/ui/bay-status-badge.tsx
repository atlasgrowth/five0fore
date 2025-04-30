import React from "react";
import { cn } from "@/lib/utils";
import { CookingPot, Utensils, CheckCircle, CircleOff, Clock, Bird } from "lucide-react";

export function BayStatusBadge({ status }: { status: string }) {
  let badgeClasses = "";
  let label = "";
  let icon = null;

  switch (status.toLowerCase()) {
    // Original statuses
    case "active":
    case "new":
      badgeClasses = "bg-blue-600 text-white";
      label = "New";
      icon = (
        <Clock className="h-3 w-3 mr-1" />
      );
      break;
    case "empty":
      badgeClasses = "bg-gray-500 text-white";
      label = "Available";
      icon = (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
      break;
    case "flagged":
      badgeClasses = "bg-amber-600 text-white";
      label = "Flagged";
      icon = (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
        </svg>
      );
      break;
    case "alert":
      badgeClasses = "bg-red-600 text-white";
      label = "Alert";
      icon = (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      );
      break;
      
    // New kitchen-driven statuses
    case "cooking":
      badgeClasses = "bg-yellow-500 text-white";
      label = "Cooking";
      icon = <CookingPot className="h-3 w-3 mr-1" />;
      break;
    case "plating":
      badgeClasses = "bg-purple-600 text-white";
      label = "Plating";
      icon = <Utensils className="h-3 w-3 mr-1" />;
      break;
    case "ready":
      badgeClasses = "bg-green-600 text-white";
      label = "Ready";
      icon = <CheckCircle className="h-3 w-3 mr-1" />;
      break;
    case "served":
      badgeClasses = "bg-gray-600 text-white";
      label = "Served";
      icon = <Bird className="h-3 w-3 mr-1" />;
      break;
    case "closed":
      badgeClasses = "bg-gray-700 text-white";
      label = "Closed";
      icon = <CircleOff className="h-3 w-3 mr-1" />;
      break;
    case "cancelled":
      badgeClasses = "bg-neutral-700 text-white";
      label = "Cancelled";
      icon = <CircleOff className="h-3 w-3 mr-1" />;
      break;
      
    default:
      badgeClasses = "bg-gray-600 text-white";
      label = status;
      icon = (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
  }

  return (
    <span className={cn("text-xs px-2 py-0.5 rounded-full flex items-center font-medium", badgeClasses)}>
      {icon}
      {label}
    </span>
  );
}

export function BayStatusContainer({ status, children }: { status: string, children: React.ReactNode }) {
  let containerClasses = "";

  switch (status.toLowerCase()) {
    // Original statuses
    case "active":
    case "new":
      containerClasses = "bg-gradient-to-br from-blue-50 to-blue-100 border-blue-300 shadow-sm shadow-blue-100";
      break;
    case "empty":
      containerClasses = "bg-gradient-to-br from-neutral-50 to-neutral-100 border-neutral-200 shadow-sm shadow-neutral-50";
      break;
    case "flagged":
      containerClasses = "bg-gradient-to-br from-amber-50 to-amber-100 border-amber-300 shadow-sm shadow-amber-100";
      break;
    case "alert":
      containerClasses = "bg-gradient-to-br from-red-50 to-red-100 border-red-300 shadow-sm shadow-red-100";
      break;
      
    // New kitchen-driven statuses
    case "cooking":
      containerClasses = "bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-300 shadow-sm shadow-yellow-100";
      break;
    case "plating":
      containerClasses = "bg-gradient-to-br from-purple-50 to-purple-100 border-purple-300 shadow-sm shadow-purple-100";
      break;
    case "ready":
      containerClasses = "bg-gradient-to-br from-green-50 to-green-100 border-green-300 shadow-sm shadow-green-100";
      break;
    case "served":
      containerClasses = "bg-gradient-to-br from-gray-50 to-gray-100 border-gray-300 shadow-sm shadow-gray-100";
      break;
    case "closed":
      containerClasses = "bg-gradient-to-br from-gray-100 to-gray-200 border-gray-400 shadow-sm shadow-gray-100";
      break;
    case "cancelled":
      containerClasses = "bg-gradient-to-br from-neutral-50 to-neutral-100 border-neutral-300 shadow-sm shadow-neutral-100";
      break;
      
    default:
      containerClasses = "bg-gradient-to-br from-slate-50 to-slate-100 border-slate-300 shadow-sm";
  }

  return (
    <div className={cn(
      "flex flex-col items-center justify-center gap-1 border-2 p-3 rounded-lg transition-all", 
      "hover:shadow-md hover:scale-105 cursor-pointer",
      containerClasses
    )}>
      {children}
    </div>
  );
}