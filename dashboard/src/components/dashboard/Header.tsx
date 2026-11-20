"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Clock,
  RefreshCw,
  Search,
  Bell,
  Check,
  ChevronDown,
  Menu,
  Shield,
  Wifi,
  User,
  Zap,
} from "lucide-react";
import { TenantId, NotificationItem, TimeRange } from "@/types";

interface HeaderProps {
  tenantId: TenantId;
  onTenantChange: (tenant: TenantId) => void;
  onScenarioTrigger: (
    scenario: "normal" | "secret" | "cpu_spike" | "correlation" | "logins" | "outage"
  ) => void;
  onResetDemo: () => void;
  onOpenSearch: () => void;
  notifications: NotificationItem[];
  onMarkNotificationRead: (id: string) => void;
  onMarkAllNotificationsRead: () => void;
  timeRange: TimeRange;
  onTimeRangeChange: (tr: TimeRange) => void;
  onToggleMobileSidebar: () => void;
}

export default function Header({
  tenantId,
  onTenantChange,
  onScenarioTrigger,
  onResetDemo,
  onOpenSearch,
  notifications,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  timeRange,
  onTimeRangeChange,
  onToggleMobileSidebar,
}: HeaderProps) {
  const [timeUtc, setTimeUtc] = useState<string>("");
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTimeUtc(now.toISOString().slice(0, 19).replace("T", " ") + " UTC");
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifMenu(false);
      }
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="h-14 border-b border-neutral-200 bg-white px-4 sm:px-6 flex items-center justify-between shrink-0 sticky top-0 z-30 font-sans shadow-2xs">
      {/* Left: Mobile hamburger & Global Search Button */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileSidebar}
          className="lg:hidden p-1.5 rounded border border-neutral-200 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100"
          title="Toggle Navigation"
        >
          <Menu className="w-4 h-4" />
        </button>

        {/* Global Search input trigger */}
        <button
          onClick={onOpenSearch}
          className="flex items-center gap-2.5 px-3 py-1.5 rounded border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 text-neutral-500 text-xs transition w-44 sm:w-64 justify-between"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-neutral-400" />
            <span className="truncate">Search infrastructure...</span>
          </div>
          <kbd className="hidden sm:inline-block text-[10px] font-mono border border-neutral-200 px-1 rounded bg-white text-neutral-400">
            ⌘K
          </kbd>
        </button>

        {/* Time-Range Selector */}
        <div className="hidden md:flex items-center gap-1.5 pl-2 border-l border-neutral-200">
          <Clock className="w-3.5 h-3.5 text-neutral-400" />
          <select
            value={timeRange}
            onChange={(e) => onTimeRangeChange(e.target.value as TimeRange)}
            className="bg-transparent text-xs font-mono text-neutral-700 focus:outline-none cursor-pointer"
          >
            <option value="15m">Last 15 min</option>
            <option value="1h">Last 1 hour</option>
            <option value="6h">Last 6 hours</option>
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
          </select>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2.5">
        {/* Connection status */}
        <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded bg-neutral-50 border border-neutral-200 text-[11px] font-mono text-neutral-600">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>SaaS Ingest Live (4.2s)</span>
        </div>

        {/* Tenant selector */}
        <div className="flex items-center gap-1.5">
          <select
            value={tenantId}
            onChange={(e) => onTenantChange(e.target.value as TenantId)}
            className="bg-neutral-50 border border-neutral-200 text-neutral-900 text-xs font-semibold px-2 py-1 rounded focus:outline-none focus:border-neutral-400 cursor-pointer"
          >
            <option value="t_acme">Acme Corp (t_acme)</option>
            <option value="t_globex">Globex Corp (t_globex)</option>
          </select>
        </div>

        {/* Notification Bell Dropdown */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifMenu(!showNotifMenu)}
            className="relative p-1.5 rounded border border-neutral-200 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50 transition"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[9px] font-bold text-white font-mono">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifMenu && (
            <div className="absolute right-0 mt-2 w-80 rounded-lg border border-neutral-200 bg-white shadow-xl z-50 overflow-hidden text-xs">
              <div className="p-3 border-b border-neutral-100 flex items-center justify-between">
                <span className="font-bold text-neutral-900">Notifications</span>
                {unreadCount > 0 && (
                  <button
                    onClick={onMarkAllNotificationsRead}
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-neutral-100">
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-neutral-400">No notifications.</div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => onMarkNotificationRead(n.id)}
                      className={`p-3 cursor-pointer transition ${
                        !n.read ? "bg-blue-50/40" : "hover:bg-neutral-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1 mb-0.5">
                        <span
                          className={`font-semibold ${
                            n.type === "critical"
                              ? "text-rose-950"
                              : n.type === "security"
                              ? "text-amber-950"
                              : "text-neutral-900"
                          }`}
                        >
                          {n.title}
                        </span>
                        <span className="text-[10px] text-neutral-400 shrink-0 font-mono">
                          {n.timestamp}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-600 leading-snug">{n.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Demo Scenarios selector */}
        <div className="hidden sm:flex items-center gap-1.5">
          <select
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) {
                onScenarioTrigger(
                  e.target.value as
                    | "normal"
                    | "secret"
                    | "cpu_spike"
                    | "correlation"
                    | "logins"
                    | "outage"
                );
                e.target.value = "";
              }
            }}
            className="bg-neutral-50 border border-neutral-200 text-xs font-mono text-neutral-800 px-2 py-1 rounded focus:outline-none focus:border-neutral-400 cursor-pointer"
          >
            <option value="" disabled>
              Scenario...
            </option>
            <option value="normal">1. Normal (All OK)</option>
            <option value="secret">2. Secret in Log (Redacted)</option>
            <option value="cpu_spike">3. CPU Anomaly (Critical)</option>
            <option value="correlation">4. Correlation & Rec</option>
            <option value="logins">5. Failed Logins Burst</option>
            <option value="outage">6. Outage & Buffer Drain</option>
          </select>
        </div>

        {/* Reset button */}
        <button
          onClick={onResetDemo}
          title="Reset baseline"
          className="flex items-center gap-1 px-2.5 py-1 rounded border border-neutral-200 bg-neutral-50 text-xs font-mono text-neutral-600 hover:text-neutral-900 hover:border-neutral-300 transition"
        >
          <RefreshCw className="w-3 h-3" />
        </button>

        {/* User profile menu */}
        <div className="relative" ref={userRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-1.5 p-1 rounded hover:bg-neutral-100 transition"
          >
            <div className="h-7 w-7 rounded-full bg-neutral-900 text-white flex items-center justify-center text-xs font-bold font-mono">
              MO
            </div>
            <ChevronDown className="w-3 h-3 text-neutral-500 hidden sm:inline" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-52 rounded-lg border border-neutral-200 bg-white shadow-xl z-50 p-2 text-xs">
              <div className="p-2 border-b border-neutral-100 mb-1">
                <div className="font-bold text-neutral-900">Mujeeb · SecOps</div>
                <div className="text-[10px] text-neutral-500 font-mono">Role: Enterprise Admin</div>
              </div>
              <div className="p-2 text-neutral-600 space-y-1">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span>Tenant Scope:</span>
                  <span className="font-semibold text-neutral-900">{tenantId}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span>RLS Security:</span>
                  <span className="text-emerald-700 font-bold">Enforced</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
