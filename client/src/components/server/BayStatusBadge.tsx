import React from 'react';
import { bayColour } from './bayColour';

interface BayStatusBadgeProps {
  status: string;
}

/**
 * A reusable badge component for displaying bay status
 * Uses the centralized bayColour utility for consistent styling
 */
const BayStatusBadge: React.FC<BayStatusBadgeProps> = ({ status }) => {
  // Always use the bayColour utility for consistent coloring
  const colorClass = bayColour(status);
  
  // Helper to get a user-friendly display name
  const getStatusDisplay = (status: string) => {
    if (!status) return 'Unknown';
    
    // Normalize the status to handle both upper and lowercase
    const normalized = status.toUpperCase();
    
    switch (normalized) {
      case 'NEW':
      case 'ACTIVE':
        return 'New Order';
      case 'COOKING':
        return 'Cooking';
      case 'PLATING':
        return 'Plating';
      case 'READY':
        return 'Ready';
      case 'SERVED':
        return 'Served';
      case 'EMPTY':
      case 'AVAILABLE':
        return 'Available';
      case 'CLOSED':
        return 'Closed';
      case 'CANCELLED':
        return 'Cancelled';
      default:
        // Capitalize first letter
        return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
    }
  };
  
  return (
    <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
      {getStatusDisplay(status)}
    </span>
  );
};

export default BayStatusBadge;