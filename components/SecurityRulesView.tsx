import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2
} from "lucide-react";
import { PhishingRule, RuleSyncStatus, WhitelistRule } from "../types";
import {
  addPhishingRule,
  addWhitelistRule,
  bumpRuleVersion,
  deletePhishingRule,
  deleteWhitelistRule,
  fetchRules,
  fetchRuleSyncStatus
} from "../api";

export const SecurityRulesView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"whitelist" | "phishing">("whitelist");
  const [whitelist, setWhitelist] = useState<WhitelistRule[]>([]);
  const [phishingRules, setPhishingRules] = useState<PhishingRule[]>([]);
  const [syncStatus, setSyncStatus] = useState<RuleSyncStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");

  // Whitelist form state
  const [wlPattern, setWlPattern] = useState("");
  const [wlDesc, setWlDesc] = useState("");
  const [isAddingWl, setIsAddingWl] = useState(false);

  // Phishing form state
  const [phPattern, setPhPattern] = useState("");
  const [phSeverity, setPhSeverity] = useState<"HIGH" | "CRITICAL">("HIGH");
  const [phReason, setPhReason] = useState("");
  const [isAddingPh, setIsAddingPh] = useState(false);

  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [rulesData, statusData] = await Promise.all([
        fetchRules(),
        fetchRuleSyncStatus().catch(() => null)
      ]);
      setWhitelist(rulesData.whitelist || []);
      setPhishingRules(rulesData.phishing || []);
      if (statusData) setSyncStatus(statusData);
    } catch (e: any) {
      console.error("Failed to load security rules:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleBumpVersion = async () => {
    try {
      const res = await bumpRuleVersion();
      setMessage({ text: `Central rule version bumped to v${res.ruleVersion}. Connected agents will sync.` });
      await loadData();
    } catch (e: any) {
      setMessage({ text: `Failed to bump version: ${e.message}`, error: true });
    }
  };

  const handleAddWhitelist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wlPattern.trim()) return;
    setIsAddingWl(true);
    try {
      await addWhitelistRule(wlPattern.trim(), wlDesc.trim());
      setWlPattern("");
      setWlDesc("");
      setMessage({ text: "Whitelist rule added successfully." });
      await loadData();
    } catch (err: any) {
      setMessage({ text: `Failed to add rule: ${err.message}`, error: true });
    } finally {
      setIsAddingWl(false);
    }
  };

  const handleDeleteWhitelist = async (id: string) => {
    try {
      await deleteWhitelistRule(id);
      setWhitelist(prev => prev.filter(r => r.id !== id));
      setMessage({ text: "Whitelist rule removed." });
    } catch (err: any) {
      setMessage({ text: `Failed to delete rule: ${err.message}`, error: true });
    }
  };

  const handleAddPhishing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phPattern.trim()) return;
    setIsAddingPh(true);
    try {
      await addPhishingRule(phPattern.trim(), phSeverity, phReason.trim());
      setPhPattern("");
      setPhReason("");
      setMessage({ text: "Phishing blacklist rule added successfully." });
      await loadData();
    } catch (err: any) {
      setMessage({ text: `Failed to add rule: ${err.message}`, error: true });
    } finally {
      setIsAddingPh(false);
    }
  };

  const handleDeletePhishing = async (id: string) => {
    try {
      await deletePhishingRule(id);
      setPhishingRules(prev => prev.filter(r => r.id !== id));
      setMessage({ text: "Phishing rule removed." });
    } catch (err: any) {
      setMessage({ text: `Failed to delete rule: ${err.message}`, error: true });
    }
  };

  const filteredWhitelist = whitelist.filter(
    r =>
      r.pattern.toLowerCase().includes(search.toLowerCase()) ||
      r.description?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredPhishing = phishingRules.filter(
    r =>
      r.pattern.toLowerCase().includes(search.toLowerCase()) ||
      r.reason?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Banner / Sync Status */}
      <div className="bg-[#121212] border border-[#262626] rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-white" />
            <h2 className="text-lg font-bold text-neutral-100">Central Security Policy & Rules</h2>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Rules configured here are pushed to all enrolled browser agents via background heartbeat synchronization.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-[#181818] border border-[#2e2e2e] px-3 py-2 rounded-lg text-xs font-mono">
            <span className="text-neutral-400">Rule Version: </span>
            <span className="text-emerald-400 font-bold">
              v{syncStatus?.centralRuleVersion || syncStatus?.serverVersion || 1}
            </span>
          </div>
          <button
            onClick={handleBumpVersion}
            className="flex items-center gap-2 bg-[#1f1f1f] hover:bg-[#2a2a2a] border border-[#333] text-neutral-200 text-xs px-3 py-2 rounded-lg transition-colors font-medium"
            title="Force push policy version bump to fleet"
          >
            <RefreshCw className="w-3.5 h-3.5 text-neutral-400" />
            <span>Bump Version</span>
          </button>
        </div>
      </div>

      {/* Sync Metrics Bar */}
      {syncStatus && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-[#121212] border border-[#262626] p-3 rounded-lg">
            <div className="text-[11px] text-neutral-400">Synchronized Agents</div>
            <div className="text-lg font-bold text-emerald-400 font-mono mt-0.5">
              {syncStatus.synchronized ?? 0}
            </div>
          </div>
          <div className="bg-[#121212] border border-[#262626] p-3 rounded-lg">
            <div className="text-[11px] text-neutral-400">Outdated Agents</div>
            <div className="text-lg font-bold text-amber-400 font-mono mt-0.5">
              {syncStatus.outdated ?? 0}
            </div>
          </div>
          <div className="bg-[#121212] border border-[#262626] p-3 rounded-lg">
            <div className="text-[11px] text-neutral-400">Offline Agents</div>
            <div className="text-lg font-bold text-neutral-400 font-mono mt-0.5">
              {syncStatus.offline ?? 0}
            </div>
          </div>
          <div className="bg-[#121212] border border-[#262626] p-3 rounded-lg">
            <div className="text-[11px] text-neutral-400">Total Enrolled</div>
            <div className="text-lg font-bold text-neutral-100 font-mono mt-0.5">
              {syncStatus.totalEnrolled ?? 0}
            </div>
          </div>
        </div>
      )}

      {message && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center justify-between ${
            message.error
              ? "bg-red-500/10 text-red-300 border border-red-500/30"
              : "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-xs font-bold hover:underline ml-2">
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-[#262626] gap-4">
        <button
          onClick={() => setActiveTab("whitelist")}
          className={`pb-3 text-xs font-bold transition-colors flex items-center gap-2 border-b-2 ${
            activeTab === "whitelist"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-neutral-400 hover:text-neutral-200"
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Whitelist Rules ({whitelist.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("phishing")}
          className={`pb-3 text-xs font-bold transition-colors flex items-center gap-2 border-b-2 ${
            activeTab === "phishing"
              ? "border-red-500 text-red-400"
              : "border-transparent text-neutral-400 hover:text-neutral-200"
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Phishing Blacklist ({phishingRules.length})</span>
        </button>
      </div>

      {/* Whitelist View */}
      {activeTab === "whitelist" && (
        <div className="space-y-4">
          {/* Add Whitelist Rule Form */}
          <form onSubmit={handleAddWhitelist} className="bg-[#141414] border border-[#262626] rounded-xl p-4 space-y-3">
            <div className="text-xs font-bold text-neutral-200 flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-400" />
              <span>Add Enterprise Whitelist Pattern</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Domain or pattern (e.g. partner-portal.corp, *.internal.ac)"
                value={wlPattern}
                onChange={e => setWlPattern(e.target.value)}
                className="bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-neutral-400 font-mono"
                required
              />
              <input
                type="text"
                placeholder="Description or justification (e.g. Verified B2B Partner Portal)"
                value={wlDesc}
                onChange={e => setWlDesc(e.target.value)}
                className="bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-neutral-400"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isAddingWl || !wlPattern.trim()}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isAddingWl ? "Saving..." : "Add Whitelist Rule"}</span>
              </button>
            </div>
          </form>

          {/* Whitelist Table */}
          <div className="bg-[#141414] border border-[#262626] rounded-xl overflow-hidden">
            <div className="p-3 border-b border-[#262626] flex items-center justify-between">
              <div className="relative w-full max-w-xs">
                <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter whitelist rules..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg pl-8 pr-3 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none"
                />
              </div>
              <span className="text-xs text-neutral-400 font-mono">
                {filteredWhitelist.length} rules
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#191919] text-neutral-400 font-semibold uppercase text-[10px] tracking-wider border-b border-[#262626]">
                  <tr>
                    <th className="px-4 py-3">Pattern</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Added By</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#222]">
                  {filteredWhitelist.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-neutral-500">
                        No whitelist rules match your criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredWhitelist.map(rule => (
                      <tr key={rule.id} className="hover:bg-[#1a1a1a] transition-colors">
                        <td className="px-4 py-3 font-mono font-medium text-emerald-300">
                          {rule.pattern}
                        </td>
                        <td className="px-4 py-3 text-neutral-300">
                          {rule.description || "—"}
                        </td>
                        <td className="px-4 py-3 text-neutral-400">
                          {rule.addedBy || "Admin"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleDeleteWhitelist(rule.id)}
                            className="text-neutral-400 hover:text-red-400 transition-colors p-1"
                            title="Delete Rule"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Phishing Blacklist View */}
      {activeTab === "phishing" && (
        <div className="space-y-4">
          {/* Add Phishing Rule Form */}
          <form onSubmit={handleAddPhishing} className="bg-[#141414] border border-[#262626] rounded-xl p-4 space-y-3">
            <div className="text-xs font-bold text-neutral-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span>Add Central Phishing Blacklist Rule</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="Domain pattern (e.g. login-verify-bank.com)"
                value={phPattern}
                onChange={e => setPhPattern(e.target.value)}
                className="bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-neutral-400 font-mono"
                required
              />
              <select
                value={phSeverity}
                onChange={e => setPhSeverity(e.target.value as any)}
                className="bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2 text-xs text-neutral-100 focus:outline-none"
              >
                <option value="HIGH">Severity: HIGH</option>
                <option value="CRITICAL">Severity: CRITICAL</option>
              </select>
              <input
                type="text"
                placeholder="Reason (e.g. Impersonating company login)"
                value={phReason}
                onChange={e => setPhReason(e.target.value)}
                className="bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-neutral-400"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isAddingPh || !phPattern.trim()}
                className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isAddingPh ? "Saving..." : "Add Blacklist Rule"}</span>
              </button>
            </div>
          </form>

          {/* Phishing Table */}
          <div className="bg-[#141414] border border-[#262626] rounded-xl overflow-hidden">
            <div className="p-3 border-b border-[#262626] flex items-center justify-between">
              <div className="relative w-full max-w-xs">
                <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter phishing rules..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg pl-8 pr-3 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none"
                />
              </div>
              <span className="text-xs text-neutral-400 font-mono">
                {filteredPhishing.length} rules
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#191919] text-neutral-400 font-semibold uppercase text-[10px] tracking-wider border-b border-[#262626]">
                  <tr>
                    <th className="px-4 py-3">Pattern</th>
                    <th className="px-4 py-3">Severity</th>
                    <th className="px-4 py-3">Reason</th>
                    <th className="px-4 py-3">Added By</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#222]">
                  {filteredPhishing.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-neutral-500">
                        No phishing blacklist rules recorded.
                      </td>
                    </tr>
                  ) : (
                    filteredPhishing.map(rule => (
                      <tr key={rule.id} className="hover:bg-[#1a1a1a] transition-colors">
                        <td className="px-4 py-3 font-mono font-medium text-red-300">
                          {rule.pattern}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              rule.severity === "CRITICAL"
                                ? "bg-red-500/20 text-red-300 border border-red-500/40"
                                : "bg-orange-500/20 text-orange-300 border border-orange-500/40"
                            }`}
                          >
                            {rule.severity}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-neutral-300">
                          {rule.reason || "—"}
                        </td>
                        <td className="px-4 py-3 text-neutral-400">
                          {rule.addedBy || "Admin"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleDeletePhishing(rule.id)}
                            className="text-neutral-400 hover:text-red-400 transition-colors p-1"
                            title="Delete Rule"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
