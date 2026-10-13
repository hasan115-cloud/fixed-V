"use client";

import React, { useEffect, useRef, useState } from "react";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { OverviewView } from "@/components/OverviewView";
import { EnrolledSystemsView } from "@/components/EnrolledSystemsView";
import { UrlHistoryView } from "@/components/UrlHistoryView";
import { SecurityRulesView } from "@/components/SecurityRulesView";
import { ThreatAlertsView } from "@/components/ThreatAlertsView";
import { InstallExtensionView } from "@/components/InstallExtensionView";
import { ReportsView } from "@/components/ReportsView";
import { AdminSettingsView } from "@/components/AdminSettingsView";
import { RemovalRequestsView } from "@/components/RemovalRequestsView";
import { DashboardStats, EnrolledClient, NavigationTab, RemovalRequest } from "@/types";
import { fetchClients, fetchRemovalRequests, fetchServerInfo, fetchStats } from "@/api";

const EMPTY_STATS: DashboardStats = {
  totalSystems: 0,
  urlsMonitored: 0,
  allowedUrls: 0,
  phishingIntercepted: 0,
  activeAlerts: 0,
  breakdown: {
    evaluated: 0,
    safe: 0,
    suspicious: 0,
    phishing: 0
  },
  recentEvents: [],
  topThreatDomains: []
};

export default function Page() {
  const [currentTab, setCurrentTab] = useState<NavigationTab>("overview");
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [clients, setClients] = useState<EnrolledClient[]>([]);
  const [pendingRemovals, setPendingRemovals] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [serverInfo, setServerInfo] = useState<{ database?: string; databaseHost?: string } | null>(null);

  const [selectedSystem, setSelectedSystem] = useState("ALL");
  const latestStatsRequest = useRef(0);

  const loadDashboardData = async (silent = false, scope = selectedSystem) => {
    const requestId = ++latestStatsRequest.current;
    if (!silent) setIsRefreshing(true);
    try {
      const [newStats, newClients, removalReqs] = await Promise.all([
        fetchStats(scope),
        fetchClients(),
        fetchRemovalRequests().catch(() => [] as RemovalRequest[])
      ]);
      if (requestId !== latestStatsRequest.current) return;
      if (newStats) setStats(newStats);
      if (Array.isArray(newClients)) setClients(newClients);
      if (Array.isArray(removalReqs)) {
        setPendingRemovals(removalReqs.filter(r => r.status === "PENDING").length);
      }
    } catch (e) {
      console.error("Telemetry sync error:", e);
    } finally {
      if (!silent && requestId === latestStatsRequest.current) setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchServerInfo().then(setServerInfo).catch(() => {});
  }, []);

  useEffect(() => {
    loadDashboardData(false, selectedSystem);
    // 2-second real-time telemetry polling
    const timer = setInterval(() => {
      loadDashboardData(true, selectedSystem);
    }, 2000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSystem]);

  return (
    <div className="min-h-screen bg-[#0e0e0e] text-neutral-100 flex flex-col font-sans">
      {/* Top Navigation Header */}
      <Header
        totalCount={clients.length}
        onRefresh={() => loadDashboardData(false)}
        isRefreshing={isRefreshing}
        database={serverInfo?.database}
        databaseHost={serverInfo?.databaseHost}
      />

      {/* Main Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Navigation Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          activeAlertsCount={stats.activeAlerts}
          enrolledSystemsCount={clients.length}
          pendingRemovalCount={pendingRemovals}
        />

        {/* Dynamic Tab View Container */}
        <main className="flex-1 p-6 lg:p-8 overflow-y-auto bg-[#0a0a0a]">
          <div className="max-w-7xl mx-auto">
            <div className={currentTab === "overview" ? "block" : "hidden"}>
              <OverviewView
                stats={stats}
                clients={clients}
                selectedSystem={selectedSystem}
                onSelectSystem={setSelectedSystem}
                onNavigateTab={setCurrentTab}
                onRefresh={() => loadDashboardData(true, selectedSystem)}
              />
            </div>

            <div className={currentTab === "url_history" ? "block" : "hidden"}>
              <UrlHistoryView
                clients={clients}
                selectedClient={selectedSystem}
                onSelectClient={setSelectedSystem}
                onRefreshDashboard={() => loadDashboardData(true, selectedSystem)}
              />
            </div>

            {currentTab === "enrolled_systems" && (
              <EnrolledSystemsView
                clients={clients}
                onNavigateTab={setCurrentTab}
                onRefresh={() => loadDashboardData(false)}
              />
            )}

            {currentTab === "removal_requests" && (
              <RemovalRequestsView
                onRefreshBadge={() => loadDashboardData(true)}
              />
            )}

            {currentTab === "security_rules" && (
              <SecurityRulesView />
            )}

            {currentTab === "threat_alerts" && (
              <ThreatAlertsView
                clients={clients}
                onAlertUpdated={() => loadDashboardData(true)}
              />
            )}

            {currentTab === "install_extension" && (
              <InstallExtensionView />
            )}

            {currentTab === "reports" && (
              <ReportsView clients={clients} />
            )}

            {currentTab === "admin_settings" && (
              <AdminSettingsView />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
