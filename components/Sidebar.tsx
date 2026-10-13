import React from "react";
import {
  Activity,
  AlertTriangle,
  Download,
  FileText,
  Globe,
  Laptop,
  Lock,
  Shield,
  Sliders,
  UserMinus
} from "lucide-react";
import { NavigationTab } from "../types";

interface SidebarProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  activeAlertsCount: number;
  enrolledSystemsCount: number;
  pendingRemovalCount: number;
}

interface NavItem {
  id: NavigationTab;
  label: string;
  icon: React.ElementType;
  badge?: number;
  badgeColor?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  activeAlertsCount,
  enrolledSystemsCount,
  pendingRemovalCount
}) => {
  const navItems: NavItem[] = [
    {
      id: "overview",
      label: "Overview",
      icon: Activity
    },
    {
      id: "url_history",
      label: "URL History",
      icon: Globe
    },
    {
      id: "enrolled_systems",
      label: "Enrolled Systems",
      icon: Laptop,
      badge: enrolledSystemsCount
    },
    {
      id: "threat_alerts",
      label: "Threat Alerts",
      icon: AlertTriangle,
      badge: activeAlertsCount,
      badgeColor: activeAlertsCount > 0 ? "bg-red-500/20 text-red-400 border border-red-500/30" : undefined
    },
    {
      id: "removal_requests",
      label: "Removal Requests",
      icon: UserMinus,
      badge: pendingRemovalCount,
      badgeColor: pendingRemovalCount > 0 ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : undefined
    },
    {
      id: "security_rules",
      label: "Security Rules",
      icon: Sliders
    },
    {
      id: "reports",
      label: "Security Reports",
      icon: FileText
    },
    {
      id: "install_extension",
      label: "Deploy Agent",
      icon: Download
    },
    {
      id: "admin_settings",
      label: "Admin Settings",
      icon: Lock
    }
  ];

  return (
    <aside className="w-64 bg-[#0e0e0e] border-r border-[#262626] flex flex-col justify-between shrink-0 select-none">
      <div className="p-4 space-y-1.5 overflow-y-auto">
        <div className="px-3 py-2 text-[11px] font-semibold tracking-wider uppercase text-neutral-400">
          Navigation
        </div>
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                isActive
                  ? "bg-neutral-800 text-white font-semibold shadow-sm"
                  : "text-neutral-300 hover:text-white hover:bg-neutral-800/60"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? "text-white" : "text-neutral-400"
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </div>
              {item.badge !== undefined && item.badge > 0 && (
                <span
                  className={`px-2 py-0.5 text-[10px] font-mono rounded-full font-bold ${
                    item.badgeColor || "bg-[#262626] text-neutral-300"
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Fleet Version / Node Status */}
      <div className="p-4 border-t border-[#262626] bg-[#0a0a0a]/50">
        <div className="flex items-center justify-between text-[11px] text-neutral-400">
          <span>Engine v1.4.0</span>
          <span className="inline-flex items-center gap-1 text-emerald-400 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            ACTIVE
          </span>
        </div>
      </div>
    </aside>
  );
};
