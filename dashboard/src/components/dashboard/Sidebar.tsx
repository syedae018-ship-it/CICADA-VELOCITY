"use client";

import React from "react";
import {
  LayoutDashboard,
  Server,
  Layers,
  AlertTriangle,
  Sparkles,
  ShieldCheck,
  EyeOff,
  Activity,
  History,
  FileDown,
  Clock,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { DashboardTab, TenantId } from "@/types";

interface SidebarProps {
  currentTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  tenantId: TenantId;
  openIncidentsCount: number;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export default function Sidebar({
  currentTab,
  onTabChange,
  tenantId,
  openIncidentsCount,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const navItems = [
    {
      id: "overview" as DashboardTab,
      label: "Overview",
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: "sources" as DashboardTab,
      label: "Monitored Sources",
      icon: Layers,
      badge: null,
    },
    {
      id: "fleet" as DashboardTab,
      label: "Fleet Nodes",
      icon: Server,
      badge: null,
    },
    {
      id: "incidents" as DashboardTab,
      label: "Incidents & AIOps",
      icon: AlertTriangle,
      badge: openIncidentsCount > 0 ? `${openIncidentsCount}` : null,
      badgeClass: "bg-neutral-900 text-white font-mono",
    },
    {
      id: "ai_insights" as DashboardTab,
      label: "AI Insights",
      icon: Sparkles,
      badge: "GenOps",
      badgeClass: "border border-neutral-300 bg-neutral-100 text-neutral-700 font-mono",
    },
    {
      id: "egress" as DashboardTab,
      label: "Egress Proof",
      icon: ShieldCheck,
      badge: "Tier 1→2",
      badgeClass: "border border-neutral-300 bg-neutral-100 text-neutral-700 font-mono",
    },
    {
      id: "privacy" as DashboardTab,
      label: "Privacy Side-by-Side",
      icon: EyeOff,
      badge: "Zero Leaks",
      badgeClass: "border border-neutral-300 bg-neutral-100 text-neutral-700 font-mono",
    },
    {
      id: "reliability" as DashboardTab,
      label: "Reliability & SLA",
      icon: Activity,
      badge: "<10s",
      badgeClass: "border border-neutral-300 bg-neutral-100 text-neutral-700 font-mono",
    },
    {
      id: "timeline" as DashboardTab,
      label: "Activity Timeline",
      icon: Clock,
      badge: null,
    },
    {
      id: "history" as DashboardTab,
      label: "State History",
      icon: History,
      badge: null,
    },
    {
      id: "reports" as DashboardTab,
      label: "Export Reports",
      icon: FileDown,
      badge: "CSV/PDF",
      badgeClass: "border border-neutral-300 bg-neutral-100 text-neutral-700 font-mono",
    },
  ];

  const sidebarContent = (
    <div className="flex flex-col justify-between h-full font-sans">
      <div>
        {/* Brand header */}
        <div className="h-14 px-4 border-b border-neutral-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 bg-neutral-900 text-white flex items-center justify-center font-bold text-xs rounded-sm shrink-0">
              V
            </div>
            {!isCollapsed && (
              <div className="flex items-center gap-1.5 overflow-hidden">
                <span className="font-bold text-sm tracking-tight text-neutral-900 uppercase">
                  Velocity
                </span>
                <span className="text-[10px] font-mono text-neutral-500 uppercase">
                  / Cicada
                </span>
              </div>
            )}
          </div>

          {/* Desktop collapse toggle */}
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex p-1 rounded hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 transition"
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>

          {/* Mobile close button */}
          <button
            onClick={onCloseMobile}
            className="lg:hidden p-1 rounded hover:bg-neutral-100 text-neutral-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tenant status tag */}
        {!isCollapsed && (
          <div className="p-3 border-b border-neutral-100">
            <div className="px-3 py-2 rounded border border-neutral-200 bg-neutral-50 flex items-center justify-between text-xs">
              <span className="text-neutral-500 font-medium">Tenant</span>
              <span className="font-mono text-neutral-900 text-[11px] font-semibold">
                {tenantId === "t_acme" ? "Acme Corp" : "Globex Corp"}
              </span>
            </div>
          </div>
        )}

        {/* Navigation list */}
        <nav className="p-2 space-y-0.5">
          {!isCollapsed && (
            <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-semibold">
              Platform Views
            </div>
          )}
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onTabChange(item.id);
                  onCloseMobile();
                }}
                title={isCollapsed ? item.label : undefined}
                className={`w-full flex items-center ${
                  isCollapsed ? "justify-center px-2 py-2.5" : "justify-between px-3 py-2"
                } rounded text-xs transition ${
                  isActive
                    ? "bg-neutral-900 text-white font-semibold"
                    : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100/70"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-white" : "text-neutral-400"}`} />
                  {!isCollapsed && <span>{item.label}</span>}
                </div>
                {!isCollapsed && item.badge && (
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded-sm ${
                      item.badgeClass || "text-neutral-500"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer boundary info */}
      {!isCollapsed && (
        <div className="p-3 border-t border-neutral-200 text-[11px] font-mono">
          <div className="p-2.5 rounded border border-neutral-200 bg-neutral-50 space-y-1">
            <div className="flex items-center justify-between text-neutral-600 text-[10px]">
              <span>TRUST BOUNDARY</span>
              <span className="text-neutral-900 font-bold">ENFORCED</span>
            </div>
            <p className="text-[10px] text-neutral-500 leading-tight">
              Tier 1: Collector Local (8001)
              <br />
              Tier 2: SaaS Cloud (8000)
            </p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex flex-col border-r border-neutral-200 bg-white shrink-0 h-screen sticky top-0 transition-all duration-200 ${
          isCollapsed ? "w-16" : "w-60"
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile drawer overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative w-64 max-w-xs bg-white h-full z-10 shadow-2xl">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
