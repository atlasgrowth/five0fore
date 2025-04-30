/**
 * Bay color helper function to ensure consistent coloring based on status
 * Handles both uppercase and lowercase status values
 */
export function bayColour(status: string) {
  if (!status) return "bg-gray-100"; // Default for null/undefined
  
  // Normalize status to uppercase for consistency
  const normalizedStatus = status.toUpperCase();
  
  switch (normalizedStatus) {
    // Blue - New orders
    case "NEW":
    case "ACTIVE":
      return "bg-blue-500 text-white";
      
    // Yellow/Orange - Cooking orders
    case "COOKING":
    case "FLAGGED":  // Legacy status
      return "bg-yellow-500 text-white";
      
    // Purple - Plating orders
    case "PLATING":
    case "ALERT":  // Legacy status
      return "bg-purple-500 text-white";
      
    // Green - Ready orders
    case "READY":
      return "bg-green-500 text-white";
      
    // Light Blue - Served orders
    case "SERVED":
      return "bg-blue-300 text-white";
      
    // Gray - Empty or Available bays
    case "EMPTY":
    case "AVAILABLE":
    case "OCCUPIED": // Legacy status
      return "bg-gray-200 text-gray-800";
      
    // Dark Gray - Closed or Cancelled orders
    case "CLOSED":
    case "CANCELLED":
      return "bg-gray-500 text-white";
      
    // Default fallback
    default:
      return "bg-gray-200 text-gray-800";
  }
}