import { cn } from "@/lib/utils";

interface OrderPriorityTabsProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  counts: {
    all: number;
    new: number;
    cooking: number;
    plating: number;
    ready: number;
    served: number;
    closed: number;
    delayed: number;
  };
}

export default function OrderPriorityTabs({ activeTab, setActiveTab, counts }: OrderPriorityTabsProps) {
  const tabs = [
    { 
      id: "all", 
      label: "All Orders", 
      count: counts.all,
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      ),
      color: "blue"
    },
    { 
      id: "new", 
      label: "New", 
      count: counts.new,
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
        </svg>
      ),
      color: "blue"
    },
    { 
      id: "cooking", 
      label: "Cooking", 
      count: counts.cooking,
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
        </svg>
      ),
      color: "amber"
    },
    { 
      id: "plating", 
      label: "Plating", 
      count: counts.plating,
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
        </svg>
      ),
      color: "orange"
    },
    { 
      id: "ready", 
      label: "Ready", 
      count: counts.ready,
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      ),
      color: "green"
    },
    { 
      id: "served", 
      label: "Served", 
      count: counts.served,
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
          <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1v-5h2a1 1 0 00.9-.55l4-8a1 1 0 00-.9-1.45H5a1 1 0 00-1 1v5a1 1 0 001 1h1a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
        </svg>
      ),
      color: "blue"
    },
    { 
      id: "closed", 
      label: "Closed", 
      count: counts.closed,
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
      ),
      color: "neutral"
    },
    { 
      id: "delayed", 
      label: "Delayed", 
      count: counts.delayed,
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      ),
      color: "red",
      danger: true
    },
  ];

  // Helper function to get tab colors
  const getTabColors = (tab: any) => {
    const isActive = activeTab === tab.id;
    
    const colorMap: Record<string, { text: string, border: string, bg: string }> = {
      blue: {
        text: isActive ? "text-blue-600" : "text-neutral-600 hover:text-blue-600",
        border: isActive ? "border-blue-500" : "border-transparent hover:border-blue-200",
        bg: isActive ? "bg-blue-50" : "hover:bg-blue-50/50"
      },
      green: {
        text: isActive ? "text-green-600" : "text-neutral-600 hover:text-green-600",
        border: isActive ? "border-green-500" : "border-transparent hover:border-green-200",
        bg: isActive ? "bg-green-50" : "hover:bg-green-50/50"
      },
      amber: {
        text: isActive ? "text-amber-600" : "text-neutral-600 hover:text-amber-600",
        border: isActive ? "border-amber-500" : "border-transparent hover:border-amber-200",
        bg: isActive ? "bg-amber-50" : "hover:bg-amber-50/50"
      },
      orange: {
        text: isActive ? "text-orange-600" : "text-neutral-600 hover:text-orange-600",
        border: isActive ? "border-orange-500" : "border-transparent hover:border-orange-200",
        bg: isActive ? "bg-orange-50" : "hover:bg-orange-50/50"
      },
      purple: {
        text: isActive ? "text-purple-600" : "text-neutral-600 hover:text-purple-600",
        border: isActive ? "border-purple-500" : "border-transparent hover:border-purple-200",
        bg: isActive ? "bg-purple-50" : "hover:bg-purple-50/50"
      },
      neutral: {
        text: isActive ? "text-gray-600" : "text-neutral-600 hover:text-gray-600",
        border: isActive ? "border-gray-500" : "border-transparent hover:border-gray-200",
        bg: isActive ? "bg-gray-50" : "hover:bg-gray-50/50"
      },
      red: {
        text: isActive ? "text-red-600" : "text-neutral-600 hover:text-red-600",
        border: isActive ? "border-red-500" : "border-transparent hover:border-red-200",
        bg: isActive ? "bg-red-50" : "hover:bg-red-50/50"
      }
    };
    
    const colors = colorMap[tab.color];
    return {
      text: colors.text,
      border: colors.border,
      bg: colors.bg
    };
  };

  return (
    <div className="mb-6">
      <div className="bg-white shadow-sm rounded-lg p-1 mb-2">
        <nav className="flex">
          {tabs.map((tab) => {
            const { text, border, bg } = getTabColors(tab);
            return (
              <button
                key={tab.id}
                className={cn(
                  "flex-1 flex items-center justify-center whitespace-nowrap py-2.5 px-3 text-sm font-medium rounded-md transition-all",
                  text,
                  bg,
                  border,
                  tab.id === "delayed" && tab.count > 0 && "border border-red-200"
                )}
                onClick={() => setActiveTab(tab.id)}
              >
                <div className="flex items-center">
                  {tab.icon}
                  <span>{tab.label}</span>
                  {tab.count > 0 && (
                    <span className={cn(
                      "ml-1.5 px-1.5 py-0.5 text-xs rounded-full",
                      activeTab === tab.id 
                        ? tab.color === "red" ? "bg-red-500 text-white" :
                          tab.color === "amber" ? "bg-amber-500 text-white" :
                          tab.color === "green" ? "bg-green-500 text-white" :
                          tab.color === "purple" ? "bg-purple-500 text-white" :
                          tab.color === "neutral" ? "bg-gray-500 text-white" :
                          "bg-blue-500 text-white"
                        : "bg-gray-200 text-gray-800"
                    )}>
                      {tab.count}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Status and cook time legends removed as requested */}
    </div>
  );
}
