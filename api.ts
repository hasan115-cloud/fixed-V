import { DashboardStats, EnrolledClient, PhishingRule, RemovalRequest, ReportData, RuleSyncStatus, ThreatAlert, UrlEvent, WhitelistRule } from "./types";

export async function fetchStats(clientId?: string): Promise<DashboardStats> {
  // Scoped with the same clientId the URL History table uses, so both views
  // are always computed from the identical server-side record set.
  const query = clientId && clientId !== "ALL" ? `?clientId=${encodeURIComponent(clientId)}` : "";
  const res = await fetch(`/api/stats${query}`);
  if (!res.ok) throw new Error("Failed to load dashboard stats");
  return res.json();
}

export async function fetchClients(): Promise<EnrolledClient[]> {
  const res = await fetch("/api/clients");
  if (!res.ok) throw new Error("Failed to load enrolled clients");
  const data = await res.json();
  return data.clients || [];
}

export async function fetchClientDetails(id: string): Promise<{ client: EnrolledClient; events: UrlEvent[]; alerts: ThreatAlert[] }> {
  const res = await fetch(`/api/clients/${id}`);
  if (!res.ok) throw new Error("Failed to load client details");
  return res.json();
}

export async function deleteClient(id: string): Promise<boolean> {
  const res = await fetch(`/api/clients/${id}`, {
    method: "DELETE"
  });
  return res.ok;
}

export async function fetchEvents(params?: {
  clientId?: string;
  classification?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ events: UrlEvent[]; total: number }> {
  const query = new URLSearchParams();
  if (params?.clientId && params.clientId !== "ALL") query.set("clientId", params.clientId);
  if (params?.classification && params.classification !== "ALL") query.set("classification", params.classification);
  if (params?.search) query.set("search", params.search);
  if (params?.limit) query.set("limit", params.limit.toString());
  if (params?.offset) query.set("offset", params.offset.toString());

  const res = await fetch(`/api/events?${query.toString()}`);
  if (!res.ok) throw new Error("Failed to load URL history");
  return res.json();
}

export async function fetchThreatAlerts(clientId?: string): Promise<ThreatAlert[]> {
  const query = clientId && clientId !== "ALL" ? `?clientId=${clientId}` : "";
  const res = await fetch(`/api/threats${query}`);
  if (!res.ok) throw new Error("Failed to load threat alerts");
  const data = await res.json();
  return data.alerts || [];
}

export async function updateAlertStatus(id: string, status: "ACKNOWLEDGED" | "RESOLVED"): Promise<boolean> {
  const res = await fetch(`/api/threats/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status })
  });
  return res.ok;
}

export async function fetchRules(): Promise<{ whitelist: WhitelistRule[]; phishing: PhishingRule[]; ruleVersion?: number }> {
  const res = await fetch("/api/rules");
  if (!res.ok) throw new Error("Failed to load rules");
  return res.json();
}

export async function fetchRuleSyncStatus(): Promise<RuleSyncStatus> {
  const res = await fetch("/api/rules/status");
  if (!res.ok) throw new Error("Failed to load rule sync status");
  return res.json();
}

export async function bumpRuleVersion(): Promise<{ success: boolean; ruleVersion: number }> {
  const res = await fetch("/api/rules/bump", {
    method: "POST",
    headers: { "Content-Type": "application/json" }
  });
  if (!res.ok) throw new Error("Failed to update rule version");
  return res.json();
}

export async function addWhitelistRule(pattern: string, description: string): Promise<WhitelistRule> {
  const res = await fetch("/api/rules/whitelist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pattern, description })
  });
  if (!res.ok) throw new Error("Failed to add whitelist rule");
  const data = await res.json();
  return data.rule;
}

export async function updateWhitelistRule(id: string, updates: Partial<WhitelistRule>): Promise<WhitelistRule> {
  const res = await fetch(`/api/rules/whitelist/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates)
  });
  if (!res.ok) throw new Error("Failed to update whitelist rule");
  const data = await res.json();
  return data.rule;
}

export async function deleteWhitelistRule(id: string): Promise<boolean> {
  const res = await fetch(`/api/rules/whitelist/${id}`, { method: "DELETE" });
  return res.ok;
}

export async function addPhishingRule(pattern: string, severity: "HIGH" | "CRITICAL", reason: string): Promise<PhishingRule> {
  const res = await fetch("/api/rules/phishing", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pattern, severity, reason })
  });
  if (!res.ok) throw new Error("Failed to add phishing rule");
  const data = await res.json();
  return data.rule;
}

export async function updatePhishingRule(id: string, updates: Partial<PhishingRule>): Promise<PhishingRule> {
  const res = await fetch(`/api/rules/phishing/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates)
  });
  if (!res.ok) throw new Error("Failed to update phishing rule");
  const data = await res.json();
  return data.rule;
}

export async function deletePhishingRule(id: string): Promise<boolean> {
  const res = await fetch(`/api/rules/phishing/${id}`, { method: "DELETE" });
  return res.ok;
}

export async function fetchServerInfo(): Promise<{
  serverUrl: string;
  version: string;
  status: string;
  database?: string;
  databaseHost?: string;
}> {
  const res = await fetch("/api/info");
  if (!res.ok) throw new Error("Failed to load server info");
  return res.json();
}

export async function fetchReportData(clientId?: string, startDate?: string, endDate?: string): Promise<ReportData> {
  const params = new URLSearchParams();
  if (clientId && clientId !== "ALL") params.set("clientId", clientId);
  if (startDate) params.set("startDate", startDate);
  if (endDate) params.set("endDate", endDate);
  const qs = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`/api/reports${qs}`);
  if (!res.ok) throw new Error("Failed to load report data");
  return res.json();
}

export async function getAdminStatus(): Promise<{ configured: boolean; username: string }> {
  const res = await fetch("/api/admin/status");
  if (!res.ok) throw new Error("Failed to load admin status");
  return res.json();
}

export async function verifyAdminPassword(password: string): Promise<{ valid: boolean; username?: string }> {
  const res = await fetch("/api/admin/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Verification failed");
  }
  return res.json();
}

export async function changeAdminCredentials(
  currentPassword: string,
  newUsername: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  const res = await fetch("/api/admin/change-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currentPassword, newUsername, newPassword })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Failed to update admin credentials");
  }
  return data;
}

export function getDownloadExtensionUrl(): string {
  return "/api/download-extension";
}

export async function fetchRemovalRequests(): Promise<RemovalRequest[]> {
  const res = await fetch("/api/removal-requests");
  if (!res.ok) throw new Error("Failed to load removal requests");
  const data = await res.json();
  return data.requests || [];
}

export async function createRemovalRequest(payload: {
  clientId: string;
  clientName?: string;
  reason?: string;
}): Promise<RemovalRequest> {
  const res = await fetch("/api/removal-requests/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to submit removal request");
  }
  const data = await res.json();
  return data.request;
}

export async function reviewRemovalRequest(
  id: string,
  payload: { decision: "APPROVE" | "DENY"; username: string; password: string; note?: string }
): Promise<RemovalRequest> {
  const res = await fetch(`/api/removal-requests/${id}/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Failed to submit review decision");
  }
  return data.request;
}
