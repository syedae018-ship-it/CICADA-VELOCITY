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
  Settings,
  LifeBuoy,
  LogOut,
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
  onSignOut?: () => void;
}

interface NavItem {
  id: DashboardTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | null;
  badgeKind?: "count" | "soft";
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
  onSignOut,
}: SidebarProps) {
  const platform: NavItem[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "sources", label: "Sources", icon: Layers },
    { id: "fleet", label: "Fleet", icon: Server },
    {
      id: "incidents",
      label: "Incidents",
      icon: AlertTriangle,
      badge: openIncidentsCount > 0 ? `${openIncidentsCount}` : null,
      badgeKind: "count",
    },
    { id: "ai_insights", label: "AI Insights", icon: Sparkles, badge: "AIOps", badgeKind: "soft" },
    { id: "egress", label: "Egress Proof", icon: ShieldCheck, badge: "T1→2", badgeKind: "soft" },
  ];

  const general: NavItem[] = [
    { id: "privacy", label: "Privacy Side-by-Side", icon: EyeOff, badge: "0 leaks", badgeKind: "soft" },
    { id: "reliability", label: "Reliability", icon: Activity, badge: "<10s", badgeKind: "soft" },
    { id: "timeline", label: "Timeline", icon: Clock },
    { id: "history", label: "State History", icon: History },
    { id: "reports", label: "Reports", icon: FileDown, badge: "CSV", badgeKind: "soft" },
  ];

  const NavSection = ({ title, items }: { title: string; items: NavItem[] }) => (
    <div className="mb-5">
      {!isCollapsed && (
        <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft/70">
          {title}
        </div>
      )}
      <div className="space-y-1">
        {items.map((item) => {
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
              className={`relative w-full flex items-center ${
                isCollapsed ? "justify-center px-2 py-2.5" : "justify-between pl-4 pr-3 py-2.5"
              } rounded-xl text-sm transition group ${
                isActive
                  ? "bg-brand-700 text-white font-semibold shadow-sm"
                  : "text-ink-soft hover:text-ink hover:bg-brand-50/70"
              }`}
            >
              {isActive && !isCollapsed && (
                <span
                  aria-hidden
                  className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r bg-brand-mint"
                />
              )}
              <div className="flex items-center gap-3">
                <Icon
                  className={`w-[18px] h-[18px] shrink-0 ${
                    isActive ? "text-white" : "text-ink-soft group-hover:text-brand-700"
                  }`}
                />
                {!isCollapsed && <span className="truncate">{item.label}</span>}
              </div>
              {!isCollapsed && item.badge && (
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                    item.badgeKind === "count"
                      ? isActive
                        ? "bg-white text-brand-700"
                        : "bg-brand-700 text-white"
                      : isActive
                      ? "bg-brand-800/60 text-brand-50"
                      : "bg-brand-50 text-brand-700"
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  const content = (
    <div className="flex flex-col h-full">
      {/* Brand mark */}
      <div className={`px-5 pt-5 pb-4 flex items-center ${isCollapsed ? "justify-center" : "justify-between"}`}>
        <div className="flex items-center gap-2.5">
          <div className="relative h-9 w-9 rounded-2xl bg-brand-600 flex items-center justify-center shadow-sm">
            <div className="h-5 w-5 rounded-full border-[2.5px] border-white border-b-transparent rotate-45" />
          </div>
          {!isCollapsed && (
            <div className="leading-tight">
              <div className="font-bold text-ink text-base tracking-tight">Velocity</div>
              <div className="font-medium text-ink-soft text-[10px] uppercase tracking-[0.2em]">Cicada</div>
            </div>
          )}
        </div>

        {!isCollapsed && (
          <button
            onClick={onCloseMobile}
            className="lg:hidden p-1 rounded-full hover:bg-brand-50 text-ink-soft"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Tenant chip */}
      {!isCollapsed && (
        <div className="mx-4 mb-4 px-3 py-2 rounded-xl bg-brand-50/60 border border-brand-100 flex items-center justify-between text-xs">
          <span className="text-ink-soft font-medium">Tenant</span>
          <span className="font-semibold text-brand-800">
            {tenantId === "t_acme" ? "Acme Corp" : "Globex Corp"}
          </span>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 overflow-y-auto">
        <NavSection title="Menu" items={platform} />
        <NavSection title="General" items={general} />
      </nav>

      {/* Mini settings row */}
      {!isCollapsed && (
        <div className="px-3 pb-3 space-y-1">
          <button
            className="w-full flex items-center gap-3 pl-4 pr-3 py-2.5 rounded-xl text-sm text-ink-soft hover:text-ink hover:bg-brand-50/70 transition"
            title="Settings — coming soon"
          >
            <Settings className="w-[18px] h-[18px]" />
            Settings
          </button>
          <button
            className="w-full flex items-center gap-3 pl-4 pr-3 py-2.5 rounded-xl text-sm text-ink-soft hover:text-ink hover:bg-brand-50/70 transition"
            title="Help & docs"
          >
            <LifeBuoy className="w-[18px] h-[18px]" />
            Help
          </button>
          {onSignOut && (
            <button
              onClick={onSignOut}
              className="w-full flex items-center gap-3 pl-4 pr-3 py-2.5 rounded-xl text-sm text-ink-soft hover:text-ink hover:bg-brand-50/70 transition"
            >
              <LogOut className="w-[18px] h-[18px]" />
              Sign out
            </button>
          )}
        </div>
      )}

      {/* Footer promo card */}
      {!isCollapsed && (
        <div className="m-3 relative overflow-hidden rounded-2xl p-4 text-white bg-gradient-to-br from-brand-800 via-brand-700 to-brand-600">
          <div
            aria-hidden
            className="absolute -right-10 -bottom-10 h-40 w-40 rounded-full border-2 border-white/15"
          />
          <div className="relative">
            <div className="h-8 w-8 rounded-full bg-white/15 flex items-center justify-center mb-3">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div className="text-sm font-semibold leading-tight">
              Trust boundary <br /> enforced on every payload
            </div>
            <div className="text-[11px] text-white/80 mt-1.5">
              Raw telemetry never leaves Tier&nbsp;1.
            </div>
            <div className="mt-3 text-[10px] font-mono text-white/70">
              Collector :8001 · SaaS :8000
            </div>
          </div>
        </div>
      )}

      {/* Desktop collapse toggle */}
      <button
        onClick={onToggleCollapse}
        className="hidden lg:flex items-center justify-center gap-1 mx-3 mb-3 py-1.5 rounded-xl text-[11px] text-ink-soft hover:text-ink hover:bg-brand-50/70 border border-hairline"
        title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : (
          <>
            <ChevronLeft className="w-3.5 h-3.5" /> Collapse
          </>
        )}
      </button>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar: a floating white card */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 h-[calc(100vh-1.5rem)] my-3 ml-3 rounded-[1.5rem] bg-surface shadow-card sticky top-3 transition-[width] duration-200 ${
          isCollapsed ? "w-[76px]" : "w-[232px]"
        }`}
      >
        {content}
      </aside>

      {/* Mobile drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-ink/40 backdrop-blur-sm"
            onClick={onCloseMobile}
          />
          <div className="relative w-[260px] bg-surface h-full z-10 shadow-cardLg rounded-r-3xl">
            {content}
          </div>
        </div>
      )}
    </>
  );
}
