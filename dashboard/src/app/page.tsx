"use client";

import React, { useState } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import Header from "@/components/dashboard/Header";
import GlobalSearchModal from "@/components/dashboard/GlobalSearchModal";
import SourceDetailDrawer from "@/components/dashboard/SourceDetailDrawer";

import OverviewView from "@/components/dashboard/views/OverviewView";
import SourcesView from "@/components/dashboard/views/SourcesView";
import FleetView from "@/components/dashboard/views/FleetView";
import IncidentsView from "@/components/dashboard/views/IncidentsView";
import AIInsightsView from "@/components/dashboard/views/AIInsightsView";
import EgressProofView from "@/components/dashboard/views/EgressProofView";
import PrivacySideBySideView from "@/components/dashboard/views/PrivacySideBySideView";
import ReliabilityView from "@/components/dashboard/views/ReliabilityView";
import TimelineView from "@/components/dashboard/views/TimelineView";
import HistoryView from "@/components/dashboard/views/HistoryView";
import ReportsView from "@/components/dashboard/views/ReportsView";

import { dataStore } from "@/lib/api";
import { DashboardTab, TenantId, MonitoredSource, TimeRange } from "@/types";

export default function DashboardPage() {
  const [currentTab, setCurrentTab] = useState<DashboardTab>("overview");
  const [tenantId, setTenantId] = useState<TenantId>("t_acme");
  const [refreshKey, setRefreshKey] = useState<number>(0);

  // Layout states
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState<boolean>(false);
  const [selectedSourceForDetail, setSelectedSourceForDetail] = useState<MonitoredSource | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>("15m");

  const triggerRefresh = () => setRefreshKey((prev) => prev + 1);

  // Fetch current state from data store
  const sources = dataStore.getSources(tenantId);
  const collectors = dataStore.getCollectors(tenantId);
  const incidents = dataStore.getIncidents(tenantId);
  const alerts = dataStore.getAlerts(tenantId);
  const recommendations = dataStore.getRecommendations(tenantId);
  const egress = dataStore.getEgress(tenantId);
  const rawRecords = dataStore.getRaw();
  const reliability = dataStore.getReliability(tenantId);
  const healthHistory = dataStore.getHealthHistory(tenantId);
  const auditLog = dataStore.getAudit(tenantId);
  const notifications = dataStore.getNotifications(tenantId);
  const timelineEvents = dataStore.getTimeline(tenantId);

  // Scenario trigger handler
  const handleScenario = (
    scenario: "normal" | "secret" | "cpu_spike" | "correlation" | "logins" | "outage"
  ) => {
    dataStore.applyScenario(scenario, tenantId);
    if (scenario === "secret") {
      setCurrentTab("privacy");
    } else if (scenario === "correlation" || scenario === "cpu_spike") {
      setCurrentTab("incidents");
    } else if (scenario === "outage") {
      setCurrentTab("fleet");
    } else if (scenario === "normal") {
      setCurrentTab("overview");
    }
    triggerRefresh();
  };

  const handleApprove = (recId: string) => {
    dataStore.approveRecommendation(recId, tenantId);
    triggerRefresh();
  };

  const handleRollback = (recId: string) => {
    dataStore.rollbackRecommendation(recId, tenantId);
    triggerRefresh();
  };

  const handleReset = () => {
    dataStore.resetStore();
    triggerRefresh();
  };

  const handleNavigateFromSearch = (tab: DashboardTab, entityId?: string) => {
    setCurrentTab(tab);
    if (entityId && tab === "sources") {
      const src = sources.find((s) => s.source_id === entityId);
      if (src) setSelectedSourceForDetail(src);
    }
  };

  return (
    <div className="min-h-screen flex bg-neutral-50/50 text-neutral-900 font-sans">
      {/* Sidebar with Desktop Collapse & Mobile Drawer */}
      <Sidebar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        tenantId={tenantId}
        openIncidentsCount={incidents.length}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          tenantId={tenantId}
          onTenantChange={(t) => {
            setTenantId(t);
            setSelectedSourceForDetail(null);
            triggerRefresh();
          }}
          onScenarioTrigger={handleScenario}
          onResetDemo={handleReset}
          onOpenSearch={() => setIsSearchModalOpen(true)}
          notifications={notifications}
          onMarkNotificationRead={(id) => {
            dataStore.markNotificationRead(tenantId, id);
            triggerRefresh();
          }}
          onMarkAllNotificationsRead={() => {
            dataStore.markAllNotificationsRead(tenantId);
            triggerRefresh();
          }}
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
        />

        <main className="flex-1 p-5 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {currentTab === "overview" && (
            <OverviewView
              sources={sources}
              collectors={collectors}
              incidents={incidents}
              recommendations={recommendations}
              onSelectTab={setCurrentTab}
              onSelectSource={setSelectedSourceForDetail}
            />
          )}

          {currentTab === "sources" && (
            <SourcesView
              sources={sources}
              onSelectSource={setSelectedSourceForDetail}
            />
          )}

          {currentTab === "fleet" && <FleetView collectors={collectors} />}

          {currentTab === "incidents" && (
            <IncidentsView
              tenantId={tenantId}
              incidents={incidents}
              alerts={alerts}
              recommendations={recommendations}
              auditLog={auditLog}
              onApprove={handleApprove}
              onRollback={handleRollback}
            />
          )}

          {currentTab === "ai_insights" && (
            <AIInsightsView
              tenantId={tenantId}
              recommendations={recommendations}
              alerts={alerts}
              incidents={incidents}
              onApprove={handleApprove}
              onRollback={handleRollback}
              onSelectTab={setCurrentTab}
            />
          )}

          {currentTab === "egress" && (
            <EgressProofView tenantId={tenantId} egressPayloads={egress} />
          )}

          {currentTab === "privacy" && (
            <PrivacySideBySideView rawRecords={rawRecords} />
          )}

          {currentTab === "reliability" && (
            <ReliabilityView metrics={reliability} />
          )}

          {currentTab === "timeline" && (
            <TimelineView tenantId={tenantId} events={timelineEvents} />
          )}

          {currentTab === "history" && (
            <HistoryView history={healthHistory} />
          )}

          {currentTab === "reports" && (
            <ReportsView tenantId={tenantId} />
          )}
        </main>
      </div>

      {/* Global Search Modal (⌘K) */}
      <GlobalSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        tenantId={tenantId}
        onNavigate={handleNavigateFromSearch}
      />

      {/* Source Detail Drawer */}
      <SourceDetailDrawer
        source={selectedSourceForDetail}
        onClose={() => setSelectedSourceForDetail(null)}
        incidents={incidents}
      />
    </div>
  );
}
