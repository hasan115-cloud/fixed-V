import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Edit2,
  Plus,
  Power,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  X,
  XCircle
} from "lucide-react";
import { PhishingRule, RuleSyncStatus, WhitelistRule } from "../types";
import {
  addPhishingRule,
  addWhitelistRule,
  bumpRuleVersion,
  deletePhishingRule,
  deleteWhitelistRule,
  fetchRules,
  fetchRuleSyncStatus,
  updatePhishingRule,
  updateWhitelistRule
} from "../api";

export const SecurityRulesView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"whitelist" | "phishing">("whitelist");
  const [whitelist, setWhitelist] = useState<WhitelistRule[]>([]);
  const [phishingRules, setPhishingRules] = useState<PhishingRule[]>([]);
  const [syncStatus, setSyncStatus] = useState<RuleSyncStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
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

  // Edit Modal state
  const [editingRule, setEditingRule] = useState<{
    id: string;
    type: "whitelist" | "phishing";
    pattern: string;
    descriptionOrReason: string;
    severity?: "HIGH" | "CRITICAL";
    enabled: boolean;
  } | null>(null);

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

  const handleDeployRules = async () => {
    setIsDeploying(true);
    try {
      const res = await bumpRuleVersion();
      setMessage({
        text: `✓ Deployed rules to fleet! Central rule version updated to v${res.ruleVersion}. Active browser extensions will synchronize automatically.`
      });
      await loadData();
    } catch (e: any) {
      setMessage({ text: `Failed to deploy rules: ${e.message}`, error: true });
    } finally {
      setIsDeploying(false);
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
      setMessage({ text: "Whitelist rule saved and deployed to fleet." });
      await loadData();
    } catch (err: any) {
      setMessage({ text: `Failed to add rule: ${err.message}`, error: true });
    } finally {
      setIsAddingWl(false);
    }
  };

  const handleToggleWhitelist = async (rule: WhitelistRule) => {
    const newEnabled = rule.enabled === false ? true : false;
    try {
      await updateWhitelistRule(rule.id, { enabled: newEnabled });
      setWhitelist(prev =>
        prev.map(r => (r.id === rule.id ? { ...r, enabled: newEnabled } : r))
      );
      setMessage({
        text: `Rule "${rule.pattern}" is now ${newEnabled ? "ENABLED (Active)" : "DISABLED (Inactive)"}.`
      });
      await loadData();
    } catch (err: any) {
      setMessage({ text: `Failed to toggle rule: ${err.message}`, error: true });
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
      setMessage({ text: "Phishing blacklist rule saved and deployed to fleet." });
      await loadData();
    } catch (err: any) {
      setMessage({ text: `Failed to add rule: ${err.message}`, error: true });
    } finally {
      setIsAddingPh(false);
    }
  };

  const handleTogglePhishing = async (rule: PhishingRule) => {
    const newEnabled = rule.enabled === false ? true : false;
    try {
      await updatePhishingRule(rule.id, { enabled: newEnabled });
      setPhishingRules(prev =>
        prev.map(r => (r.id === rule.id ? { ...r, enabled: newEnabled } : r))
      );
      setMessage({
        text: `Blacklist rule "${rule.pattern}" is now ${newEnabled ? "ENABLED (Active)" : "DISABLED (Inactive)"}.`
      });
      await loadData();
    } catch (err: any) {
      setMessage({ text: `Failed to toggle rule: ${err.message}`, error: true });
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

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRule) return;

    try {
      if (editingRule.type === "whitelist") {
        await updateWhitelistRule(editingRule.id, {
          pattern: editingRule.pattern,
          description: editingRule.descriptionOrReason,
          enabled: editingRule.enabled
        });
      } else {
        await updatePhishingRule(editingRule.id, {
          pattern: editingRule.pattern,
          reason: editingRule.descriptionOrReason,
          severity: editingRule.severity || "HIGH",
          enabled: editingRule.enabled
        });
      }
      setEditingRule(null);
      setMessage({ text: "Rule updated successfully." });
      await loadData();
    } catch (err: any) {
      setMessage({ text: `Failed to update rule: ${err.message}`, error: true });
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
            Rules configured here are the authoritative source for phishing detection and whitelist enforcement across all connected extensions.
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
            onClick={handleDeployRules}
            disabled={isDeploying}
            className="flex items-center gap-2 bg-[#1f1f1f] hover:bg-[#2a2a2a] border border-[#333] text-neutral-100 text-xs px-3.5 py-2 rounded-lg transition-colors font-medium shadow-sm"
            title="Deploy latest rule definitions to all connected Chrome extensions"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isDeploying ? "animate-spin text-emerald-400" : "text-emerald-400"}`} />
            <span>{isDeploying ? "Deploying..." : "Deploy Rules to Fleet"}</span>
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
                placeholder="Description / Purpose (e.g. Authorized Vendor Portal)"
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
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Pattern</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Added By</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#222]">
                  {filteredWhitelist.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-neutral-500">
                        No whitelist rules match your criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredWhitelist.map(rule => (
                      <tr key={rule.id} className="hover:bg-[#1a1a1a] transition-colors">
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleToggleWhitelist(rule)}
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                              rule.enabled !== false
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                                : "bg-neutral-800 text-neutral-400 border-neutral-700 hover:bg-neutral-700"
                            }`}
                            title="Click to toggle Enabled/Disabled"
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${rule.enabled !== false ? "bg-emerald-400" : "bg-neutral-500"}`}></span>
                            {rule.enabled !== false ? "ACTIVE" : "DISABLED"}
                          </button>
                        </td>
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
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() =>
                                setEditingRule({
                                  id: rule.id,
                                  type: "whitelist",
                                  pattern: rule.pattern,
                                  descriptionOrReason: rule.description || "",
                                  enabled: rule.enabled !== false
                                })
                              }
                              className="text-neutral-400 hover:text-neutral-200 transition-colors p-1"
                              title="Edit Rule"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteWhitelist(rule.id)}
                              className="text-neutral-400 hover:text-red-400 transition-colors p-1"
                              title="Delete Rule"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
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
                    <th className="px-4 py-3">Status</th>
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
                      <td colSpan={6} className="px-4 py-8 text-center text-neutral-500">
                        No phishing blacklist rules recorded.
                      </td>
                    </tr>
                  ) : (
                    filteredPhishing.map(rule => (
                      <tr key={rule.id} className="hover:bg-[#1a1a1a] transition-colors">
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleTogglePhishing(rule)}
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                              rule.enabled !== false
                                ? "bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20"
                                : "bg-neutral-800 text-neutral-400 border-neutral-700 hover:bg-neutral-700"
                            }`}
                            title="Click to toggle Enabled/Disabled"
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${rule.enabled !== false ? "bg-red-400" : "bg-neutral-500"}`}></span>
                            {rule.enabled !== false ? "ACTIVE" : "DISABLED"}
                          </button>
                        </td>
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
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() =>
                                setEditingRule({
                                  id: rule.id,
                                  type: "phishing",
                                  pattern: rule.pattern,
                                  descriptionOrReason: rule.reason || "",
                                  severity: rule.severity,
                                  enabled: rule.enabled !== false
                                })
                              }
                              className="text-neutral-400 hover:text-neutral-200 transition-colors p-1"
                              title="Edit Rule"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeletePhishing(rule.id)}
                              className="text-neutral-400 hover:text-red-400 transition-colors p-1"
                              title="Delete Rule"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
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

      {/* Edit Rule Modal */}
      {editingRule && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[#121212] border border-[#2c2c2c] rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#262626] pb-3">
              <h3 className="text-sm font-bold text-neutral-100 flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-emerald-400" />
                <span>Edit {editingRule.type === "whitelist" ? "Whitelist" : "Phishing"} Rule</span>
              </h3>
              <button
                onClick={() => setEditingRule(null)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-neutral-400 block mb-1">
                  Pattern / Domain
                </label>
                <input
                  type="text"
                  value={editingRule.pattern}
                  onChange={e => setEditingRule({ ...editingRule, pattern: e.target.value })}
                  className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2 text-xs text-neutral-100 font-mono focus:outline-none focus:border-neutral-400"
                  required
                />
              </div>

              {editingRule.type === "phishing" && (
                <div>
                  <label className="text-[11px] font-semibold text-neutral-400 block mb-1">
                    Severity
                  </label>
                  <select
                    value={editingRule.severity}
                    onChange={e => setEditingRule({ ...editingRule, severity: e.target.value as any })}
                    className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2 text-xs text-neutral-100 focus:outline-none"
                  >
                    <option value="HIGH">HIGH</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                </div>
              )}

              <div>
                <label className="text-[11px] font-semibold text-neutral-400 block mb-1">
                  {editingRule.type === "whitelist" ? "Description / Notes" : "Interception Reason"}
                </label>
                <input
                  type="text"
                  value={editingRule.descriptionOrReason}
                  onChange={e => setEditingRule({ ...editingRule, descriptionOrReason: e.target.value })}
                  className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-neutral-400"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="ruleEnabledCheckbox"
                  checked={editingRule.enabled}
                  onChange={e => setEditingRule({ ...editingRule, enabled: e.target.checked })}
                  className="rounded bg-[#0a0a0a] border-[#333] text-emerald-500 focus:ring-0"
                />
                <label htmlFor="ruleEnabledCheckbox" className="text-xs text-neutral-300 cursor-pointer">
                  Rule is active and enforced by extensions
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#262626]">
                <button
                  type="button"
                  onClick={() => setEditingRule(null)}
                  className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold bg-white text-black hover:bg-neutral-200 rounded-lg transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
