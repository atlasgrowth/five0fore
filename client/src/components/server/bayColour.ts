/**
 * Bay color helper function to ensure consistent coloring based on status
 */
export function bayColour(status: string) {
  if (!status) return "bg-gray-100"; // Default for null/undefined
  
  switch (status) {
    case "NEW":
      return "bg-blue-100";
    case "COOKING":
      return "bg-yellow-200";
    case "PLATING":
      return "bg-purple-200";
    case "READY":
      return "bg-green-200";
    default:
      return "bg-gray-100";
  }
}