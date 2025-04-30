import { useState, useEffect } from "react";
import { OrderSummary } from "@shared/schema";
import { cn } from "@/lib/utils";

interface BayTabsProps {
  orders: OrderSummary[];
  onTabChange: (tab: string) => void;
}

export default function BayTabs({ orders, onTabChange }: BayTabsProps) {
  // Set initial tab to ALL by default
  const [activeTab, setActiveTab] = useState("ALL");
  
  // Compute counts for each status
  const newOrders = orders.filter(o => o.status.toUpperCase() === "NEW").length;
  const cooking = orders.filter(o => o.status.toUpperCase() === "COOKING").length;
  const plating = orders.filter(o => o.status.toUpperCase() === "PLATING").length;
  const ready = orders.filter(o => o.status.toUpperCase() === "READY").length;
  const served = orders.filter(o => o.status.toUpperCase() === "SERVED").length;
  const closed = orders.filter(o => o.status.toUpperCase() === "CLOSED").length;
  const delayed = orders.filter(o => o.isDelayed).length;
  
  // Calculate "All Active" count (everything that's not CLOSED or CANCELLED)
  const allActive = orders.filter(o => {
    const status = o.status.toUpperCase();
    return status !== "CLOSED" && status !== "CANCELLED";
  }).length;
  
  // Main pipeline tabs in the correct flow order: NEW→COOKING→PLATING→READY→SERVED→CLOSED
  const tabs = [
    { id: "ALL", label: "All Active", count: allActive },
    { id: "NEW", label: "New", count: newOrders },
    { id: "COOKING", label: "Cooking", count: cooking },
    { id: "PLATING", label: "Plating", count: plating },
    { id: "READY", label: "Ready", count: ready },
    { id: "SERVED", label: "Served", count: served },
    { id: "CLOSED", label: "Closed", count: closed },
    { id: "DELAYED", label: "Delayed", count: delayed }
  ];
  
  // When tab changes, notify parent
  useEffect(() => {
    onTabChange(activeTab);
  }, [activeTab, onTabChange]);
  
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
  };
  
  // Display all tabs in the main section as a single row - no separation
  const allTabs = tabs; // ALL, NEW, COOKING, PLATING, READY, SERVED, CLOSED, DELAYED
  
  return (
    <div className="mb-4">
      {/* Full order flow tabs: NEW→COOKING→PLATING→READY→SERVED→CLOSED */}
      <div className="flex border-b border-neutral-200">
        {allTabs.map((tab: { id: string; label: string; count: number }) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={cn(
              "px-4 py-2 font-medium text-sm",
              activeTab === tab.id
                ? "border-b-2 border-primary text-primary"
                : "text-neutral-600 hover:text-neutral-900"
            )}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="ml-1 rounded bg-neutral-200 px-1.5 py-0.5 text-xs">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}