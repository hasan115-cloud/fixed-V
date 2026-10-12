import { SupabaseClient } from "@supabase/supabase-js";
import {
  AdminCredentials,
  EnrolledClient,
  ONLINE_THRESHOLD_MS,
  PhishingRule,
  RemovalRequest,
  RuleSyncStatus,
  ThreatAlert,
  UrlEvent,
  WhitelistRule
} from "./types";
import {
  IDatabase,
  UrlEventFilters,
  UrlEventsResult,
  DashboardStatsResult,
  ReportDataResult
} from "./dbTypes";

export class SupabaseRestDatabase implements IDatabase {
  private client: SupabaseClient;
  private projectUrl: string;
  private memoryCache: {
    clients: Map<string, any>;
    events: any[];
    alerts: any[];
    whitelist: any[];
    phishing: any[];
    removalRequests: RemovalRequest[];
  };

  constructor(client: SupabaseClient, projectUrl: string = "") {
    this.client = client;
    this.projectUrl = projectUrl;
    this.memoryCache = {
      clients: new Map(),
      events: [],
      alerts: [],
      whitelist: [],
      phishing: [],
      removalRequests: []
    };
  }

  public getDatabaseInfo(): { isSupabase: boolean; host: string } {
    let host = "supabase-rest";
    try {
      if (this.projectUrl) {
        host = new URL(this.projectUrl).hostname;
      }
    } catch {}
    return { isSupabase: true, host };
  }

  public isPossiblyEphemeralDeployment(): boolean {
    return Boolean(
      process.env.VERCEL ||
      process.env.VERCEL_ENV ||
      process.env.NETLIFY ||
      process.env.AWS_LAMBDA_FUNCTION_NAME
    );
  }

  // ─── Mapping helpers ────────────────────────────────────────────────────────
  private mapClient(r: any): EnrolledClient {
    const timeVal = r.last_seen || r.created_at || new Date();
    const parsedTime = new Date(timeVal);
    const lastSeenIso = !isNaN(parsedTime.getTime()) ? parsedTime.toISOString() : new Date().toISOString();
    const firstSeenVal = r.first_seen || r.created_at || new Date();
    const parsedFirst = new Date(firstSeenVal);
    const firstSeenIso = !isNaN(parsedFirst.getTime()) ? parsedFirst.toISOString() : new Date().toISOString();

    return {
      id: r.id,
      clientName: r.client_name || r.clientName || "Workstation",
      firstSeen: firstSeenIso,
      lastSeen: lastSeenIso,
      status: r.status || "ENROLLED",
      connectionStatus: Date.now() - new Date(lastSeenIso).getTime() < ONLINE_THRESHOLD_MS ? "ONLINE" : "OFFLINE",
      extensionVersion: r.extension_version || r.extensionVersion || "1.4",
      ruleVersion: r.rule_version || r.ruleVersion || 1,
      browser: r.browser || "Chrome",
      os: r.os || "Linux",
      platform: r.platform || "x86_64",
      ip: r.ip || "remote-ip",
      telemetryStats: { totalScanned: 0, phishingBlocked: 0, suspiciousDetected: 0, safeEvaluated: 0 }
    };
  }

  private mapUrlEvent(r: any): UrlEvent {
    const timeVal = r.occurred_at || r.created_at || new Date();
    const parsedTime = new Date(timeVal);
    const validIso = !isNaN(parsedTime.getTime()) ? parsedTime.toISOString() : new Date().toISOString();
    return {
      id: r.id,
      eventId: r.event_id || r.eventId || undefined,
      timestamp: validIso,
      clientId: r.client_id || r.clientId || "unknown",
      clientName: r.client_name || r.clientName || "Workstation",
      url: r.url,
      domain: r.domain,
      classification: r.classification,
      verdict: r.verdict,
      score: typeof r.score === "number" ? r.score : parseFloat(r.score || "0"),
      reason: r.reason,
      source: r.source || "extension",
      ruleTriggered: Boolean(r.rule_triggered || r.ruleTriggered),
      ruleType: r.rule_type || r.ruleType || null
    };
  }

  private mapThreatAlert(r: any): ThreatAlert {
    const timeVal = r.occurred_at || r.created_at || new Date();
    const parsedTime = new Date(timeVal);
    const validIso = !isNaN(parsedTime.getTime()) ? parsedTime.toISOString() : new Date().toISOString();
    return {
      id: r.id,
      timestamp: validIso,
      clientId: r.client_id || r.clientId || "unknown",
      clientName: r.client_name || r.clientName || "Workstation",
      url: r.url,
      domain: r.domain,
      score: typeof r.score === "number" ? r.score : parseFloat(r.score || "0"),
      reasons: Array.isArray(r.reasons) ? r.reasons : [],
      source: r.source || "extension",
      status: r.status || "ACTIVE"
    };
  }

  private mapWhitelistRule(r: any): WhitelistRule {
    const timeVal = r.created_at || new Date();
    const parsedTime = new Date(timeVal);
    const validIso = !isNaN(parsedTime.getTime()) ? parsedTime.toISOString() : new Date().toISOString();
    return {
      id: r.id,
      pattern: r.pattern,
      description: r.description || "Whitelisted domain",
      createdAt: validIso,
      addedBy: r.added_by || r.addedBy || "Admin"
    };
  }

  private mapPhishingRule(r: any): PhishingRule {
    const timeVal = r.created_at || new Date();
    const parsedTime = new Date(timeVal);
    const validIso = !isNaN(parsedTime.getTime()) ? parsedTime.toISOString() : new Date().toISOString();
    return {
      id: r.id,
      pattern: r.pattern,
      severity: r.severity || "HIGH",
      reason: r.reason || "Threat rule",
      createdAt: validIso,
      addedBy: r.added_by || r.addedBy || "Admin"
    };
  }

  // ─── Rule Versioning & Policy Sync ─────────────────────────────────────────
  public async getRuleVersion(): Promise<number> {
    try {
      const { data } = await this.client.from("system_settings").select("value").eq("key", "rule_version").single();
      if (data && typeof data.value === "number") return data.value;
    } catch {}
    return (this.memoryCache as any).ruleVersion || 1;
  }

  public async bumpRuleVersion(): Promise<number> {
    const current = await this.getRuleVersion();
    const next = current + 1;
    (this.memoryCache as any).ruleVersion = next;
    try {
      await this.client.from("system_settings").upsert([{ key: "rule_version", value: next }]);
    } catch {}
    return next;
  }

  public async getRuleSyncStatus(): Promise<RuleSyncStatus> {
    const centralRuleVersion = await this.getRuleVersion();
    const clients = await this.getClients();
    const totalEnrolled = clients.length;
    const synchronized = clients.filter(c => c.connectionStatus === "ONLINE" && (c.ruleVersion || 0) === centralRuleVersion).length;
    const outdated = clients.filter(c => (c.ruleVersion || 0) < centralRuleVersion).length;
    const offline = clients.filter(c => c.connectionStatus === "OFFLINE").length;
    return {
      centralRuleVersion,
      totalEnrolled,
      synchronized,
      outdated,
      offline,
      failed: 0
    };
  }

  // ─── Whitelist Rules ────────────────────────────────────────────────────────
  public async getWhitelistRules(): Promise<WhitelistRule[]> {
    try {
      const { data, error } = await this.client.from("whitelist_rules").select("*");
      if (error || !data) {
        return [];
      }
      return data.map(this.mapWhitelistRule);
    } catch {
      return [];
    }
  }

  public async addWhitelistRule(pattern: string, description: string, addedBy = "Admin"): Promise<WhitelistRule> {
    const id = `wl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const row = { id, pattern, description, added_by: addedBy };
    try {
      const { data, error } = await this.client.from("whitelist_rules").insert([row]).select();
      if (!error && data && data[0]) {
        return this.mapWhitelistRule(data[0]);
      }
    } catch (e) {
      console.warn("Notice: REST insert to whitelist_rules skipped or RLS blocked:", e);
    }
    return { id, pattern, description, createdAt: new Date().toISOString(), addedBy };
  }

  public async deleteWhitelistRule(id: string): Promise<boolean> {
    try {
      const { error } = await this.client.from("whitelist_rules").delete().eq("id", id);
      return !error;
    } catch {
      return true;
    }
  }

  // ─── Phishing Rules ─────────────────────────────────────────────────────────
  public async getPhishingRules(): Promise<PhishingRule[]> {
    try {
      const { data, error } = await this.client.from("phishing_rules").select("*");
      if (error || !data) {
        return [];
      }
      return data.map(this.mapPhishingRule);
    } catch {
      return [];
    }
  }

  public async addPhishingRule(pattern: string, severity: "HIGH" | "CRITICAL", reason: string, addedBy = "Admin"): Promise<PhishingRule> {
    const id = `ph_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const row = { id, pattern, severity, reason, added_by: addedBy };
    try {
      const { data, error } = await this.client.from("phishing_rules").insert([row]).select();
      if (!error && data && data[0]) {
        return this.mapPhishingRule(data[0]);
      }
    } catch (e) {
      console.warn("Notice: REST insert to phishing_rules skipped or RLS blocked:", e);
    }
    return { id, pattern, severity, reason, createdAt: new Date().toISOString(), addedBy };
  }

  public async deletePhishingRule(id: string): Promise<boolean> {
    try {
      const { error } = await this.client.from("phishing_rules").delete().eq("id", id);
      return !error;
    } catch {
      return true;
    }
  }

  // ─── Clients ───────────────────────────────────────────────────────────────
  public async getClients(): Promise<EnrolledClient[]> {
    try {
      const { data, error } = await this.client.from("clients").select("*");
      if (!error && data) {
        return data.map(this.mapClient);
      }
    } catch (e) {
      console.warn("Notice: getClients via REST:", e);
    }
    return Array.from(this.memoryCache.clients.values()).map(this.mapClient);
  }

  public async clientExists(id: string): Promise<boolean> {
    const clients = await this.getClients();
    return clients.some(c => c.id === id);
  }

  public async getClientById(id: string): Promise<EnrolledClient | null> {
    const clients = await this.getClients();
    return clients.find(c => c.id === id) || null;
  }

  public async registerOrUpdateClient(payload: {
    clientId: string;
    clientName?: string;
    os?: string;
    browser?: string;
    platform?: string;
    extensionVersion?: string;
    ruleVersion?: number;
    ip?: string;
  }): Promise<EnrolledClient> {
    const now = new Date().toISOString();
    const row = {
      id: payload.clientId,
      client_name: payload.clientName || payload.clientId,
      first_seen: now,
      last_seen: now,
      status: "ENROLLED",
      extension_version: payload.extensionVersion || "1.4",
      rule_version: typeof payload.ruleVersion === "number" ? payload.ruleVersion : 1,
      browser: payload.browser || "Chrome",
      os: payload.os || "Linux",
      platform: payload.platform || "x86_64",
      ip: payload.ip || "remote-ip"
    };

    this.memoryCache.clients.set(payload.clientId, row);

    try {
      const { data, error } = await this.client.from("clients").upsert([row]).select();
      if (!error && data && data[0]) {
        return this.mapClient(data[0]);
      }
    } catch (e) {
      console.warn("Notice: registerOrUpdateClient REST error:", e);
    }

    return this.mapClient(row);
  }

  public async heartbeatClient(
    clientId: string,
    stats?: Record<string, number>,
    clientName?: string,
    ip?: string,
    ruleVersion?: number
  ): Promise<boolean> {
    const now = new Date().toISOString();
    try {
      const { error } = await this.client
        .from("clients")
        .update({
          last_seen: now,
          ...(ip ? { ip } : {}),
          ...(clientName ? { client_name: clientName } : {}),
          ...(typeof ruleVersion === "number" ? { rule_version: ruleVersion } : {})
        })
        .eq("id", clientId);
      if (!error) return true;
    } catch (e) {
      console.warn("Notice: heartbeatClient error:", e);
    }

    const existing = this.memoryCache.clients.get(clientId);
    if (existing) {
      existing.last_seen = now;
      if (ip) existing.ip = ip;
      if (clientName) existing.client_name = clientName;
      if (typeof ruleVersion === "number") existing.rule_version = ruleVersion;
    }
    return true;
  }

  public async deleteClient(id: string): Promise<boolean> {
    this.memoryCache.clients.delete(id);
    try {
      const { error } = await this.client.from("clients").delete().eq("id", id);
      return !error;
    } catch {
      return true;
    }
  }

  // ─── Threat Alerts ──────────────────────────────────────────────────────────
  public async getThreatAlerts(clientId?: string): Promise<ThreatAlert[]> {
    try {
      let query = this.client.from("threat_alerts").select("*");
      if (clientId && clientId !== "ALL") {
        query = query.eq("client_id", clientId);
      }
      const { data, error } = await query;
      if (!error && data) {
        return data.map(this.mapThreatAlert);
      }
    } catch (e) {
      console.warn("Notice: getThreatAlerts error:", e);
    }
    return [];
  }

  public async recordThreatAlert(alert: Omit<ThreatAlert, "id" | "timestamp" | "status">): Promise<ThreatAlert> {
    const id = `alt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const row = {
      id,
      client_id: alert.clientId || "anonymous",
      client_name: alert.clientName || "Workstation",
      url: alert.url,
      domain: alert.domain,
      score: alert.score,
      reasons: alert.reasons || [],
      source: alert.source || "extension",
      status: "ACTIVE",
      occurred_at: now
    };

    try {
      const { data, error } = await this.client.from("threat_alerts").insert([row]).select();
      if (!error && data && data[0]) {
        return this.mapThreatAlert(data[0]);
      }
    } catch (e) {
      console.warn("Notice: recordThreatAlert error:", e);
    }

    return this.mapThreatAlert(row);
  }

  public async updateThreatAlertStatus(id: string, status: "ACKNOWLEDGED" | "RESOLVED"): Promise<boolean> {
    try {
      const { error } = await this.client.from("threat_alerts").update({ status }).eq("id", id);
      return !error;
    } catch {
      return true;
    }
  }

  // ─── URL Events ─────────────────────────────────────────────────────────────
  public async hasEventId(eventId: string): Promise<boolean> {
    try {
      const { data, error } = await this.client.from("url_events").select("id").eq("event_id", eventId).limit(1);
      return !error && Boolean(data && data.length > 0);
    } catch {
      return false;
    }
  }

  public async recordUrlEvent(
    event: Omit<UrlEvent, "id" | "timestamp">,
    occurredAt?: string
  ): Promise<{ event: UrlEvent; wasNew: boolean }> {
    const id = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const timestamp = occurredAt || new Date().toISOString();
    const row = {
      id,
      event_id: event.eventId || null,
      client_id: event.clientId || "anonymous",
      client_name: event.clientName || "Workstation",
      url: event.url,
      domain: event.domain,
      classification: event.classification,
      verdict: event.verdict,
      score: event.score,
      reason: event.reason,
      source: event.source || "extension",
      rule_triggered: Boolean(event.ruleTriggered),
      rule_type: event.ruleType || null,
      occurred_at: timestamp
    };

    try {
      const { data, error } = await this.client.from("url_events").insert([row]).select();
      if (!error && data && data[0]) {
        return { event: this.mapUrlEvent(data[0]), wasNew: true };
      }
    } catch (e) {
      console.warn("Notice: recordUrlEvent insert error:", e);
    }

    return { event: this.mapUrlEvent(row), wasNew: true };
  }

  public async getUrlEvents(filters?: UrlEventFilters): Promise<UrlEventsResult> {
    try {
      let query = this.client.from("url_events").select("*", { count: "exact" });
      if (filters?.clientId && filters.clientId !== "ALL") {
        query = query.eq("client_id", filters.clientId);
      }
      if (filters?.classification) {
        query = query.eq("classification", filters.classification);
      }
      if (filters?.search) {
        query = query.or(`url.ilike.%${filters.search}%,domain.ilike.%${filters.search}%`);
      }
      query = query.order("occurred_at", { ascending: false });
      if (typeof filters?.limit === "number") {
        const offset = filters.offset || 0;
        query = query.range(offset, offset + filters.limit - 1);
      }

      const { data, count, error } = await query;
      if (!error && data) {
        return {
          events: data.map(this.mapUrlEvent),
          total: count ?? data.length
        };
      }
    } catch (e) {
      console.warn("Notice: getUrlEvents error:", e);
    }

    return { events: [], total: 0 };
  }

  // ─── Dashboard Stats ────────────────────────────────────────────────────────
  public async getDashboardStats(clientId?: string): Promise<DashboardStatsResult> {
    const isGlobal = !clientId || clientId === "ALL";

    try {
      let [clientsRes, alertsRes, eventsRes] = await Promise.all([
        this.client.from("clients").select("*"),
        isGlobal
          ? this.client.from("threat_alerts").select("*")
          : this.client.from("threat_alerts").select("*").eq("client_id", clientId),
        isGlobal
          ? this.client.from("url_events").select("*").order("occurred_at", { ascending: false }).limit(500)
          : this.client.from("url_events").select("*").eq("client_id", clientId).order("occurred_at", { ascending: false }).limit(500)
      ]);

      const clients = (clientsRes.data || []).map(this.mapClient);
      const alerts = (alertsRes.data || []).map(this.mapThreatAlert);
      const events = (eventsRes.data || []).map(this.mapUrlEvent);

      const totalSystems = clients.length;
      const urlsMonitored = events.length;
      const safe = events.filter(e => e.classification === "SAFE").length;
      const suspicious = events.filter(e => e.classification === "SUSPICIOUS").length;
      const phishing = events.filter(e => e.classification === "PHISHING").length;
      const activeAlerts = alerts.filter(a => a.status === "ACTIVE").length;

      const threatDomainCounts = new Map<string, number>();
      alerts.forEach(a => {
        if (a.domain) threatDomainCounts.set(a.domain, (threatDomainCounts.get(a.domain) || 0) + 1);
      });
      const topThreatDomains = Array.from(threatDomainCounts.entries())
        .map(([domain, count]) => ({ domain, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return {
        scope: isGlobal ? "ALL" : (clientId as string),
        totalSystems,
        urlsMonitored,
        allowedUrls: safe,
        phishingIntercepted: phishing,
        activeAlerts,
        breakdown: {
          evaluated: urlsMonitored,
          safe,
          suspicious,
          phishing
        },
        recentEvents: events.slice(0, 10),
        topThreatDomains
      };
    } catch (err) {
      console.warn("Notice: getDashboardStats via Supabase REST error:", err);
      return {
        scope: isGlobal ? "ALL" : (clientId as string),
        totalSystems: 0,
        urlsMonitored: 0,
        allowedUrls: 0,
        phishingIntercepted: 0,
        activeAlerts: 0,
        breakdown: { evaluated: 0, safe: 0, suspicious: 0, phishing: 0 },
        recentEvents: [],
        topThreatDomains: []
      };
    }
  }

  // ─── Reports ────────────────────────────────────────────────────────────────
  public async getReportData(clientId?: string, startDate?: string, endDate?: string): Promise<ReportDataResult> {
    const isGlobal = !clientId || clientId === "ALL";
    const [clients, alertsData, eventsRes] = await Promise.all([
      this.getClients(),
      this.getThreatAlerts(isGlobal ? undefined : clientId),
      this.getUrlEvents({ clientId: isGlobal ? undefined : clientId, limit: 1000 })
    ]);

    let events = eventsRes.events;
    if (startDate) events = events.filter(e => e.timestamp >= startDate);
    if (endDate) events = events.filter(e => e.timestamp <= endDate);

    let alerts = alertsData;
    if (startDate) alerts = alerts.filter(a => a.timestamp >= startDate);
    if (endDate) alerts = alerts.filter(a => a.timestamp <= endDate);

    const safeCount = events.filter(e => e.classification === "SAFE").length;
    const suspiciousCount = events.filter(e => e.classification === "SUSPICIOUS").length;
    const phishingCount = events.filter(e => e.classification === "PHISHING").length;

    const threatDomainCounts = new Map<string, number>();
    alerts.forEach(a => {
      if (a.domain) threatDomainCounts.set(a.domain, (threatDomainCounts.get(a.domain) || 0) + 1);
    });
    const topThreatDomains = Array.from(threatDomainCounts.entries())
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const perSystem = clients.map(client => {
      const clientEvents = events.filter(e => e.clientId === client.id);
      const clientAlerts = alerts.filter(a => a.clientId === client.id);
      return {
        clientId: client.id,
        clientName: client.clientName,
        os: client.os,
        browser: client.browser,
        totalScanned: clientEvents.length,
        safe: clientEvents.filter(e => e.classification === "SAFE").length,
        suspicious: clientEvents.filter(e => e.classification === "SUSPICIOUS").length,
        phishing: clientEvents.filter(e => e.classification === "PHISHING").length,
        activeAlerts: clientAlerts.filter(a => a.status === "ACTIVE").length
      };
    });

    return {
      scope: isGlobal ? "ALL" : clientId,
      generatedAt: new Date().toISOString(),
      systems: clients,
      summary: {
        totalEvaluated: events.length,
        safe: safeCount,
        suspicious: suspiciousCount,
        phishing: phishingCount,
        activeAlerts: alerts.filter(a => a.status === "ACTIVE").length
      },
      topThreatDomains,
      events: events.slice(0, 1000),
      alerts: alerts.slice(0, 500),
      perSystem
    };
  }

  // ─── Admin Credentials ───────────────────────────────────────────────────
  public async getAdminCredentials(): Promise<AdminCredentials> {
    try {
      const { data } = await this.client.from("system_settings").select("value").eq("key", "admin_credentials").single();
      if (data && data.value && data.value.username) {
        return data.value;
      }
    } catch {}
    return {
      username: "admin",
      passwordHash: "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3",
      salt: "phishguard_salt_123"
    };
  }

  public async updateAdminCredentials(username: string, passwordHash: string, salt: string): Promise<boolean> {
    try {
      await this.client.from("system_settings").upsert([{
        key: "admin_credentials",
        value: { username, passwordHash, salt }
      }]);
      return true;
    } catch {
      return true;
    }
  }

  // ─── Removal Requests ───────────────────────────────────────────────────
  private mapRemovalRequest(r: any): RemovalRequest {
    return {
      id: r.id,
      clientId: r.client_id || r.clientId,
      clientName: r.client_name || r.clientName || "Workstation",
      requestedAt: r.requested_at ? new Date(r.requested_at).toISOString() : new Date().toISOString(),
      status: r.status || "PENDING",
      reason: r.reason || undefined,
      authorizationToken: r.authorization_token || r.authorizationToken || undefined,
      tokenExpiresAt: r.token_expires_at ? new Date(r.token_expires_at).toISOString() : undefined,
      reviewedAt: r.reviewed_at ? new Date(r.reviewed_at).toISOString() : undefined,
      reviewedBy: r.reviewed_by || r.reviewedBy || undefined,
      decisionNote: r.decision_note || r.decisionNote || undefined
    };
  }

  public async createRemovalRequest(payload: { clientId: string; clientName?: string; reason?: string }): Promise<RemovalRequest> {
    const existing = this.memoryCache.removalRequests.find(r => r.clientId === payload.clientId && r.status === "PENDING");
    if (existing) {
      if (payload.reason) existing.reason = payload.reason;
      return existing;
    }

    const id = `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const row = {
      id,
      client_id: payload.clientId,
      client_name: payload.clientName || payload.clientId,
      requested_at: new Date().toISOString(),
      status: "PENDING",
      reason: payload.reason || "User requested agent removal"
    };

    try {
      const { data, error } = await this.client.from("removal_requests").insert([row]).select();
      if (!error && data && data[0]) {
        const mapped = this.mapRemovalRequest(data[0]);
        this.memoryCache.removalRequests.unshift(mapped);
        return mapped;
      }
    } catch (e) {
      console.warn("Notice: createRemovalRequest REST insert:", e);
    }

    const mapped = this.mapRemovalRequest(row);
    this.memoryCache.removalRequests.unshift(mapped);
    return mapped;
  }

  public async getRemovalRequests(): Promise<RemovalRequest[]> {
    try {
      const { data, error } = await this.client.from("removal_requests").select("*").order("requested_at", { ascending: false });
      if (!error && data) {
        return data.map(r => this.mapRemovalRequest(r));
      }
    } catch (e) {
      console.warn("Notice: getRemovalRequests REST error:", e);
    }
    return [...this.memoryCache.removalRequests];
  }

  public async getRemovalRequestById(id: string): Promise<RemovalRequest | null> {
    try {
      const { data, error } = await this.client.from("removal_requests").select("*").eq("id", id).single();
      if (!error && data) {
        return this.mapRemovalRequest(data);
      }
    } catch {}
    return this.memoryCache.removalRequests.find(r => r.id === id) || null;
  }

  public async reviewRemovalRequest(
    id: string,
    decision: "APPROVE" | "DENY",
    reviewedBy = "admin",
    note?: string
  ): Promise<RemovalRequest | null> {
    const now = new Date();
    const updatePayload: any = {
      reviewed_at: now.toISOString(),
      reviewed_by: reviewedBy,
      decision_note: note || null,
      status: decision === "APPROVE" ? "APPROVED" : "DENIED"
    };

    if (decision === "APPROVE") {
      updatePayload.authorization_token = `pg_auth_${Math.random().toString(36).substring(2, 12)}_${Date.now().toString(36)}`;
      updatePayload.token_expires_at = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
    } else {
      updatePayload.authorization_token = null;
      updatePayload.token_expires_at = null;
    }

    try {
      const { data, error } = await this.client.from("removal_requests").update(updatePayload).eq("id", id).select();
      if (!error && data && data[0]) {
        return this.mapRemovalRequest(data[0]);
      }
    } catch (e) {
      console.warn("Notice: reviewRemovalRequest REST error:", e);
    }

    const cached = this.memoryCache.removalRequests.find(r => r.id === id);
    if (cached) {
      cached.status = decision === "APPROVE" ? "APPROVED" : "DENIED";
      cached.reviewedAt = updatePayload.reviewed_at;
      cached.reviewedBy = reviewedBy;
      cached.decisionNote = note;
      cached.authorizationToken = updatePayload.authorization_token;
      cached.tokenExpiresAt = updatePayload.token_expires_at;
      return { ...cached };
    }
    return null;
  }

  public async verifyAndConsumeRemovalToken(
    clientId: string,
    token: string
  ): Promise<{ authorized: boolean; error?: string }> {
    try {
      const { data, error } = await this.client
        .from("removal_requests")
        .select("*")
        .eq("client_id", clientId)
        .eq("authorization_token", token)
        .eq("status", "APPROVED")
        .single();

      if (!error && data) {
        if (data.token_expires_at && new Date(data.token_expires_at).getTime() < Date.now()) {
          await this.client.from("removal_requests").update({ status: "EXPIRED" }).eq("id", data.id);
          return { authorized: false, error: "Removal authorization token has expired (valid for 15 minutes only)" };
        }

        await this.client.from("removal_requests").update({
          authorization_token: null,
          decision_note: "Token consumed and agent uninstalled"
        }).eq("id", data.id);

        await this.deleteClient(clientId);
        return { authorized: true };
      }
    } catch {}

    const cached = this.memoryCache.removalRequests.find(
      r => r.clientId === clientId && r.status === "APPROVED" && r.authorizationToken === token
    );
    if (!cached) {
      return { authorized: false, error: "Invalid, unauthorized, or expired removal authorization token" };
    }
    if (cached.tokenExpiresAt && new Date(cached.tokenExpiresAt).getTime() < Date.now()) {
      cached.status = "EXPIRED";
      return { authorized: false, error: "Removal authorization token has expired (valid for 15 minutes only)" };
    }
    cached.authorizationToken = undefined;
    await this.deleteClient(clientId);
    return { authorized: true };
  }
}
