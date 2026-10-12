"use client";

import React, { useEffect, useRef, useState, useTransition } from "react";
import {
  AlertTriangle,
  ArrowDownToLine,
  Check,
  Copy,
  ExternalLink,
  Filter,
  Globe,
  Laptop,
  Pause,
  Play,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  X,
  Zap
} from "lucide-react";
import { EnrolledClient, UrlEvent } from "../types";
import { fetchEvents } from "../api";

interface UrlHistoryViewProps {
  clients: EnrolledClient[];
  selectedClient: string;
  onSelectClient: (clientId: string) => void;
  onRefreshDashboard?: () => void;
}

export const UrlHistoryView: React.FC<UrlHistoryViewProps> = ({
  clients,
  selectedClient,
  onSelectClient,
  onRefreshDashboard
}) => {
  const [events, setEvents] = useState<UrlEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Live real-time streaming state
  const [isLiveStreaming, setIsLiveStreaming] = useState(true);
  const [lastStreamUpdate, setLastStreamUpdate] = useState<Date | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedClassification, setSelectedClassification] = useState("ALL");
  const [workstationFilter, setWorkstationFilter] = useState(selectedClient || "ALL");

  // Keep workstationFilter in sync if selectedClient prop explicitly changes from another view
  useEffect(() => {
    if (selectedClient) {
      setWorkstationFilter(selectedClient);
    }
  }, [selectedClient]);

  // Quick simulator state
  const [showSimulator, setShowSimulator] = useState(false);
  const [simUrl, setSimUrl] = useState("");
  const [isSimulating, setIsSimulating] = useState(false);
  const [simMessage, setSimMessage] = useState<{ text: string; type: "success" | "threat" } | null>(null);

  // Copied feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Search debounce effect
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Request sequencing guard
  const latestRequestId = useRef(0);
  const searchRef = useRef(debouncedSearch);
  searchRef.current = debouncedSearch;

  const loadData = async (silent = false) => {
    const requestId = ++latestRequestId.current;
    if (!silent) setIsLoading(true);
    setLoadError(null);

    try {
      const data = await fetchEvents({
        clientId: workstationFilter,
        classification: selectedClassification,
        search: searchRef.current
      });

      if (requestId !== latestRequestId.current) return;

      if (Array.isArray(data.events)) {
        setEvents(data.events);
        setTotal(data.total ?? data.events.length);
        setLastStreamUpdate(new Date());
      }
    } catch (e: any) {
      if (requestId !== latestRequestId.current) return;
      console.warn("Notice: could not refresh URL history from server:", e?.message);
      if (!silent) {
        setLoadError("Could not reach telemetry server. Displaying cached records.");
      }
    } finally {
      if (!silent && requestId === latestRequestId.current) {
        setIsLoading(false);
      }
    }
  };

  // Immediate load on filter changes
  useEffect(() => {
    loadData(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workstationFilter, selectedClassification, debouncedSearch]);

  // Real-time live polling interval (2s cadence when live streaming is enabled)
  useEffect(() => {
    if (!isLiveStreaming) return;
    const interval = setInterval(() => {
      loadData(true);
    }, 2000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLiveStreaming, workstationFilter, selectedClassification, debouncedSearch]);

  const handleCopyUrl = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleSimulateScan = async (targetUrl: string, label?: string) => {
    const urlToScan = targetUrl || simUrl;
    if (!urlToScan || !urlToScan.trim()) return;

    setIsSimulating(true);
    setSimMessage(null);

    try {
      const clientId = workstationFilter && workstationFilter !== "ALL" ? workstationFilter : (clients[0]?.id || "workstation-live");
      const matchedClient = clients.find(c => c.id === clientId);
      const clientName = matchedClient ? matchedClient.clientName : (clients[0]?.clientName || "Live Workstation");

      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: urlToScan.trim(),
          source: "realtime-simulator",
          clientId,
          clientName,
          eventId: `sim_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
        })
      });

      if (!res.ok) throw new Error("Server error during live scan");
      const result = await res.json();

      setSimMessage({
        text: `Logged: [${result.verdict}] ${result.action} — ${result.reasons?.[0] || "Analysis completed"}`,
        type: result.verdict === "PHISHING" ? "threat" : "success"
      });

      // Reload URL history and dashboard instantly
      await loadData(true);
      onRefreshDashboard?.();
      setSimUrl("");
    } catch (err: any) {
      setSimMessage({
        text: `Scan failed: ${err.message}`,
        type: "threat"
      });
    } finally {
      setIsSimulating(false);
    }
  };

  const exportAsCsv = () => {
    if (events.length === 0) return;
    const headers = ["Timestamp", "Client ID", "Client Name", "Classification", "Verdict", "Risk Score", "Domain", "URL", "Rule Triggered", "Reason"];
    const rows = events.map(e => [
      `"${e.timestamp}"`,
      `"${e.clientId}"`,
      `"${e.clientName.replace(/"/g, '""')}"`,
      `"${e.classification}"`,
      `"${e.verdict}"`,
      e.score,
      `"${e.domain}"`,
      `"${e.url.replace(/"/g, '""')}"`,
      `"${e.ruleTriggered ? (e.ruleType || "YES") : "NO"}"`,
      `"${(e.reason || "").replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `phishguard_url_history_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportAsJson = () => {
    if (events.length === 0) return;
    const jsonStr = JSON.stringify(events, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `phishguard_url_history_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const ruleTriggeredLabel = (evt: UrlEvent): string | null => {
    if (!evt.ruleTriggered) return null;
    if (evt.ruleType === "WHITELIST") return "Whitelist Rule Triggered";
    if (evt.ruleType === "PHISHING") return "Blacklist Rule Triggered";
    return "Rule Triggered";
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-[#0e0e0e] border border-[#262626] p-5 rounded-xl">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl font-bold text-neutral-100 flex items-center gap-2">
              <span>URL Telemetry History</span>
            </h2>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-[#1f1f1f] text-[#ffffff] border border-[#ffffff]/30">
              {total} Records
            </span>

            {/* Live Streaming Indicator Pill */}
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-[11px] font-mono border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
              <span className={`w-2 h-2 rounded-full bg-emerald-400 ${isLiveStreaming ? "animate-pulse" : "opacity-40"}`}></span>
              <span>{isLiveStreaming ? "LIVE REAL-TIME STREAMING" : "STREAM PAUSED"}</span>
            </div>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Complete persistent navigation and link scan history across all connected workstations — never cleared on polling or reconnect.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          {/* Pause / Resume Live Stream Toggle */}
          <button
            onClick={() => setIsLiveStreaming(!isLiveStreaming)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              isLiveStreaming
                ? "bg-[#182318] text-emerald-300 border-emerald-500/40 hover:bg-[#1f2f1f]"
                : "bg-[#252525] text-neutral-300 border-[#3a3a3a] hover:bg-[#2e2e2e]"
            }`}
            title={isLiveStreaming ? "Pause real-time stream" : "Resume real-time stream"}
          >
            {isLiveStreaming ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isLiveStreaming ? "Pause Stream" : "Resume Stream"}</span>
          </button>

          {/* Simulate Live Traffic Button */}
          <button
            onClick={() => setShowSimulator(!showSimulator)}
            className="flex items-center gap-1.5 text-xs bg-[#162133] hover:bg-[#1d2d47] text-sky-300 border border-sky-500/40 px-3 py-1.5 rounded-lg font-medium transition-colors"
          >
            <Zap className="w-3.5 h-3.5 text-sky-400" />
            <span>Simulate Traffic</span>
          </button>

          {/* Manual Refresh */}
          <button
            onClick={() => loadData(false)}
            disabled={isLoading}
            className="flex items-center gap-1.5 text-xs bg-[#161616] hover:bg-[#232323] text-neutral-300 hover:text-white px-3 py-1.5 rounded-lg border border-[#2a2a2a] transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-white" : ""}`} />
            <span>Refresh</span>
          </button>

          {/* Export Dropdown */}
          <div className="flex items-center gap-1 bg-[#161616] border border-[#262626] rounded-lg p-0.5">
            <button
              onClick={exportAsCsv}
              className="text-[11px] font-mono px-2 py-1 text-neutral-300 hover:text-white hover:bg-[#222222] rounded transition-colors"
              title="Export history as CSV"
            >
              CSV
            </button>
            <span className="text-neutral-600 text-xs">|</span>
            <button
              onClick={exportAsJson}
              className="text-[11px] font-mono px-2 py-1 text-neutral-300 hover:text-white hover:bg-[#222222] rounded transition-colors"
              title="Export history as JSON"
            >
              JSON
            </button>
          </div>
        </div>
      </div>

      {/* Live Traffic Simulator Drawer / Toolbar */}
      {showSimulator && (
        <div className="bg-[#101520] border border-sky-500/30 p-4 rounded-xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-sky-400" />
              <span className="text-xs font-bold text-sky-200">Real-Time Traffic Simulator & Telemetry Injector</span>
              <span className="text-[10px] text-neutral-400">
                (Instantly generates live extension traffic and verifies zero-latency recording)
              </span>
            </div>
            <button onClick={() => setShowSimulator(false)} className="text-neutral-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-neutral-400">Quick 1-Click Tests:</span>
            <button
              onClick={() => handleSimulateScan("https://github.com/trending/developers", "Safe Dev Portal")}
              disabled={isSimulating}
              className="text-[11px] bg-[#1a2333] hover:bg-[#223047] text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded"
            >
              ✓ Safe Dev Navigation (github.com)
            </button>
            <button
              onClick={() => handleSimulateScan("https://security-update-banking-verification.com/login.php", "Banking Phishing Attack")}
              disabled={isSimulating}
              className="text-[11px] bg-[#2a171a] hover:bg-[#381e22] text-rose-300 border border-rose-500/40 px-2.5 py-1 rounded font-semibold"
            >
              🛑 Phishing Intercept (banking-verify)
            </button>
            <button
              onClick={() => handleSimulateScan("https://mail.yahoo.com/d/folders/1", "Yahoo Mail Telemetry")}
              disabled={isSimulating}
              className="text-[11px] bg-[#1b2230] hover:bg-[#242e42] text-sky-300 border border-sky-500/30 px-2.5 py-1 rounded"
            >
              ✉️ Webmail Scan (mail.yahoo.com)
            </button>
            <button
              onClick={() => handleSimulateScan("https://tracking-click.analytics-redirect.top/ad?u=free", "Suspicious Tracker")}
              disabled={isSimulating}
              className="text-[11px] bg-[#272115] hover:bg-[#352c1c] text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded"
            >
              ⚠️ Suspicious TLD (.top Redirect)
            </button>
          </div>

          {/* Custom URL Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSimulateScan(simUrl);
            }}
            className="flex items-center gap-2"
          >
            <input
              type="url"
              placeholder="Or enter any custom URL to scan in real-time (e.g. https://example.com/test)..."
              value={simUrl}
              onChange={(e) => setSimUrl(e.target.value)}
              className="flex-1 bg-[#0a0d14] border border-[#26354d] text-neutral-200 text-xs px-3 py-2 rounded-lg focus:outline-none focus:border-sky-400"
            />
            <button
              type="submit"
              disabled={isSimulating || !simUrl.trim()}
              className="bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold text-xs px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5"
            >
              {isSimulating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              <span>Send Live Event</span>
            </button>
          </form>

          {simMessage && (
            <div
              className={`text-xs px-3 py-1.5 rounded-lg border font-mono ${
                simMessage.type === "threat"
                  ? "bg-rose-500/15 border-rose-500/30 text-rose-300"
                  : "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
              }`}
            >
              {simMessage.text}
            </div>
          )}
        </div>
      )}

      {/* Filter Controls Bar */}
      <div className="bg-[#0e0e0e] border border-[#262626] p-4 rounded-xl flex flex-wrap gap-3 items-center justify-between">
        {/* Search with live debounce */}
        <div className="flex-1 min-w-[240px] relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-neutral-400" />
          <input
            type="text"
            placeholder="Search by domain, full URL, client workstation, or heuristic reason..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#161616] border border-[#262626] text-neutral-200 text-xs pl-9 pr-8 py-2 rounded-lg focus:outline-none focus:border-[#ffffff]"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-2 text-neutral-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Client Filter */}
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <Laptop className="w-3.5 h-3.5" />
            <select
              value={workstationFilter}
              onChange={(e) => {
                setWorkstationFilter(e.target.value);
                onSelectClient(e.target.value);
              }}
              className="bg-[#161616] border border-[#262626] text-neutral-200 text-xs px-2.5 py-2 rounded-lg focus:outline-none"
            >
              <option value="ALL">All Connected Workstations ({clients.length})</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.clientName} ({c.id.slice(-6)})
                </option>
              ))}
            </select>
          </div>

          {/* Classification Filter Tabs */}
          <div className="flex items-center gap-1 bg-[#161616] border border-[#262626] p-1 rounded-lg">
            {(["ALL", "SAFE", "SUSPICIOUS", "PHISHING"] as const).map((cls) => (
              <button
                key={cls}
                onClick={() => setSelectedClassification(cls)}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded transition-colors ${
                  selectedClassification === cls
                    ? "bg-[#282828] text-white shadow-sm"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                {cls === "ALL" ? "All" : cls.charAt(0) + cls.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loadError && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs px-4 py-2.5 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-amber-400" />
            <span>{loadError}</span>
          </div>
          <button
            onClick={() => loadData(false)}
            className="text-xs underline hover:text-white font-mono"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* URL History Table */}
      <div className="bg-[#0e0e0e] border border-[#262626] rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-neutral-300">
            <thead className="bg-[#161616] text-neutral-400 font-semibold border-b border-[#262626]">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Workstation / Client</th>
                <th className="py-3 px-4">Classification</th>
                <th className="py-3 px-4">Domain & Visited URL</th>
                <th className="py-3 px-4">Risk Score</th>
                <th className="py-3 px-4">Security Reason & Policy Match</th>
                <th className="py-3 px-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#262626]">
              {isLoading && events.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-neutral-400">
                    <RefreshCw className="w-6 h-6 mx-auto animate-spin text-white mb-2" />
                    <div className="text-sm font-medium text-neutral-300">Loading Telemetry History...</div>
                    <p className="text-xs text-neutral-500 mt-1">Connecting to fleet database records</p>
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-neutral-500">
                    <Globe className="w-12 h-12 mx-auto mb-3 opacity-40 text-neutral-500" />
                    <div className="text-base font-semibold text-neutral-300">No URL Events Matched</div>
                    <p className="text-xs text-neutral-500 max-w-md mx-auto mt-1.5">
                      {search || selectedClient !== "ALL" || selectedClassification !== "ALL"
                        ? "No records matched your search filters. Try clearing your search keyword or switching workstation scope."
                        : "No browsing events recorded yet. Click 'Simulate Traffic' above to test real-time ingestion, or connect the extension."}
                    </p>
                    <div className="mt-4 flex items-center justify-center gap-3">
                      {(search || selectedClient !== "ALL" || selectedClassification !== "ALL") && (
                        <button
                          onClick={() => {
                            setSearch("");
                            setSelectedClassification("ALL");
                            onSelectClient("ALL");
                          }}
                          className="text-xs bg-[#1f1f1f] hover:bg-[#2a2a2a] text-neutral-200 px-3 py-1.5 rounded-lg border border-[#333333]"
                        >
                          Clear All Filters
                        </button>
                      )}
                      <button
                        onClick={() => handleSimulateScan("https://github.com/trending")}
                        className="text-xs bg-sky-700 hover:bg-sky-600 text-white font-medium px-3.5 py-1.5 rounded-lg flex items-center gap-1.5"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>Inject Real-Time Test Traffic</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                events.map((evt) => {
                  const ruleLabel = ruleTriggeredLabel(evt);
                  const isCopied = copiedId === evt.id;

                  return (
                    <tr key={evt.id} className="hover:bg-[#161616]/70 transition-colors group">
                      {/* Timestamp */}
                      <td className="py-3 px-4 text-neutral-400 font-mono text-[11px] whitespace-nowrap">
                        <div className="text-neutral-300 font-medium">{new Date(evt.timestamp).toLocaleDateString()}</div>
                        <div className="text-[10px] text-neutral-500">
                          {new Date(evt.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </div>
                      </td>

                      {/* Client Workstation */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-semibold text-neutral-200 flex items-center gap-1.5">
                          <Laptop className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                          <span>{evt.clientName}</span>
                        </div>
                        <div className="text-[10px] text-neutral-500 font-mono pl-5">
                          {evt.clientId} • {evt.source}
                        </div>
                      </td>

                      {/* Classification Badge */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            evt.classification === "PHISHING"
                              ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                              : evt.classification === "SUSPICIOUS"
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                              : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          }`}
                        >
                          {evt.classification === "PHISHING" ? "🛑" : evt.classification === "SUSPICIOUS" ? "⚠️" : "✓"}
                          <span>{evt.classification}</span>
                        </span>
                      </td>

                      {/* Destination Domain & URL */}
                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-mono text-neutral-200 font-semibold truncate flex items-center gap-1.5">
                          <span>{evt.domain || "Unknown Domain"}</span>
                          <button
                            onClick={() => handleCopyUrl(evt.url, evt.id)}
                            className="text-neutral-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Copy full URL"
                          >
                            {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                        <div className="text-[10px] text-neutral-400 truncate mt-0.5 font-mono" title={evt.url}>
                          {evt.url}
                        </div>
                        {ruleLabel && (
                          <div className="mt-1">
                            <span
                              className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${
                                evt.ruleType === "WHITELIST"
                                  ? "bg-sky-500/15 text-sky-300 border-sky-500/30"
                                  : "bg-rose-500/15 text-rose-300 border-rose-500/30"
                              }`}
                            >
                              <ShieldAlert className="w-2.5 h-2.5" />
                              {ruleLabel}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Risk Score */}
                      <td className="py-3 px-4 font-mono whitespace-nowrap">
                        <span
                          className={`text-xs font-bold ${
                            evt.score >= 0.7
                              ? "text-rose-400"
                              : evt.score >= 0.4
                              ? "text-amber-400"
                              : "text-emerald-400"
                          }`}
                        >
                          {(evt.score * 100).toFixed(0)}%
                        </span>
                      </td>

                      {/* Heuristics & Reason */}
                      <td className="py-3 px-4 text-neutral-300 text-[11px] max-w-sm truncate" title={evt.reason}>
                        {evt.reason || "Clean verified destination"}
                      </td>

                      {/* Action Verdict */}
                      <td className="py-3 px-4 font-semibold text-[11px] whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                            evt.verdict === "BLOCKED"
                              ? "bg-rose-950 text-rose-300 border border-rose-800"
                              : evt.verdict === "WARNING"
                              ? "bg-amber-950 text-amber-300 border border-amber-800"
                              : "bg-emerald-950 text-emerald-300 border border-emerald-800"
                          }`}
                        >
                          {evt.verdict}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom Status Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 border-t border-[#262626] text-xs text-neutral-400 bg-[#121212]">
          <div className="flex items-center gap-2">
            <span className="font-medium text-neutral-300">
              Showing {events.length} of {total} records
            </span>
            <span className="text-neutral-600">•</span>
            <span>Real-time persistence enabled (Zero-data loss log)</span>
          </div>
          {lastStreamUpdate && (
            <div className="text-[11px] font-mono text-neutral-500 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span>Last real-time sync: {lastStreamUpdate.toLocaleTimeString()}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
