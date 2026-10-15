import React, { useEffect, useState } from "react";
import {
  Calendar,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Laptop,
  Printer,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  TrendingUp
} from "lucide-react";
import { EnrolledClient, ReportData } from "../types";
import { fetchReportData } from "../api";
import jsPDF from "jspdf";

interface ReportsViewProps {
  clients: EnrolledClient[];
}

type TimePreset = "1h" | "24h" | "7d" | "30d" | "all" | "custom";

function toLocalDatetimeInput(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ clients }) => {
  const [selectedClient, setSelectedClient] = useState<string>("ALL");
  const [timePreset, setTimePreset] = useState<TimePreset>("7d");
  
  // Custom date-time states (datetime-local format: YYYY-MM-DDTHH:mm)
  const [customStart, setCustomStart] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return toLocalDatetimeInput(d);
  });
  const [customEnd, setCustomEnd] = useState<string>(() => {
    return toLocalDatetimeInput(new Date());
  });

  const [report, setReport] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const calculateDates = (): { startDate?: string; endDate?: string } => {
    const now = new Date();
    if (timePreset === "all") {
      return { startDate: undefined, endDate: undefined };
    }
    if (timePreset === "custom") {
      const s = customStart ? new Date(customStart).toISOString() : undefined;
      const e = customEnd ? new Date(customEnd).toISOString() : undefined;
      return { startDate: s, endDate: e };
    }
    const msMap: Record<string, number> = {
      "1h": 60 * 60 * 1000,
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000
    };
    const diff = msMap[timePreset] || 7 * 24 * 60 * 60 * 1000;
    const start = new Date(now.getTime() - diff);
    return { startDate: start.toISOString(), endDate: now.toISOString() };
  };

  const getTimeRangeLabel = (): string => {
    if (timePreset === "1h") return "Past 1 Hour";
    if (timePreset === "24h") return "Past 24 Hours";
    if (timePreset === "7d") return "Past 7 Days";
    if (timePreset === "30d") return "Past 30 Days";
    if (timePreset === "all") return "All-Time Cumulative";
    return `${new Date(customStart).toLocaleString()} → ${new Date(customEnd).toLocaleString()}`;
  };

  const loadReport = async () => {
    if (timePreset === "custom") {
      if (customStart && customEnd && new Date(customStart).getTime() > new Date(customEnd).getTime()) {
        setValidationError("Start date/time cannot be later than end date/time.");
        return;
      }
    }
    setValidationError(null);
    setIsLoading(true);
    try {
      const { startDate, endDate } = calculateDates();
      const data = await fetchReportData(selectedClient, startDate, endDate);
      setReport(data);
    } catch (err: any) {
      console.error("Failed to load report data:", err);
      setValidationError("Failed to generate report from central database.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (timePreset !== "custom") {
      loadReport();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClient, timePreset]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCsv = () => {
    if (!report || !report.events) return;
    const headers = [
      "Timestamp",
      "Workstation ID",
      "Workstation Name",
      "Classification",
      "Verdict",
      "Risk Score",
      "Domain",
      "Full URL",
      "Reason",
      "Rule Triggered"
    ];

    const rows = report.events.map(e => [
      `"${e.timestamp}"`,
      `"${e.clientId}"`,
      `"${(e.clientName || "").replace(/"/g, '""')}"`,
      `"${e.classification}"`,
      `"${e.verdict || ""}"`,
      e.score ?? 0,
      `"${e.domain}"`,
      `"${e.url.replace(/"/g, '""')}"`,
      `"${(e.reason || "").replace(/"/g, '""')}"`,
      `"${e.ruleTriggered ? (e.ruleType || "YES") : "NO"}"`
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `phishguard-report-${report.scope}-${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPdf = () => {
    if (!report) return;
    const doc = new jsPDF();
    const generated = new Date(report.generatedAt).toLocaleString();
    const timeLabel = getTimeRangeLabel();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("PhishGuard Enterprise Security Hub", 14, 18);

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text("Executive Security Audit & Fleet Telemetry Report", 14, 25);
    doc.text(`Time Filter: ${timeLabel} | Scope: ${report.scope === "ALL" ? "Fleet-Wide" : report.scope}`, 14, 32);
    doc.text(`Report Generated: ${generated}`, 14, 38);

    doc.line(14, 42, 196, 42);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Defensive Telemetry Summary", 14, 50);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Total URLs Evaluated: ${report.summary.totalEvaluated.toLocaleString()}`, 14, 58);
    doc.text(`Safe URLs: ${report.summary.safe.toLocaleString()}`, 14, 64);
    doc.text(`Suspicious Detected: ${report.summary.suspicious.toLocaleString()}`, 14, 70);
    doc.text(`Phishing Intercepted: ${report.summary.phishing.toLocaleString()}`, 14, 76);
    doc.text(`Active Threat Incidents: ${report.summary.activeAlerts.toLocaleString()}`, 14, 82);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Top Intercepted Malicious Domains", 14, 96);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    let y = 104;
    if (report.topThreatDomains.length === 0) {
      doc.text("No malicious domains intercepted in this timeframe.", 14, y);
      y += 8;
    } else {
      report.topThreatDomains.slice(0, 8).forEach(td => {
        doc.text(`• ${td.domain} (${td.count} events)`, 16, y);
        y += 6;
      });
    }

    if (report.perSystem && report.perSystem.length > 0) {
      y += 6;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("Workstation Breakdown", 14, y);
      y += 8;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      report.perSystem.slice(0, 10).forEach(sys => {
        doc.text(
          `${sys.clientName} (${sys.clientId.slice(-6)}): ${sys.totalScanned} scanned, ${sys.phishing} phishing blocked, ${sys.activeAlerts} active alerts`,
          16,
          y
        );
        y += 5.5;
      });
    }

    doc.save(`phishguard-report-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Controls Bar */}
      <div className="bg-[#121212] border border-[#262626] rounded-xl p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Workstation Selector */}
            <div className="flex items-center gap-2 bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2">
              <Laptop className="w-3.5 h-3.5 text-neutral-400" />
              <select
                value={selectedClient}
                onChange={e => setSelectedClient(e.target.value)}
                className="bg-transparent text-xs text-neutral-200 focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Workstations (Fleet-wide)</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.clientName}
                  </option>
                ))}
              </select>
            </div>

            {/* Time Presets */}
            <div className="flex items-center gap-2 bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2">
              <Calendar className="w-3.5 h-3.5 text-neutral-400" />
              <select
                value={timePreset}
                onChange={e => setTimePreset(e.target.value as TimePreset)}
                className="bg-transparent text-xs text-neutral-200 focus:outline-none cursor-pointer"
              >
                <option value="1h">Last 1 Hour</option>
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="all">All-Time Cumulative</option>
                <option value="custom">Custom Date & Time Range...</option>
              </select>
            </div>

            <button
              onClick={loadReport}
              disabled={isLoading}
              className="flex items-center gap-2 bg-[#1b1b1b] hover:bg-[#282828] border border-[#333] text-neutral-200 text-xs px-3.5 py-2 rounded-lg transition-colors font-medium"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-white" : ""}`} />
              <span>Regenerate</span>
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleExportCsv}
              disabled={!report || report.events.length === 0}
              className="flex items-center gap-1.5 bg-[#191919] hover:bg-[#252525] disabled:opacity-50 border border-[#333] text-neutral-200 text-xs px-3 py-2 rounded-lg transition-colors font-medium"
              title="Download raw records as CSV"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-neutral-400" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-[#1f1f1f] hover:bg-[#2b2b2b] border border-[#333] text-neutral-200 text-xs px-3 py-2 rounded-lg transition-colors font-medium"
            >
              <Printer className="w-3.5 h-3.5 text-neutral-400" />
              <span>Print View</span>
            </button>

            <button
              onClick={handleExportPdf}
              className="flex items-center gap-1.5 bg-white hover:bg-neutral-200 text-black text-xs font-bold px-3.5 py-2 rounded-lg transition-colors shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export PDF</span>
            </button>
          </div>
        </div>

        {/* Custom Date & Time Picker Row */}
        {timePreset === "custom" && (
          <div className="pt-2 border-t border-[#222] flex flex-wrap items-center gap-4 bg-[#0a0a0a] p-3 rounded-lg border border-[#2c2c2c]">
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-neutral-400" />
              <span className="text-xs text-neutral-300 font-medium">From:</span>
              <input
                type="datetime-local"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className="bg-[#141414] border border-[#333] rounded px-2 py-1 text-xs text-neutral-100 font-mono focus:outline-none focus:border-neutral-400"
              />
            </div>

            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-neutral-400" />
              <span className="text-xs text-neutral-300 font-medium">To:</span>
              <input
                type="datetime-local"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                className="bg-[#141414] border border-[#333] rounded px-2 py-1 text-xs text-neutral-100 font-mono focus:outline-none focus:border-neutral-400"
              />
            </div>

            <button
              onClick={loadReport}
              disabled={isLoading}
              className="px-3 py-1 bg-white hover:bg-neutral-200 text-black text-xs font-bold rounded transition-colors"
            >
              Apply Time Filter
            </button>
          </div>
        )}

        {validationError && (
          <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 p-2 rounded">
            {validationError}
          </div>
        )}
      </div>

      {/* Printable Report Document */}
      {report && (
        <div
          id="phishguard-report-printable"
          className="bg-[#121212] border border-[#262626] rounded-xl p-6 lg:p-8 space-y-6"
        >
          {/* Document Header */}
          <div className="border-b border-[#262626] pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-white" />
                <h1 className="text-xl font-bold text-neutral-100">
                  PhishGuard Executive Security Audit Report
                </h1>
              </div>
              <p className="text-xs text-neutral-400 mt-1">
                Centralized telemetry analysis, threat interception breakdown, and fleet compliance log.
              </p>
            </div>

            <div className="text-xs font-mono text-neutral-400 sm:text-right">
              <div>Scope: <strong className="text-neutral-200">{report.scope === "ALL" ? "Fleet-Wide" : report.scope}</strong></div>
              <div>Time Range: <strong className="text-neutral-200">{getTimeRangeLabel()}</strong></div>
              <div>Generated: {new Date(report.generatedAt).toLocaleString()}</div>
            </div>
          </div>

          {/* Metric Tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#181818] border border-[#2c2c2c] p-4 rounded-xl">
              <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wide">URLs Evaluated</span>
              <div className="text-2xl font-bold font-mono text-neutral-100 mt-1">
                {report.summary.totalEvaluated.toLocaleString()}
              </div>
            </div>

            <div className="bg-[#181818] border border-[#2c2c2c] p-4 rounded-xl">
              <span className="text-[11px] font-medium text-emerald-400 uppercase tracking-wide">Safe URLs</span>
              <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
                {report.summary.safe.toLocaleString()}
              </div>
            </div>

            <div className="bg-[#181818] border border-[#2c2c2c] p-4 rounded-xl">
              <span className="text-[11px] font-medium text-amber-400 uppercase tracking-wide">Suspicious Detected</span>
              <div className="text-2xl font-bold font-mono text-amber-400 mt-1">
                {report.summary.suspicious.toLocaleString()}
              </div>
            </div>

            <div className="bg-[#181818] border border-[#2c2c2c] p-4 rounded-xl">
              <span className="text-[11px] font-medium text-red-400 uppercase tracking-wide">Phishing Intercepted</span>
              <div className="text-2xl font-bold font-mono text-red-400 mt-1">
                {report.summary.phishing.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Top Threat Domains & Alert Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[#161616] border border-[#262626] rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <ShieldAlert className="w-4 h-4 text-red-400" />
                <h3 className="text-sm font-bold text-neutral-200">
                  Top Threat Domains ({report.topThreatDomains.length})
                </h3>
              </div>
              {report.topThreatDomains.length === 0 ? (
                <p className="text-xs text-neutral-500 py-4">No threat domains intercepted in this timeframe.</p>
              ) : (
                <ul className="divide-y divide-[#222] text-xs">
                  {report.topThreatDomains.map(td => (
                    <li key={td.domain} className="py-2.5 flex items-center justify-between">
                      <span className="font-mono text-red-300 truncate max-w-xs">{td.domain}</span>
                      <span className="bg-red-500/10 text-red-400 px-2 py-0.5 rounded text-[11px] font-mono font-bold">
                        {td.count} incidents
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="bg-[#161616] border border-[#262626] rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-neutral-200">
                  Fleet Compliance & Active Alerts
                </h3>
              </div>
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between py-2 border-b border-[#222]">
                  <span className="text-neutral-400">Total Enrolled Systems In Scope</span>
                  <span className="font-mono text-neutral-200 font-bold">{report.systems.length}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-[#222]">
                  <span className="text-neutral-400">Unresolved Threat Alerts</span>
                  <span className={`font-mono font-bold ${report.summary.activeAlerts > 0 ? "text-red-400" : "text-emerald-400"}`}>
                    {report.summary.activeAlerts}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-[#222]">
                  <span className="text-neutral-400">Total Logged Telemetry Events</span>
                  <span className="font-mono text-neutral-200">{report.events.length}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Per System Rollup Table */}
          {report.perSystem && report.perSystem.length > 0 && (
            <div className="bg-[#161616] border border-[#262626] rounded-xl overflow-hidden">
              <div className="p-4 border-b border-[#262626] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Laptop className="w-4 h-4 text-neutral-400" />
                  <h3 className="text-sm font-bold text-neutral-200">Workstation Compliance Rollup</h3>
                </div>
                <span className="text-xs text-neutral-400 font-mono">{report.perSystem.length} endpoints</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#1c1c1c] text-neutral-400 text-[10px] uppercase font-semibold">
                    <tr>
                      <th className="px-4 py-2.5">Endpoint Name</th>
                      <th className="px-4 py-2.5">OS / Browser</th>
                      <th className="px-4 py-2.5">Total Evaluated</th>
                      <th className="px-4 py-2.5">Safe</th>
                      <th className="px-4 py-2.5">Suspicious</th>
                      <th className="px-4 py-2.5">Phishing Blocked</th>
                      <th className="px-4 py-2.5">Active Alerts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#222]">
                    {report.perSystem.map(sys => (
                      <tr key={sys.clientId} className="hover:bg-[#1a1a1a]">
                        <td className="px-4 py-2.5 font-medium text-neutral-200">
                          <div>{sys.clientName}</div>
                          <div className="text-[10px] font-mono text-neutral-500">{sys.clientId}</div>
                        </td>
                        <td className="px-4 py-2.5 text-neutral-400">
                          {sys.os} · {sys.browser}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-neutral-200">{sys.totalScanned}</td>
                        <td className="px-4 py-2.5 font-mono text-emerald-400">{sys.safe}</td>
                        <td className="px-4 py-2.5 font-mono text-amber-400">{sys.suspicious}</td>
                        <td className="px-4 py-2.5 font-mono text-red-400 font-bold">{sys.phishing}</td>
                        <td className="px-4 py-2.5 font-mono">
                          <span className={sys.activeAlerts > 0 ? "text-red-400 font-bold" : "text-neutral-500"}>
                            {sys.activeAlerts}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
