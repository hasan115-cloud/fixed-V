import React, { useEffect, useState } from "react";
import {
  Calendar,
  Download,
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

export const ReportsView: React.FC<ReportsViewProps> = ({ clients }) => {
  const [selectedClient, setSelectedClient] = useState<string>("ALL");
  const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d" | "all">("7d");
  const [report, setReport] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const calculateDates = () => {
    const now = new Date();
    if (timeRange === "all") return { startDate: undefined, endDate: undefined };
    const msMap = {
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000
    };
    const start = new Date(now.getTime() - msMap[timeRange]);
    return { startDate: start.toISOString(), endDate: now.toISOString() };
  };

  const loadReport = async () => {
    setIsLoading(true);
    try {
      const { startDate, endDate } = calculateDates();
      const data = await fetchReportData(selectedClient, startDate, endDate);
      setReport(data);
    } catch (err) {
      console.error("Failed to load report data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [selectedClient, timeRange]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportPdf = () => {
    if (!report) return;
    const doc = new jsPDF();
    const generated = new Date(report.generatedAt).toLocaleString();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("PhishGuard Enterprise Security Hub", 14, 20);

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Executive Security Audit Report`, 14, 28);
    doc.text(`Generated: ${generated} | Scope: ${report.scope}`, 14, 35);

    doc.line(14, 39, 196, 39);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Fleet Security Summary", 14, 48);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Total URLs Evaluated: ${report.summary.totalEvaluated}`, 14, 56);
    doc.text(`Safe URLs: ${report.summary.safe}`, 14, 62);
    doc.text(`Suspicious Detected: ${report.summary.suspicious}`, 14, 68);
    doc.text(`Phishing Intercepted: ${report.summary.phishing}`, 14, 74);
    doc.text(`Active Threat Alerts: ${report.summary.activeAlerts}`, 14, 80);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Top Intercepted Threat Domains", 14, 94);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    let y = 102;
    if (report.topThreatDomains.length === 0) {
      doc.text("No malicious domains intercepted in this timeframe.", 14, y);
      y += 8;
    } else {
      report.topThreatDomains.slice(0, 10).forEach(td => {
        doc.text(`• ${td.domain} (${td.count} events)`, 16, y);
        y += 6;
      });
    }

    doc.save(`phishguard-report-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Controls Bar */}
      <div className="bg-[#121212] border border-[#262626] rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
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

          {/* Time Range */}
          <div className="flex items-center gap-2 bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2">
            <Calendar className="w-3.5 h-3.5 text-neutral-400" />
            <select
              value={timeRange}
              onChange={e => setTimeRange(e.target.value as any)}
              className="bg-transparent text-xs text-neutral-200 focus:outline-none cursor-pointer"
            >
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="all">All-Time Cumulative</option>
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
            onClick={handlePrint}
            className="flex items-center gap-1.5 bg-[#1f1f1f] hover:bg-[#2b2b2b] border border-[#333] text-neutral-200 text-xs px-3 py-2 rounded-lg transition-colors font-medium"
          >
            <Printer className="w-4 h-4 text-neutral-400" />
            <span>Print View</span>
          </button>

          <button
            onClick={handleExportPdf}
            className="flex items-center gap-1.5 bg-white hover:bg-neutral-200 text-black text-xs font-bold px-3.5 py-2 rounded-lg transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span>Export PDF</span>
          </button>
        </div>
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

          {/* Top Malicious Domains Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-neutral-200 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-400" />
              <span>Top Blocked Malicious Domains</span>
            </h3>

            <div className="bg-[#181818] border border-[#2c2c2c] rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#202020] text-neutral-400 uppercase text-[10px] tracking-wider border-b border-[#2c2c2c]">
                  <tr>
                    <th className="px-4 py-2.5">Domain</th>
                    <th className="px-4 py-2.5 text-right">Interception Count</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#262626]">
                  {report.topThreatDomains.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="px-4 py-6 text-center text-neutral-500">
                        No threat incidents recorded in selected period.
                      </td>
                    </tr>
                  ) : (
                    report.topThreatDomains.map(d => (
                      <tr key={d.domain} className="hover:bg-[#202020]">
                        <td className="px-4 py-2.5 font-mono text-red-300">{d.domain}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-neutral-200">
                          {d.count}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Per-System Rollup Section (if fleet-wide) */}
          {report.perSystem && report.perSystem.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-neutral-200 flex items-center gap-2">
                <Laptop className="w-4 h-4 text-neutral-300" />
                <span>Endpoint Activity Breakdown</span>
              </h3>

              <div className="bg-[#181818] border border-[#2c2c2c] rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#202020] text-neutral-400 uppercase text-[10px] tracking-wider border-b border-[#2c2c2c]">
                    <tr>
                      <th className="px-4 py-2.5">Workstation</th>
                      <th className="px-4 py-2.5">Platform</th>
                      <th className="px-4 py-2.5 text-right">Evaluated</th>
                      <th className="px-4 py-2.5 text-right">Safe</th>
                      <th className="px-4 py-2.5 text-right">Suspicious</th>
                      <th className="px-4 py-2.5 text-right">Phishing</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#262626]">
                    {report.perSystem.map(sys => (
                      <tr key={sys.clientId} className="hover:bg-[#202020]">
                        <td className="px-4 py-2.5 font-medium text-neutral-200">{sys.clientName}</td>
                        <td className="px-4 py-2.5 text-neutral-400">{sys.os} / {sys.browser}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-neutral-300">{sys.totalScanned}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-emerald-400">{sys.safe}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-amber-400">{sys.suspicious}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-red-400 font-bold">{sys.phishing}</td>
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
