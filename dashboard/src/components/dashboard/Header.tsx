"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Clock,
  RefreshCw,
  Search,
  Bell,
  ChevronDown,
  Menu,
  Mail,
  Shield,
} from "lucide-react";
import {
  TenantId,
  NotificationItem,
  TimeRange,
  ScenarioId,
  SCENARIOS,
  BackendStatus,
} from "@/types";

interface HeaderProps {
  tenantId: TenantId;
  onTenantChange: (tenant: TenantId) => void;
  onScenarioTrigger: (scenario: ScenarioId) => void;
  backend: BackendStatus;
  scenarioMessage: string | null;
  onResetDemo: () => void;
  onOpenSearch: () => void;
  notifications: NotificationItem[];
  onMarkNotificationRead: (id: string) => void;
  onMarkAllNotificationsRead: () => void;
  timeRange: TimeRange;
  onTimeRangeChange: (tr: TimeRange) => void;
  onToggleMobileSidebar: () => void;
  userEmail: string | null;
  tenantLocked: boolean;
  onSignOut: () => void;
}

export default function Header({
  tenantId,
  onTenantChange,
  onScenarioTrigger,
  backend,
  scenarioMessage,
  onResetDemo,
  onOpenSearch,
  notifications,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  timeRange,
  onTimeRangeChange,
  onToggleMobileSidebar,
  userEmail,
  tenantLocked,
  onSignOut,
}: HeaderProps) {
  const [showNotif, setShowNotif] = useState(false);
  const [showUser, setShowUser] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);
  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const click = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotif(false);
      if (userRef.current && !userRef.current.contains(e.target as Node)) setShowUser(false);
    };
    document.addEventListener("mousedown", click);
    return () => document.removeEventListener("mousedown", click);
  }, []);

  const initials = (userEmail ?? "Demo").split("@")[0].slice(0, 2).toUpperCase();

  return (
    <header className="card flex items-center gap-2.5 px-3 lg:px-4 py-3">
      {/* Mobile menu */}
      <button
        onClick={onToggleMobileSidebar}
        className="lg:hidden h-11 w-11 rounded-full border border-hairline flex items-center justify-center text-ink-soft"
      >
        <Menu className="w-4 h-4" />
      </button>

      {/* Search pill */}
      <button
        onClick={onOpenSearch}
        className="flex-1 min-w-[160px] flex items-center gap-3 h-12 px-5 rounded-full bg-canvas/70 border border-hairline text-ink-muted hover:border-brand-200 hover:bg-canvas transition"
      >
        <Search className="w-[18px] h-[18px] icon-sharp" />
        <span className="truncate text-[13.5px]">Search sources, incidents, payloads…</span>
        <span className="ml-auto hidden sm:inline text-[10px] font-mono text-ink-muted border border-hairline rounded-md px-1.5 py-0.5 bg-white">
          ⌘K
        </span>
      </button>

      {/* Time range */}
      <div className="hidden md:flex items-center gap-2 h-12 pl-4 pr-3 rounded-full border border-hairline text-[13px] text-ink-soft hover:border-brand-200 transition">
        <Clock className="w-[16px] h-[16px] icon-sharp" />
        <select
          value={timeRange}
          onChange={(e) => onTimeRangeChange(e.target.value as TimeRange)}
          aria-label="Time range"
          className="bg-transparent focus:outline-none cursor-pointer font-medium pr-1"
        >
          <option value="15m">Last 15 min</option>
          <option value="1h">Last 1 hour</option>
          <option value="6h">Last 6 hours</option>
          <option value="24h">Last 24 hours</option>
          <option value="7d">Last 7 days</option>
        </select>
        <ChevronDown className="w-3.5 h-3.5 text-ink-muted" />
      </div>

      {/* Live status pill */}
      <div
        className={`hidden lg:flex items-center gap-2 h-12 px-4 rounded-full text-[11px] font-semibold uppercase tracking-wide ${
          backend.live
            ? "bg-brand-chip text-brand-800 border border-[#d5e6b4]"
            : "bg-warn-50 text-warn-700 border border-warn-100"
        }`}
        title={
          backend.live
            ? `Backend live · storage ${backend.storage ?? "?"} · collector ${backend.collectorReachable ? "reachable" : "offline"}`
            : "Backend offline — showing sample data"
        }
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${backend.live ? "bg-brand-700 animate-pulse" : "bg-amber-500"}`}
        />
        {backend.live ? `Live · ${backend.storage === "supabase" ? "Supabase" : backend.storage ?? "SaaS"}` : "Sample data"}
      </div>

      {/* Scenario menu */}
      <div className="hidden sm:block relative">
        <select
          defaultValue=""
          aria-label="Inject scenario"
          onChange={(e) => {
            if (e.target.value) {
              onScenarioTrigger(e.target.value as ScenarioId);
              e.target.value = "";
            }
          }}
          className="h-12 pl-5 pr-12 rounded-full text-[13px] font-semibold text-white bg-brand-700 hover:bg-brand-800 cursor-pointer focus:outline-none shadow-[0_6px_14px_-8px_rgba(16,79,42,0.5)] transition"
        >
          <option value="" disabled className="text-ink">
            {backend.live ? "Inject scenario" : "Scenario (sample)"}
          </option>
          {SCENARIOS.map((s, i) => (
            <option key={s.id} value={s.id} className="text-ink">
              {i + 1}. {s.label}
            </option>
          ))}
        </select>
        <ChevronDown className="w-3.5 h-3.5 text-white/80 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>

      {/* Reset */}
      <button
        onClick={onResetDemo}
        title="Reset baseline"
        className="h-12 w-12 rounded-full border border-hairline flex items-center justify-center text-ink-soft hover:text-brand-800 hover:bg-canvas/60 transition"
      >
        <RefreshCw className="w-4 h-4 icon-sharp" />
      </button>

      {/* Tenant pill */}
      <div className="hidden xl:flex items-center gap-2 h-12 pl-4 pr-2 rounded-full border border-hairline hover:border-brand-200 transition">
        <span className="text-[12.5px] font-semibold text-ink">
          {tenantId === "t_acme" ? "Acme Corp" : "Globex Corp"}
        </span>
        <select
          value={tenantId}
          disabled={tenantLocked}
          title={tenantLocked ? "Signed in: your account can only see its own tenant (RLS)" : "Switch tenant"}
          onChange={(e) => onTenantChange(e.target.value as TenantId)}
          aria-label="Tenant"
          className="text-[11px] font-mono text-ink-muted bg-transparent focus:outline-none cursor-pointer"
        >
          <option value="t_acme">t_acme</option>
          <option value="t_globex">t_globex</option>
        </select>
        <ChevronDown className="w-3.5 h-3.5 text-ink-muted" />
      </div>

      {/* Mail */}
      <button
        className="hidden lg:flex h-12 w-12 rounded-full border border-hairline items-center justify-center text-ink-soft hover:text-brand-800 hover:bg-canvas/60 transition"
        title="Messages"
      >
        <Mail className="w-4 h-4 icon-sharp" />
      </button>

      {/* Notifications */}
      <div className="relative" ref={notifRef}>
        <button
          onClick={() => setShowNotif((v) => !v)}
          className="relative h-12 w-12 rounded-full border border-hairline flex items-center justify-center text-ink-soft hover:text-brand-800 hover:bg-canvas/60 transition"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4 icon-sharp" />
          {unread > 0 && (
            <span className="absolute top-1 right-1 h-4 min-w-4 px-1 rounded-full bg-brand-700 text-[10px] font-semibold text-white flex items-center justify-center">
              {unread}
            </span>
          )}
        </button>
        {showNotif && (
          <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-surface shadow-cardLg border border-hairline overflow-hidden z-50">
            <div className="flex items-center justify-between px-4 py-3 border-b border-hairline">
              <div className="text-sm font-semibold">Notifications</div>
              <button
                onClick={onMarkAllNotificationsRead}
                className="text-xs text-brand-800 hover:underline font-medium"
              >
                Mark all read
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-xs text-ink-muted text-center">No alerts yet.</div>
              ) : (
                notifications.slice(0, 10).map((n) => (
                  <button
                    key={n.id}
                    onClick={() => onMarkNotificationRead(n.id)}
                    className={`w-full text-left px-4 py-2.5 border-b border-hairline/60 hover:bg-canvas/60 transition ${
                      n.read ? "opacity-70" : ""
                    }`}
                  >
                    <div className="text-xs font-semibold text-ink truncate">{n.title}</div>
                    <div className="text-[11px] text-ink-muted line-clamp-2">{n.message}</div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* User */}
      <div className="relative" ref={userRef}>
        <button
          onClick={() => setShowUser((v) => !v)}
          className="flex items-center gap-2.5 h-12 pl-1 pr-3 rounded-full border border-hairline hover:border-brand-200 transition"
        >
          <span className="h-10 w-10 rounded-full bg-gradient-to-br from-brand-600 to-brand-800 text-brand-mint text-xs font-bold flex items-center justify-center">
            {initials}
          </span>
          <span className="hidden sm:block text-left leading-tight pr-1">
            <div className="text-[12.5px] font-semibold text-ink">
              {userEmail ? userEmail.split("@")[0] : "Demo operator"}
            </div>
            <div className="text-[10px] text-ink-muted">
              {userEmail ? userEmail : "demo mode"}
            </div>
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-ink-muted hidden sm:inline" />
        </button>
        {showUser && (
          <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-surface shadow-cardLg border border-hairline overflow-hidden z-50 p-2 text-sm">
            <div className="px-3 py-2.5">
              <div className="font-semibold text-ink truncate">
                {userEmail ?? "Demo operator"}
              </div>
              <div className="text-[11px] text-ink-muted">
                {userEmail ? "Supabase Auth" : "Dev tokens"}
              </div>
            </div>
            <div className="px-3 py-2 text-[11px] text-ink-soft flex items-center gap-2 border-t border-hairline/60">
              <Shield className="w-3.5 h-3.5 text-brand-700" />
              RLS enforced on every query
            </div>
            <div className="border-t border-hairline/60 pt-1">
              {userEmail ? (
                <button
                  onClick={onSignOut}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-canvas/60 text-ink transition"
                >
                  Sign out
                </button>
              ) : (
                <a
                  href="/login"
                  className="block px-3 py-2 rounded-xl hover:bg-canvas/60 text-ink transition"
                >
                  Sign in with tenant account
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
