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
    <div className="pt-3 px-3 lg:pt-5 lg:px-6">
      <header className="card flex items-center gap-3 px-3 lg:px-4 py-2.5 lg:py-3">
        {/* Mobile menu */}
        <button
          onClick={onToggleMobileSidebar}
          className="lg:hidden h-9 w-9 rounded-xl border border-hairline flex items-center justify-center text-ink-soft"
        >
          <Menu className="w-4 h-4" />
        </button>

        {/* Search pill */}
        <button
          onClick={onOpenSearch}
          className="flex-1 min-w-[180px] flex items-center gap-2.5 h-10 lg:h-11 px-4 rounded-full bg-canvas/60 border border-hairline text-ink-soft hover:border-brand-200 transition"
        >
          <Search className="w-4 h-4" />
          <span className="truncate text-sm">Search sources, incidents, payloads…</span>
          <span className="ml-auto hidden sm:inline text-[10px] font-mono text-ink-soft/60 border border-hairline rounded-md px-1.5 py-0.5">
            ⌘K
          </span>
        </button>

        {/* Time range */}
        <div className="hidden md:flex items-center gap-1.5 h-10 px-3 rounded-full border border-hairline text-xs text-ink-soft">
          <Clock className="w-3.5 h-3.5" />
          <select
            value={timeRange}
            onChange={(e) => onTimeRangeChange(e.target.value as TimeRange)}
            aria-label="Time range"
            className="bg-transparent focus:outline-none cursor-pointer"
          >
            <option value="15m">Last 15 min</option>
            <option value="1h">Last 1 hour</option>
            <option value="6h">Last 6 hours</option>
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
          </select>
        </div>

        {/* Live status pill */}
        <div
          className={`hidden md:flex items-center gap-2 h-10 px-3 rounded-full text-[11px] font-semibold uppercase tracking-wide ${
            backend.live
              ? "bg-brand-50 text-brand-800 border border-brand-100"
              : "bg-amber-50 text-amber-800 border border-amber-100"
          }`}
          title={
            backend.live
              ? `Backend live · storage ${backend.storage ?? "?"} · collector ${backend.collectorReachable ? "reachable" : "offline"}`
              : "Backend offline — showing sample data"
          }
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${backend.live ? "bg-brand-600 animate-pulse" : "bg-amber-500"}`}
          />
          {backend.live ? `Live · ${backend.storage === "supabase" ? "Supabase" : backend.storage ?? "SaaS"}` : "Sample data"}
        </div>

        {/* Running-scenario chip */}
        {(scenarioMessage || backend.scenario) && (
          <div className="hidden xl:block max-w-[220px] truncate text-[11px] text-brand-800 bg-brand-50 border border-brand-100 rounded-full px-3 py-2">
            {scenarioMessage ?? `Running: ${backend.scenario} · ${backend.secondsLeft}s`}
          </div>
        )}

        {/* Scenario menu */}
        <div className="hidden sm:block">
          <select
            defaultValue=""
            aria-label="Inject scenario"
            onChange={(e) => {
              if (e.target.value) {
                onScenarioTrigger(e.target.value as ScenarioId);
                e.target.value = "";
              }
            }}
            className="h-10 pl-4 pr-8 rounded-full text-xs font-semibold text-white bg-brand-700 hover:bg-brand-800 cursor-pointer focus:outline-none"
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
        </div>

        {/* Reset */}
        <button
          onClick={onResetDemo}
          title="Reset baseline"
          className="h-10 w-10 rounded-full border border-hairline flex items-center justify-center text-ink-soft hover:text-ink hover:bg-brand-50/60"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        {/* Tenant pill */}
        <div className="hidden xl:flex items-center gap-2 h-10 pl-3 pr-2 rounded-full border border-hairline">
          <span className="text-[11px] font-semibold text-ink">
            {tenantId === "t_acme" ? "Acme Corp" : "Globex Corp"}
          </span>
          <select
            value={tenantId}
            disabled={tenantLocked}
            title={tenantLocked ? "Signed in: your account can only see its own tenant (RLS)" : "Switch tenant"}
            onChange={(e) => onTenantChange(e.target.value as TenantId)}
            aria-label="Tenant"
            className="text-[11px] font-semibold text-ink bg-transparent focus:outline-none cursor-pointer"
          >
            <option value="t_acme">(t_acme)</option>
            <option value="t_globex">(t_globex)</option>
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-ink-soft" />
        </div>

        {/* Mail (decorative) */}
        <button
          className="hidden lg:flex h-10 w-10 rounded-full border border-hairline items-center justify-center text-ink-soft hover:text-ink hover:bg-brand-50/60"
          title="Messages"
        >
          <Mail className="w-4 h-4" />
        </button>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotif((v) => !v)}
            className="relative h-10 w-10 rounded-full border border-hairline flex items-center justify-center text-ink-soft hover:text-ink hover:bg-brand-50/60"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-brand-700 text-[10px] font-semibold text-white flex items-center justify-center">
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
                  className="text-xs text-brand-800 hover:underline"
                >
                  Mark all read
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-6 text-xs text-ink-soft text-center">No alerts yet.</div>
                ) : (
                  notifications.slice(0, 10).map((n) => (
                    <button
                      key={n.id}
                      onClick={() => onMarkNotificationRead(n.id)}
                      className={`w-full text-left px-4 py-2.5 border-b border-hairline/60 hover:bg-brand-50/60 ${
                        n.read ? "opacity-70" : ""
                      }`}
                    >
                      <div className="text-xs font-semibold text-ink truncate">{n.title}</div>
                      <div className="text-[11px] text-ink-soft line-clamp-2">{n.message}</div>
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
            className="flex items-center gap-2 h-11 pl-1 pr-3 rounded-full border border-hairline hover:bg-brand-50/60"
          >
            <span className="h-9 w-9 rounded-full bg-brand-700 text-white text-xs font-bold flex items-center justify-center">
              {initials}
            </span>
            <span className="hidden sm:block text-left leading-tight">
              <div className="text-xs font-semibold text-ink">
                {userEmail ? userEmail.split("@")[0] : "Demo operator"}
              </div>
              <div className="text-[10px] text-ink-soft">
                {userEmail ? "Signed in" : "Demo mode"}
              </div>
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-ink-soft hidden sm:inline" />
          </button>
          {showUser && (
            <div className="absolute right-0 mt-2 w-60 rounded-2xl bg-surface shadow-cardLg border border-hairline overflow-hidden z-50 p-2 text-sm">
              <div className="px-3 py-2">
                <div className="font-semibold text-ink truncate">
                  {userEmail ?? "Demo operator"}
                </div>
                <div className="text-[11px] text-ink-soft">
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
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-brand-50/60 text-ink"
                  >
                    Sign out
                  </button>
                ) : (
                  <a
                    href="/login"
                    className="block px-3 py-2 rounded-xl hover:bg-brand-50/60 text-ink"
                  >
                    Sign in with tenant account
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </header>
    </div>
  );
}
