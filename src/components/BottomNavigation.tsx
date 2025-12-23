import React from "react";
import { LayoutDashboard, Calendar, ArrowLeftRight, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export type TabId = "dashboard" | "monthly" | "compare" | "trends";

interface BottomNavigationProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const tabs = [
  { id: "dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
  { id: "monthly" as const, label: "Monthly", icon: Calendar },
  { id: "compare" as const, label: "Compare", icon: ArrowLeftRight },
  { id: "trends" as const, label: "Trends", icon: TrendingUp },
];

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activeTab,
  onTabChange,
}) => {
  return (
    <nav className="bottom-nav">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "bottom-nav-item",
              isActive && "bottom-nav-item-active"
            )}
          >
            <Icon className={cn("h-5 w-5", isActive && "text-primary")} />
            <span className={cn("text-xs font-medium", isActive && "text-primary")}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
