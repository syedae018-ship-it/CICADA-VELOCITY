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
  Shield,
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
    <div className="mb-6">
      {!isCollapsed && (
        <div className="px-4 pb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-muted">
          {title}
        </div>
      )}
      <div className="space-y-0.5">
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
                isCollapsed ? "justify-center px-2 py-3" : "justify-between pl-5 pr-3 py-2.5"
              } rounded-xl text-[13.5px] transition group ${
                isActive
                  ? "bg-brand-800 text-white font-semibold"
                  : "text-ink-soft hover:text-ink hover:bg-canvas-deep/80"
              }`}
            >
              {isActive && !isCollapsed && (
                <span
                  aria-hidden
                  className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-brand-mint"
                />
              )}
              <div className="flex items-center gap-3">
                <Icon
                  className={`w-[18px] h-[18px] shrink-0 icon-sharp ${
                    isActive ? "text-brand-mint" : "text-ink-muted group-hover:text-brand-700"
                  }`}
                />
                {!isCollapsed && <span className="truncate">{item.label}</span>}
              </div>
              {!isCollapsed && item.badge && (
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
                    item.badgeKind === "count"
                      ? isActive
                        ? "bg-brand-mint text-brand-900"
                        : "bg-brand-800 text-white"
                      : isActive
                      ? "bg-white/15 text-brand-mint"
                      : "bg-brand-chip text-brand-800 border border-[#d5e6b4]"
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
      {/* Brand mark — big, confident */}
      <div className={`px-6 pt-7 pb-6 flex items-center ${isCollapsed ? "justify-center px-2" : "justify-between"}`}>
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 rounded-[14px] bg-gradient-to-br from-brand-600 to-brand-800 flex items-center justify-center shadow-sm">
            <div className="h-5 w-5 rounded-full border-[2.5px] border-brand-mint border-b-transparent rotate-45" />
          </div>
          {!isCollapsed && (
            <div className="leading-[1.1]">
              <div className="font-bold text-ink text-[17px] tracking-tight">Velocity</div>
              <div className="font-medium text-ink-muted text-[10px] uppercase tracking-[0.22em] mt-0.5">Cicada</div>
            </div>
          )}
        </div>

        {!isCollapsed && (
          <button
            onClick={onCloseMobile}
            className="lg:hidden p-1 rounded-full hover:bg-canvas-deep text-ink-soft"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Tenant chip — a small pill card */}
      {!isCollapsed && (
        <div className="mx-5 mb-5 px-3.5 py-2.5 rounded-xl bg-white border border-hairline flex items-center justify-between">
          <span className="text-[11px] text-ink-muted font-medium uppercase tracking-wider">Tenant</span>
          <span className="text-[12px] font-semibold text-ink">
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
        <div className="px-3 pb-4 space-y-0.5">
          <button
            className="w-full flex items-center gap-3 pl-5 pr-3 py-2.5 rounded-xl text-[13.5px] text-ink-soft hover:text-ink hover:bg-canvas-deep/80 transition"
            title="Settings — coming soon"
          >
            <Settings className="w-[18px] h-[18px] icon-sharp text-ink-muted" />
            Settings
          </button>
          <button
            className="w-full flex items-center gap-3 pl-5 pr-3 py-2.5 rounded-xl text-[13.5px] text-ink-soft hover:text-ink hover:bg-canvas-deep/80 transition"
            title="Help & docs"
          >
            <LifeBuoy className="w-[18px] h-[18px] icon-sharp text-ink-muted" />
            Help
          </button>
          {onSignOut && (
            <button
              onClick={onSignOut}
              className="w-full flex items-center gap-3 pl-5 pr-3 py-2.5 rounded-xl text-[13.5px] text-ink-soft hover:text-ink hover:bg-canvas-deep/80 transition"
            >
              <LogOut className="w-[18px] h-[18px] icon-sharp text-ink-muted" />
              Sign out
            </button>
          )}
        </div>
      )}

      {/* Footer promo card — rich forest gradient */}
      {!isCollapsed && (
        <div
          className="m-4 relative overflow-hidden rounded-2xl p-5 text-white"
          style={{
            background:
              "radial-gradient(130% 110% at 20% 20%, #176534 0%, #0a3a1e 55%, #062715 100%)",
          }}
        >
          <div className="ring-deco -right-12 -bottom-14 h-44 w-44" />
          <div className="ring-deco -right-20 -top-16 h-56 w-56" />
          <div className="relative">
            <div className="h-9 w-9 rounded-full bg-brand-mint/20 flex items-center justify-center mb-4 backdrop-blur-sm">
              <Shield className="h-4 w-4 text-brand-mint" />
            </div>
            <div className="text-[14px] font-semibold leading-snug">
              Trust boundary enforced
            </div>
            <div className="text-[11.5px] text-white/75 mt-1.5 leading-relaxed">
              Raw telemetry never leaves Tier&nbsp;1. SaaS receives metadata only.
            </div>
            <div className="mt-4 text-[10px] font-mono text-brand-mint/70 uppercase tracking-wider">
              :8001 → :8000
            </div>
          </div>
        </div>
      )}

      {/* Desktop collapse toggle */}
      <button
        onClick={onToggleCollapse}
        className="hidden lg:flex items-center justify-center gap-1.5 mx-4 mb-4 py-2 rounded-xl text-[11px] font-medium text-ink-muted hover:text-ink hover:bg-canvas-deep/80 border border-hairline"
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
      {/* Desktop sidebar: part of the page, not a floating card */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 h-screen sticky top-0 transition-[width] duration-200 bg-canvas ${
          isCollapsed ? "w-[80px]" : "w-[260px]"
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
          <div className="relative w-[280px] bg-canvas h-full z-10 shadow-cardLg">
            {content}
          </div>
        </div>
      )}
    </>
  );
}
