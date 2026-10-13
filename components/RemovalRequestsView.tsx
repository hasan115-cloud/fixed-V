"use client";

import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Laptop,
  Lock,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  X,
  XCircle
} from "lucide-react";
import { RemovalRequest } from "../types";
import { fetchRemovalRequests, reviewRemovalRequest } from "../api";

interface RemovalRequestsViewProps {
  onRefreshBadge?: () => void;
}

export const RemovalRequestsView: React.FC<RemovalRequestsViewProps> = ({ onRefreshBadge }) => {
  const [requests, setRequests] = useState<RemovalRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [search, setSearch] = useState("");

  // Review Modal State
  const [selectedRequest, setSelectedRequest] = useState<RemovalRequest | null>(null);
  const [reviewDecision, setReviewDecision] = useState<"APPROVE" | "DENY">("APPROVE");
  const [adminUsername, setAdminUsername] = useState("admin");
  const [adminPassword, setAdminPassword] = useState("");
  const [decisionNote, setDecisionNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Copied token state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadRequests = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const data = await fetchRemovalRequests();
      setRequests(data);
      onRefreshBadge?.();
    } catch (e) {
      console.warn("Notice: could not load removal requests:", e);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRequests(false);
    // Real-time 2-second polling as mandated
    const timer = setInterval(() => {
      loadRequests(true);
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  const handleOpenReview = (req: RemovalRequest, decision: "APPROVE" | "DENY") => {
    setSelectedRequest(req);
    setReviewDecision(decision);
    setAdminPassword("");
    setDecisionNote("");
    setModalError(null);
  };

  const handleCloseReview = () => {
    setSelectedRequest(null);
    setAdminPassword("");
    setModalError(null);
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;
    if (!adminUsername || !adminPassword) {
      setModalError("Admin username and password are required.");
      return;
    }

    setIsSubmitting(true);
    setModalError(null);

    try {
      await reviewRemovalRequest(selectedRequest.id, {
        decision: reviewDecision,
        username: adminUsername,
        password: adminPassword,
        note: decisionNote
      });
      handleCloseReview();
      loadRequests(false);
    } catch (err: any) {
      setModalError(err.message || "Failed to submit review decision.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToken = (token: string, id: string) => {
    navigator.clipboard.writeText(token);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredRequests = requests.filter(r => {
    if (filterStatus !== "ALL" && r.status !== filterStatus) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        r.clientId.toLowerCase().includes(q) ||
        r.clientName.toLowerCase().includes(q) ||
        (r.reason && r.reason.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const pendingCount = requests.filter(r => r.status === "PENDING").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-[#0e0e0e] border border-[#262626] p-5 rounded-xl">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-neutral-100 flex items-center gap-2">
            <Lock className="w-5 h-5 text-neutral-300" />
            <span>Extension Removal Requests</span>
            {pendingCount > 0 && (
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                {pendingCount} Pending
              </span>
            )}
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Centrally governed endpoint uninstall requests. Approval issues single-device, short-lived (15-min) replay-protected tokens.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => loadRequests(false)}
            disabled={isLoading}
            className="text-xs bg-[#161616] hover:bg-[#222222] text-neutral-200 border border-[#262626] font-medium px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-sky-400" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Enterprise Policy Advisory Card */}
      <div className="bg-[#121212] border border-[#262626] p-4 rounded-xl flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="text-xs text-neutral-300 space-y-1">
          <p className="font-semibold text-neutral-100">
            Enterprise Chromium Architecture & Enforcement Guidance
          </p>
          <p className="text-neutral-400 leading-relaxed">
            In standard unmanaged Chrome profiles, extensions cannot natively disable Chrome's browser menu removal button.
            For permanent enterprise workstation enforcement, deploy PhishGuard via <strong>Chrome Enterprise Force-Install Policy</strong> (GPO / Intune / Jamf) as detailed in the <strong className="text-neutral-200">Admin & Policies</strong> view.
            When removal requests are approved here, the authorization applies strictly to that specific device ID and expires automatically after 15 minutes.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#0e0e0e] border border-[#262626] p-4 rounded-xl">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-neutral-400 font-medium">Status:</span>
          {["ALL", "PENDING", "APPROVED", "DENIED", "EXPIRED"].map(st => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                filterStatus === st
                  ? "bg-white text-black font-semibold"
                  : "bg-[#161616] text-neutral-300 hover:bg-[#222222]"
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-neutral-400" />
          <input
            type="text"
            placeholder="Search by device ID, reason..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-[#161616] border border-[#262626] text-neutral-200 text-xs pl-9 pr-3 py-1.5 rounded-lg focus:outline-none focus:border-neutral-400 w-full sm:w-60"
          />
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-[#0e0e0e] border border-[#262626] rounded-xl overflow-hidden">
        {isLoading && requests.length === 0 ? (
          <div className="p-12 text-center text-xs text-neutral-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-neutral-400" />
            Loading removal requests from database...
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-12 text-center text-xs text-neutral-500">
            <Shield className="w-8 h-8 mx-auto mb-2 text-neutral-600 opacity-60" />
            No extension removal requests found matching current filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#141414] text-neutral-400 border-b border-[#262626] text-[11px] font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Device / System</th>
                  <th className="py-3 px-4">Request Time</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Reason / Notes</th>
                  <th className="py-3 px-4">Auth Token / Expiry</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#202020] text-neutral-300">
                {filteredRequests.map(r => (
                  <tr key={r.id} className="hover:bg-[#121212] transition-colors">
                    {/* Device / System */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <Laptop className="w-4 h-4 text-neutral-400 shrink-0" />
                        <div>
                          <div className="font-semibold text-neutral-200">{r.clientName}</div>
                          <div className="text-[11px] font-mono text-neutral-500">{r.clientId}</div>
                        </div>
                      </div>
                    </td>

                    {/* Request Time */}
                    <td className="py-3.5 px-4 text-neutral-400 font-mono text-[11px]">
                      {new Date(r.requestedAt).toLocaleString()}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      {r.status === "PENDING" && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                          <Clock className="w-3 h-3" />
                          PENDING
                        </span>
                      )}
                      {r.status === "APPROVED" && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" />
                          APPROVED
                        </span>
                      )}
                      {r.status === "DENIED" && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                          <XCircle className="w-3 h-3" />
                          DENIED
                        </span>
                      )}
                      {r.status === "EXPIRED" && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-neutral-500/10 text-neutral-400 border border-neutral-500/30">
                          EXPIRED
                        </span>
                      )}
                    </td>

                    {/* Reason / Notes */}
                    <td className="py-3.5 px-4 max-w-xs truncate">
                      <div>{r.reason || "—"}</div>
                      {r.decisionNote && (
                        <div className="text-[10px] text-neutral-500 mt-0.5 truncate">
                          Admin note: {r.decisionNote}
                        </div>
                      )}
                    </td>

                    {/* Auth Token / Expiry */}
                    <td className="py-3.5 px-4 font-mono text-[11px]">
                      {r.authorizationToken ? (
                        <div className="flex items-center gap-2">
                          <code className="text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-500/20 truncate max-w-[140px]">
                            {r.authorizationToken}
                          </code>
                          <button
                            onClick={() => copyToken(r.authorizationToken!, r.id)}
                            className="p-1 hover:text-white text-neutral-400"
                            title="Copy Token"
                          >
                            {copiedId === r.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      ) : r.status === "APPROVED" && !r.authorizationToken ? (
                        <span className="text-neutral-500 text-[10px]">Consumed</span>
                      ) : (
                        <span className="text-neutral-600">—</span>
                      )}
                      {r.tokenExpiresAt && (
                        <div className="text-[10px] text-neutral-500 mt-0.5">
                          Expires: {new Date(r.tokenExpiresAt).toLocaleTimeString()}
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      {r.status === "PENDING" ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenReview(r, "APPROVE")}
                            className="text-xs bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 px-2.5 py-1 rounded font-medium transition-colors"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleOpenReview(r, "DENY")}
                            className="text-xs bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 px-2.5 py-1 rounded font-medium transition-colors"
                          >
                            Deny
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-neutral-500 font-mono">
                          Reviewed by {r.reviewedBy || "Admin"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Review Modal Dialog */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-[#141414] border border-[#2b2b2b] rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#262626]">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-neutral-200" />
                <h3 className="text-sm font-bold text-white">
                  {reviewDecision === "APPROVE" ? "Approve Removal Request" : "Deny Removal Request"}
                </h3>
              </div>
              <button onClick={handleCloseReview} className="text-neutral-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs space-y-2 bg-[#1a1a1a] p-3 rounded-lg border border-[#262626]">
              <div className="flex justify-between">
                <span className="text-neutral-400">Device ID:</span>
                <span className="font-mono text-neutral-200">{selectedRequest.clientId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Device Name:</span>
                <span className="text-neutral-200">{selectedRequest.clientName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Request Reason:</span>
                <span className="text-neutral-200 truncate max-w-[200px]">{selectedRequest.reason || "None specified"}</span>
              </div>
            </div>

            {reviewDecision === "APPROVE" ? (
              <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-lg leading-relaxed">
                Approving this request will generate a single-use authorization token valid for 15 minutes. Only this specific device ID will be authorized to unenroll.
              </p>
            ) : (
              <p className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-lg leading-relaxed">
                Denying this request keeps the device enrolled and active under PhishGuard protection.
              </p>
            )}

            {modalError && (
              <div className="text-xs bg-rose-500/15 border border-rose-500/30 text-rose-300 p-2 rounded-lg font-mono">
                {modalError}
              </div>
            )}

            <form onSubmit={handleSubmitReview} className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                  Administrator Username
                </label>
                <input
                  type="text"
                  value={adminUsername}
                  onChange={e => setAdminUsername(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#262626] text-neutral-100 text-xs px-3 py-2 rounded-lg focus:outline-none focus:border-white"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                  Administrator Password
                </label>
                <input
                  type="password"
                  placeholder="Enter admin password to authorize"
                  value={adminPassword}
                  onChange={e => setAdminPassword(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#262626] text-neutral-100 text-xs px-3 py-2 rounded-lg focus:outline-none focus:border-white"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                  Decision Audit Note (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Approved for hardware refresh"
                  value={decisionNote}
                  onChange={e => setDecisionNote(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#262626] text-neutral-100 text-xs px-3 py-2 rounded-lg focus:outline-none focus:border-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleCloseReview}
                  className="px-3.5 py-1.5 text-xs text-neutral-300 hover:text-white hover:bg-[#222] rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-4 py-1.5 text-xs font-semibold text-white rounded-lg transition-colors flex items-center gap-1.5 ${
                    reviewDecision === "APPROVE"
                      ? "bg-emerald-600 hover:bg-emerald-500"
                      : "bg-rose-600 hover:bg-rose-500"
                  }`}
                >
                  {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{reviewDecision === "APPROVE" ? "Confirm Approval" : "Confirm Denial"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
