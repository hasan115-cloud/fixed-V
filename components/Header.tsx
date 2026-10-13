import React from "react";
import { Download, RefreshCw, Shield } from "lucide-react";
import { getDownloadExtensionUrl } from "../api";

const PhishGuardFlagMark: React.FC<{ className?: string }> = ({ className }) => (
  <Shield className={className} />
);

interface HeaderProps {
  totalCount: number;
  onRefresh: () => void;
  isRefreshing: boolean;
  database?: string;
  databaseHost?: string;
}

export const Header: React.FC<HeaderProps> = ({
  totalCount,
  onRefresh,
  isRefreshing,
  database,
  databaseHost
}) => {
  return (
    <header className="h-16 bg-[#0e0e0e] border-b border-[#262626] px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-md gap-3 overflow-hidden">
      {/* Brand */}
      <div className="flex items-center gap-3 min-w-0 shrink-0">
        <div className="w-9 h-9 rounded-lg bg-black border border-white/30 flex items-center justify-center p-1.5 shadow-inner shrink-0">
          <PhishGuardFlagMark className="w-full h-full" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-neutral-100 tracking-wide whitespace-nowrap">PhishGuard</h1>
            <span className="hidden md:inline-flex items-center gap-1.5 text-[10px] font-mono text-emerald-400 whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
              <span className="truncate">root@phishguard$ status ok</span>
              <span className="text-white shrink-0" title="System monitoring active">☠</span>
            </span>
          </div>
          <p className="text-xs text-neutral-400 font-medium truncate">Enterprise Security Management Console</p>
        </div>
      </div>

      {/* Status & Actions */}
      <div className="flex items-center gap-2 sm:gap-4 min-w-0 shrink-0">
        {/* Supabase Status Indicator */}
        {database === "supabase" && (
          <div
            className="hidden lg:flex items-center gap-1.5 bg-[#101c13] border border-emerald-800/60 px-2.5 py-1.5 rounded-lg text-xs shrink-0"
            title={`Connected to Supabase PostgreSQL: ${databaseHost || 'cloud'}`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
            <span className="text-emerald-300 font-mono text-[11px] font-semibold whitespace-nowrap">
              Supabase Connected
            </span>
          </div>
        )}

        {/* Enrolled Endpoints Metric */}
        <div className="hidden md:flex items-center gap-2 bg-[#161616] border border-[#2a2a2a] px-3 py-1.5 rounded-lg text-xs shrink-0">
          <Shield className="w-3.5 h-3.5 text-[#ffffff]" />
          <span className="text-neutral-300 font-mono whitespace-nowrap">
            <strong className="text-neutral-100">{totalCount}</strong> Enrolled {totalCount === 1 ? "System" : "Systems"}
          </span>
        </div>

        {/* Refresh Button */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="p-2 text-neutral-300 hover:text-white bg-[#161616] hover:bg-[#232323] border border-[#2a2a2a] rounded-lg transition-colors shrink-0"
          title="Refresh Telemetry Data"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-[#ffffff]" : ""}`} />
        </button>

        {/* Download Project ZIP */}
        <a
          href="/api/project/download-zip"
          download="phishguard-enterprise-fixed.zip"
          className="hidden sm:flex items-center gap-2 bg-[#1f1f1f] hover:bg-[#2b2b2b] text-neutral-200 border border-[#333] text-xs font-semibold px-3 py-2 rounded-lg transition-colors shrink-0 whitespace-nowrap"
          title="Download complete audited and corrected project ZIP archive"
        >
          <Download className="w-4 h-4 text-emerald-400" />
          <span>Project ZIP</span>
        </a>

        {/* Download Extension (.ZIP) Primary CTA */}
        <a
          href={getDownloadExtensionUrl()}
          download="phishguard-extension.zip"
          className="flex items-center gap-2 bg-white hover:bg-neutral-200 text-black text-xs font-bold px-3 sm:px-4 py-2 rounded-lg shadow-sm hover:shadow transition-all shrink-0 whitespace-nowrap"
        >
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">Download Extension (.ZIP)</span>
          <span className="sm:hidden">Extension</span>
        </a>
      </div>
    </header>
  );
};
