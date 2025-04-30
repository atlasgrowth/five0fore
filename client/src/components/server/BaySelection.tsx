import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { BayStatusContainer, BayStatusBadge } from "@/components/ui/bay-status-badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { SeatingType } from "@shared/schema";

// Bay color helper function to ensure consistent coloring based on status
export function bayColour(status: string) {
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

interface BaySelectionProps {
  onBayClick?: (bayId: number) => void;
}

export default function BaySelection({ onBayClick }: BaySelectionProps) {
  const [selectedFloor, setSelectedFloor] = useState<string>("1"); // Start with Floor 1 by default
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedTab, setSelectedTab] = useState<string>("bays"); // Default tab is bays
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filteredBays, setFilteredBays] = useState<any[]>([]);

  // Fetch all bays
  const { data: bays, isLoading } = useQuery({
    queryKey: ['/api/bays'],
  });

  // Filter bays based on selected criteria
  useEffect(() => {
    if (!bays || !Array.isArray(bays)) return;

    let filtered = [...bays];

    // Filter by floor
    if (selectedFloor !== "all") {
      filtered = filtered.filter(bay => bay.floor === parseInt(selectedFloor));
    }

    // Filter by status
    if (selectedStatus !== "all") {
      filtered = filtered.filter(bay => bay.status === selectedStatus);
    }

    // Filter by seating type
    if (selectedType !== "all") {
      if (selectedType === "BAR") {
        // For BAR filter, include both BAR_LEFT and BAR_RIGHT types
        filtered = filtered.filter(bay => bay.type === "BAR_LEFT" || bay.type === "BAR_RIGHT");
      } else {
        filtered = filtered.filter(bay => bay.type === selectedType);
      }
    }

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(bay => {
        // Search by bay number or display name
        return bay.number.toString().includes(searchQuery) || 
               (bay.displayName && bay.displayName.toLowerCase().includes(searchQuery.toLowerCase()));
      });
    }

    setFilteredBays(filtered);
  }, [bays, selectedFloor, selectedStatus, selectedType, searchQuery]);

  // Format bay number based on type
  const formatBayNumber = (bay: any) => {
    if (bay.type === "BAR_LEFT" || bay.type === "BAR_RIGHT") {
      // For bar seating, just show 1 through 15
      return (bay.number % 100).toString(); 
    } else if (bay.type === "TABLE") {
      // For tables, just show 1 through 15
      return (bay.number % 100).toString();
    } else {
      // For regular bays, show the number
      return bay.number.toString();
    }
  };

  // Render a bay tile with consistent styling
  const renderBayTile = (bay: any) => {
    // Base styles for all types
    const baseStyle = `
      relative group cursor-pointer rounded-md overflow-hidden
      transition-transform hover:scale-105 hover:shadow-md
      flex flex-col items-center justify-center py-4 h-20
    `;

    // Status-based styling based on our color coding system
    let statusStyle = '';
    const lowercaseStatus = bay.status.toLowerCase();

    // First, use the bayColour function for consistent coloring
    const baseColorClass = bayColour(bay.status);
    
    // Then enhance with gradients for visual appeal
    switch(lowercaseStatus) {
      // Blue - New orders
      case 'active':
      case 'new':
        statusStyle = 'bg-gradient-to-r from-blue-500 to-blue-600 text-white';
        break;

      // Yellow/Orange - Cooking orders
      case 'cooking':
      case 'flagged':  // Legacy status
        statusStyle = 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-white';
        break;

      // Purple - Plating orders
      case 'plating':
      case 'alert':  // Legacy status
        statusStyle = 'bg-gradient-to-r from-purple-500 to-purple-600 text-white';
        break;

      // Green - Ready orders
      case 'ready':
        statusStyle = 'bg-gradient-to-r from-green-500 to-green-600 text-white';
        break;

      // Gray - Empty or Served bays
      case 'empty':
      case 'occupied': // Legacy status
      case 'served':
        statusStyle = 'bg-gradient-to-r from-gray-200 to-gray-300 text-gray-800 border-2 border-gray-300 hover:border-gray-400';
        break;

      // Dark Gray - Closed orders
      case 'closed':
        statusStyle = 'bg-gradient-to-r from-gray-500 to-gray-600 text-white';
        break;

      // Dark Gray - Cancelled orders
      case 'cancelled':
        statusStyle = 'bg-gradient-to-r from-neutral-600 to-neutral-700 text-white';
        break;

      default:
        statusStyle = 'bg-gradient-to-r from-gray-200 to-gray-300 text-gray-800 border-2 border-gray-300 hover:border-gray-400';
        break;
    }

    // Type-specific styling
    let typeStyle = 'border-emerald-200';
    if (bay.type === 'BAR_LEFT' || bay.type === 'BAR_RIGHT') {
      typeStyle = 'border-blue-300';
    } else if (bay.type === 'TABLE') {
      typeStyle = 'border-purple-300';
    }

    return (
      <div 
        className={`${baseStyle} ${statusStyle} ${typeStyle} ${baseColorClass}`}
        onClick={() => onBayClick && onBayClick(bay.id)}
      >
        {/* Floor indicator */}
        <div className="absolute -top-1 -right-1 bg-white rounded-bl-md px-1.5 py-0.5 text-xs font-medium text-emerald-800 border-b border-l border-emerald-200">
          {bay.floor}F
        </div>

        {/* Type indicator (small icon or letter) */}
        <div className="absolute top-1 left-1 text-xs font-medium">
          {(bay.type === 'BAR_LEFT' || bay.type === 'BAR_RIGHT') && <span className="text-xs">B</span>}
          {bay.type === 'TABLE' && <span className="text-xs">T</span>}
        </div>

        {/* Bay number or display name */}
        <span className="text-xl font-bold">
          {bay.displayName || formatBayNumber(bay)}
        </span>

        {/* Status indicator */}
        <div className="mt-1">
          {bay.orders && bay.orders.length > 0 ? (
            <div className="text-xs font-medium">
              {bay.totalItems || bay.orders.length} items • {bay.status}
            </div>
          ) : (
            <BayStatusBadge status={bay.status} />
          )}
        </div>

        {/* Hover effects */}
        <div className="absolute inset-0 bg-emerald-900 opacity-0 group-hover:opacity-10 transition-opacity"></div>
        {bay.type === 'BAY' && (
          <div className="absolute -bottom-6 -right-6 w-12 h-12 bg-white rounded-full opacity-0 group-hover:opacity-10 transition-opacity"></div>
        )}
      </div>
    );
  };

  return (
    <div className="mb-6 rounded-lg border border-emerald-200 bg-white shadow-lg overflow-hidden">
      {/* Header with golf-themed gradient */}
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 p-4 flex items-center justify-between">
        <h2 className="font-poppins font-bold text-xl text-white flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          Bay Selection
        </h2>
        <div className="text-white text-sm bg-emerald-700 px-3 py-1 rounded-full">
          Five O Four Golf
        </div>
      </div>

      {/* Filter controls */}
      <div className="p-5 bg-gradient-to-b from-gray-50 to-white">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-sm font-medium text-emerald-800 mb-1.5">Floor</label>
            <Select value={selectedFloor} onValueChange={setSelectedFloor}>
              <SelectTrigger className="bg-white border-emerald-200 hover:border-emerald-400 transition-colors">
                <SelectValue placeholder="All Floors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Floors</SelectItem>
                <SelectItem value="1">Floor 1</SelectItem>
                <SelectItem value="2">Floor 2</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-sm font-medium text-emerald-800 mb-1.5">Seating Type</label>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="bg-white border-emerald-200 hover:border-emerald-400 transition-colors">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="BAY">Golf Bays</SelectItem>
                <SelectItem value="BAR">Bar Seating</SelectItem>
                <SelectItem value="TABLE">Tables</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-sm font-medium text-emerald-800 mb-1.5">Bay Status</label>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="bg-white border-emerald-200 hover:border-emerald-400 transition-colors">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">New Orders</SelectItem>
                <SelectItem value="cooking">Cooking</SelectItem>
                <SelectItem value="plating">Plating</SelectItem>
                <SelectItem value="ready">Ready</SelectItem>
                <SelectItem value="served">Served</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="empty">Available</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-sm font-medium text-emerald-800 mb-1.5">Search</label>
            <Input 
              type="text" 
              placeholder="Search by name or #" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white border-emerald-200 hover:border-emerald-400 focus:border-emerald-500 focus:ring-emerald-500 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Seating Type Tabs */}
      <div className="border-t border-emerald-100">
        <Tabs 
          value={selectedTab} 
          onValueChange={setSelectedTab}
          className="w-full"
        >
          <div className="bg-emerald-50 px-5 pt-4">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger 
                value="bays" 
                className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white font-medium text-base"
                onClick={() => setSelectedType("BAY")}
              >
                Golf Bays
              </TabsTrigger>
              <TabsTrigger 
                value="bar" 
                className="data-[state=active]:bg-blue-600 data-[state=active]:text-white font-medium text-base"
                onClick={() => setSelectedType("BAR")}
              >
                Bar Seating
              </TabsTrigger>
              <TabsTrigger 
                value="tables" 
                className="data-[state=active]:bg-purple-600 data-[state=active]:text-white font-medium text-base"
                onClick={() => setSelectedType("TABLE")}
              >
                Tables
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Bay Grid Content */}
          <div className="p-5 bg-gray-50">
            {isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <>
                {/* Section Title based on selected tab */}
                <div className="mb-4 flex justify-between items-center">
                  <h3 className="font-semibold text-lg text-gray-700">
                    {selectedTab === "bays" && "Golf Bays"}
                    {selectedTab === "bar" && "Bar Seating"}
                    {selectedTab === "tables" && "Tables"}
                    {selectedFloor !== "all" && ` - Floor ${selectedFloor}`}
                  </h3>
                  <div className="text-sm text-gray-500">
                    {filteredBays.length} {filteredBays.length === 1 ? 'location' : 'locations'} available
                  </div>
                </div>

                {/* TabsContent for each type */}
                <TabsContent value="bays" className="m-0">
                  <div className="grid grid-cols-5 md:grid-cols-8 lg:grid-cols-10 gap-3 py-2">
                    {filteredBays.filter(bay => bay.type === "BAY").map((bay) => (
                      <div key={bay.id}>
                        {renderBayTile(bay)}
                      </div>
                    ))}
                    {filteredBays.filter(bay => bay.type === "BAY").length === 0 && (
                      <div className="col-span-full text-center py-8 text-gray-500">
                        No golf bays available with current filters
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="bar" className="m-0">
                  <div className="grid grid-cols-5 md:grid-cols-8 gap-3 py-2">
                    {filteredBays.filter(bay => bay.type === "BAR_LEFT" || bay.type === "BAR_RIGHT").map((bay) => (
                      <div key={bay.id}>
                        {renderBayTile(bay)}
                      </div>
                    ))}
                    {filteredBays.filter(bay => bay.type === "BAR_LEFT" || bay.type === "BAR_RIGHT").length === 0 && (
                      <div className="col-span-full text-center py-8 text-gray-500">
                        No bar seats available with current filters
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="tables" className="m-0">
                  <div className="grid grid-cols-5 md:grid-cols-7 lg:grid-cols-8 gap-3 py-2">
                    {filteredBays.filter(bay => bay.type === "TABLE").map((bay) => (
                      <div key={bay.id}>
                        {renderBayTile(bay)}
                      </div>
                    ))}
                    {filteredBays.filter(bay => bay.type === "TABLE").length === 0 && (
                      <div className="col-span-full text-center py-8 text-gray-500">
                        No tables available with current filters
                      </div>
                    )}
                  </div>
                </TabsContent>
              </>
            )}
          </div>
        </Tabs>
      </div>
    </div>
  );
}