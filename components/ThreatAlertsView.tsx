import React, { useEffect, useState } from "react";
import {
  AlertOctagon,
  AlertTriangle,
  Check,
  CheckCircle,
  Clock,
  Filter,
  Laptop,
  RefreshCw,
  Search,
  ShieldAlert
} from "lucide-react";
import { EnrolledClient, ThreatAlert } from "../types";
import { fetchThreatAlerts, updateAlertStatus } from "../api";

interface ThreatAlertsViewProps {
  clients: EnrolledClient[];
  onAlertUpdated?: () => void;
}

export const ThreatAlertsView: React.FC<ThreatAlertsViewProps> = ({
  clients,
  onAlertUpdated
}) => {
  const [alerts, setAlerts] = useState<ThreatAlert[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadAlerts = async () => {
    setIsLoading(true);
    try {
      const data = await fetchThreatAlerts(selectedClient);
      setAlerts(data);
    } catch (err) {
      console.error("Failed to load threat alerts:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, [selectedClient]);

  const handleUpdateStatus = async (id: string, newStatus: "ACKNOWLEDGED" | "RESOLVED") => {
    setUpdatingId(id);
    try {
      const ok = await updateAlertStatus(id, newStatus);
      if (ok) {
        setAlerts(prev =>
          prev.map(a => (a.id === id ? { ...a, status: newStatus } : a))
        );
        onAlertUpdated?.();
      }
    } catch (err) {
      console.error("Failed to update alert status:", err);
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = alerts.filter(a => {
    if (statusFilter !== "ALL" && a.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const match =
        a.url.toLowerCase().includes(q) ||
        a.domain.toLowerCase().includes(q) ||
        a.clientName.toLowerCase().includes(q) ||
        a.reasons.some(r => r.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  const activeCount = alerts.filter(a => a.status === "ACTIVE").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-red-500" />
            <h2 className="text-xl font-bold text-neutral-100">Enterprise Threat Alerts</h2>
            {activeCount > 0 && (
              <span className="bg-red-500/20 text-red-400 border border-red-500/30 text-xs px-2.5 py-0.5 rounded-full font-bold font-mono">
                {activeCount} Active
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Real-time interception incidents and credential theft attempts reported across enrolled workstations.
          </p>
        </div>

        <button
          onClick={loadAlerts}
          disabled={isLoading}
          className="flex items-center gap-2 bg-[#191919] hover:bg-[#252525] border border-[#333] text-neutral-200 text-xs px-3.5 py-2 rounded-lg transition-colors font-medium self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-white" : ""}`} />
          <span>Refresh Alerts</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-[#121212] border border-[#262626] rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Workstation Selector */}
          <div className="flex items-center gap-1.5 bg-[#0a0a0a] border border-[#333] rounded-lg px-2.5 py-1.5">
            <Laptop className="w-3.5 h-3.5 text-neutral-400" />
            <select
              value={selectedClient}
              onChange={e => setSelectedClient(e.target.value)}
              className="bg-transparent text-xs text-neutral-200 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Workstations ({clients.length})</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>
                  {c.clientName} ({c.os})
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 bg-[#0a0a0a] border border-[#333] rounded-lg px-2.5 py-1.5">
            <Filter className="w-3.5 h-3.5 text-neutral-400" />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-transparent text-xs text-neutral-200 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="ACKNOWLEDGED">ACKNOWLEDGED</option>
              <option value="RESOLVED">RESOLVED</option>
            </select>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search domain, reason, endpoint..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg pl-8 pr-3 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-[#121212] border border-[#262626] rounded-xl p-12 text-center text-neutral-500">
            <CheckCircle className="w-10 h-10 text-emerald-500/40 mx-auto mb-3" />
            <p className="text-sm font-medium text-neutral-300">No threat alerts recorded for this view</p>
            <p className="text-xs text-neutral-500 mt-1">All monitored endpoints are operating without open threat incidents.</p>
          </div>
        ) : (
          filtered.map(alert => {
            const isCritical = alert.score >= 0.8;
            return (
              <div
                key={alert.id}
                className={`bg-[#121212] border rounded-xl p-4 transition-colors ${
                  alert.status === "ACTIVE"
                    ? "border-red-500/40 shadow-sm shadow-red-950/20"
                    : alert.status === "ACKNOWLEDGED"
                    ? "border-amber-500/30"
                    : "border-[#262626] opacity-70"
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide font-mono ${
                          alert.status === "ACTIVE"
                            ? "bg-red-500/20 text-red-400 border border-red-500/30"
                            : alert.status === "ACKNOWLEDGED"
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        }`}
                      >
                        {alert.status}
                      </span>

                      <span className="text-xs font-mono font-bold text-neutral-200 truncate">
                        {alert.domain}
                      </span>

                      <span className="text-[11px] font-mono text-red-400 bg-red-950/40 px-1.5 py-0.5 rounded border border-red-800/40">
                        Threat Score: {(alert.score * 100).toFixed(0)}%
                      </span>
                    </div>

                    <div className="text-xs font-mono text-neutral-400 truncate break-all">
                      {alert.url}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-neutral-400 pt-1">
                      <span className="flex items-center gap-1 text-neutral-300">
                        <Laptop className="w-3 h-3 text-neutral-400" />
                        {alert.clientName}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(alert.timestamp).toLocaleString()}
                      </span>
                      <span>•</span>
                      <span className="text-neutral-400">
                        Source: {alert.source}
                      </span>
                    </div>

                    {alert.reasons && alert.reasons.length > 0 && (
                      <div className="pt-2 flex flex-wrap gap-1.5">
                        {alert.reasons.map((r, i) => (
                          <span
                            key={i}
                            className="bg-[#181818] border border-[#2b2b2b] text-[10px] px-2 py-0.5 rounded text-neutral-300"
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 pt-2 lg:pt-0">
                    {alert.status === "ACTIVE" && (
                      <button
                        onClick={() => handleUpdateStatus(alert.id, "ACKNOWLEDGED")}
                        disabled={updatingId === alert.id}
                        className="bg-[#1f1f1f] hover:bg-[#2c2c2c] text-amber-300 border border-amber-500/30 text-xs px-3 py-1.5 rounded-lg transition-colors font-medium flex items-center gap-1.5"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>Acknowledge</span>
                      </button>
                    )}

                    {alert.status !== "RESOLVED" && (
                      <button
                        onClick={() => handleUpdateStatus(alert.id, "RESOLVED")}
                        disabled={updatingId === alert.id}
                        className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs px-3 py-1.5 rounded-lg transition-colors font-medium flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Resolve</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
