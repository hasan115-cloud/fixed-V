import { Pool } from "pg";
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
  DashboardStatsResult,
  IDatabase,
  ReportDataResult,
  UrlEventFilters,
  UrlEventsResult
} from "./dbTypes";

export class PostgresDatabase implements IDatabase {
  private pool: Pool;
  private host: string;
  private schemaInitialized = false;

  constructor(connectionString: string) {
    let host = "postgresql";
    try {
      const u = new URL(connectionString);
      host = u.hostname || "postgresql";
    } catch {}
    this.host = host;

    this.pool = new Pool({
      connectionString,
      ssl: connectionString.includes("sslmode=disable")
        ? false
        : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    });

    this.initSchema().catch(err => {
      console.warn("Notice: Postgres schema init deferred or failed:", err?.message);
    });
  }

  private async initSchema() {
    if (this.schemaInitialized) return;
    const client = await this.pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS clients (
          id TEXT PRIMARY KEY,
          client_name TEXT NOT NULL,
          first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
          last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
          status TEXT NOT NULL DEFAULT 'ENROLLED',
          extension_version TEXT,
          browser TEXT,
          os TEXT,
          platform TEXT,
          ip TEXT,
          rule_version INTEGER DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS url_events (
          id TEXT PRIMARY KEY,
          event_id TEXT,
          client_id TEXT NOT NULL,
          client_name TEXT,
          url TEXT NOT NULL,
          domain TEXT,
          classification TEXT NOT NULL,
          verdict TEXT NOT NULL,
          score DOUBLE PRECISION,
          reason TEXT,
          source TEXT,
          rule_triggered BOOLEAN DEFAULT FALSE,
          rule_type TEXT,
          occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS threat_alerts (
          id TEXT PRIMARY KEY,
          client_id TEXT NOT NULL,
          client_name TEXT,
          url TEXT NOT NULL,
          domain TEXT,
          score DOUBLE PRECISION,
          reasons JSONB,
          source TEXT,
          status TEXT NOT NULL DEFAULT 'ACTIVE',
          occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS whitelist_rules (
          id TEXT PRIMARY KEY,
          pattern TEXT NOT NULL UNIQUE,
          description TEXT,
          added_by TEXT,
          enabled BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        ALTER TABLE whitelist_rules ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT TRUE;

        CREATE TABLE IF NOT EXISTS phishing_rules (
          id TEXT PRIMARY KEY,
          pattern TEXT NOT NULL UNIQUE,
          severity TEXT NOT NULL,
          reason TEXT,
          added_by TEXT,
          enabled BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        ALTER TABLE phishing_rules ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT TRUE;

        CREATE TABLE IF NOT EXISTS removal_requests (
          id TEXT PRIMARY KEY,
          client_id TEXT NOT NULL,
          client_name TEXT NOT NULL,
          requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          status TEXT NOT NULL DEFAULT 'PENDING',
          reason TEXT,
          authorization_token TEXT,
          token_expires_at TIMESTAMPTZ,
          reviewed_at TIMESTAMPTZ,
          reviewed_by TEXT,
          decision_note TEXT
        );

        CREATE TABLE IF NOT EXISTS system_settings (
          key TEXT PRIMARY KEY,
          value JSONB NOT NULL
        );
      `);
      this.schemaInitialized = true;
    } finally {
      client.release();
    }
  }

  private connectionStatusFor(lastSeen: string): "ONLINE" | "OFFLINE" {
    return Date.now() - new Date(lastSeen).getTime() < ONLINE_THRESHOLD_MS
      ? "ONLINE"
      : "OFFLINE";
  }

  public async hasEventId(eventId: string): Promise<boolean> {
    const res = await this.pool.query(
      "SELECT 1 FROM url_events WHERE event_id = $1 LIMIT 1",
      [eventId]
    );
    return res.rows.length > 0;
  }

  public async recordUrlEvent(
    event: Omit<UrlEvent, "id" | "timestamp">,
    occurredAt?: string
  ): Promise<{ event: UrlEvent; wasNew: boolean }> {
    if (event.eventId) {
      const existing = await this.pool.query(
        "SELECT * FROM url_events WHERE event_id = $1 LIMIT 1",
        [event.eventId]
      );
      if (existing.rows.length > 0) {
        const row = existing.rows[0];
        return {
          event: {
            id: row.id,
            eventId: row.event_id,
            url: row.url,
            domain: row.domain,
            classification: row.classification,
            verdict: row.verdict,
            score: row.score,
            reason: row.reason,
            clientId: row.client_id,
            clientName: row.client_name,
            source: row.source,
            timestamp: new Date(row.occurred_at).toISOString()
          },
          wasNew: false
        };
      }
    }

    const id = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const timestamp = occurredAt || new Date().toISOString();

    await this.pool.query(
      `INSERT INTO url_events (
        id, event_id, client_id, client_name, url, domain,
        classification, verdict, score, reason, source,
        rule_triggered, rule_type, occurred_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        id,
        event.eventId || null,
        event.clientId,
        event.clientName,
        event.url,
        event.domain,
        event.classification,
        event.verdict || "ALLOWED",
        event.score,
        event.reason,
        event.source,
        event.ruleTriggered || false,
        event.ruleType || null,
        timestamp
      ]
    );

    return {
      event: {
        ...event,
        id,
        timestamp
      },
      wasNew: true
    };
  }

  public async getUrlEvents(filters?: UrlEventFilters): Promise<UrlEventsResult> {
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (filters?.clientId && filters.clientId !== "ALL") {
      conditions.push(`client_id = $${idx++}`);
      values.push(filters.clientId);
    }

    if (filters?.classification && filters.classification !== "ALL") {
      conditions.push(`classification = $${idx++}`);
      values.push(filters.classification);
    }

    if (filters?.search && filters.search.trim()) {
      conditions.push(
        `(LOWER(url) LIKE $${idx} OR LOWER(domain) LIKE $${idx} OR LOWER(client_name) LIKE $${idx} OR LOWER(reason) LIKE $${idx})`
      );
      values.push(`%${filters.search.trim().toLowerCase()}%`);
      idx++;
    }

    if (filters?.startDate) {
      conditions.push(`occurred_at >= $${idx++}`);
      values.push(filters.startDate);
    }

    if (filters?.endDate) {
      conditions.push(`occurred_at <= $${idx++}`);
      values.push(filters.endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countRes = await this.pool.query(
      `SELECT COUNT(*) FROM url_events ${whereClause}`,
      values
    );
    const total = parseInt(countRes.rows[0].count, 10);

    let query = `SELECT * FROM url_events ${whereClause} ORDER BY occurred_at DESC`;
    if (filters?.limit) {
      query += ` LIMIT $${idx++}`;
      values.push(filters.limit);
    }
    if (filters?.offset) {
      query += ` OFFSET $${idx++}`;
      values.push(filters.offset);
    }

    const rowsRes = await this.pool.query(query, values);

    const events: UrlEvent[] = rowsRes.rows.map(r => ({
      id: r.id,
      eventId: r.event_id,
      clientId: r.client_id,
      clientName: r.client_name,
      url: r.url,
      domain: r.domain,
      classification: r.classification,
      verdict: r.verdict,
      score: r.score,
      reason: r.reason,
      source: r.source,
      ruleTriggered: r.rule_triggered,
      ruleType: r.rule_type,
      timestamp: new Date(r.occurred_at).toISOString()
    }));

    return { events, total };
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
    const existing = await this.pool.query("SELECT * FROM clients WHERE id = $1", [payload.clientId]);

    if (existing.rows.length > 0) {
      await this.pool.query(
        `UPDATE clients SET
          client_name = COALESCE($2, client_name),
          os = COALESCE($3, os),
          browser = COALESCE($4, browser),
          platform = COALESCE($5, platform),
          extension_version = COALESCE($6, extension_version),
          rule_version = COALESCE($7, rule_version),
          ip = COALESCE($8, ip),
          last_seen = $9,
          status = 'ENROLLED'
        WHERE id = $1`,
        [
          payload.clientId,
          payload.clientName || null,
          payload.os || null,
          payload.browser || null,
          payload.platform || null,
          payload.extensionVersion || null,
          payload.ruleVersion || null,
          payload.ip || null,
          now
        ]
      );
    } else {
      await this.pool.query(
        `INSERT INTO clients (
          id, client_name, os, browser, platform, extension_version, rule_version, ip, first_seen, last_seen, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9, 'ENROLLED')`,
        [
          payload.clientId,
          payload.clientName || `Workstation-${payload.clientId.slice(-4).toUpperCase()}`,
          payload.os || "Linux",
          payload.browser || "Chrome",
          payload.platform || "x86_64",
          payload.extensionVersion || "1.4",
          payload.ruleVersion || 1,
          payload.ip || "remote-ip",
          now
        ]
      );
    }

    const client = await this.getClientById(payload.clientId);
    return client!;
  }

  public async heartbeatClient(
    clientId: string,
    stats?: Record<string, number>,
    clientName?: string,
    ip?: string,
    ruleVersion?: number
  ): Promise<boolean> {
    const now = new Date().toISOString();
    const res = await this.pool.query("SELECT 1 FROM clients WHERE id = $1", [clientId]);
    if (res.rows.length === 0) {
      await this.registerOrUpdateClient({ clientId, clientName, ip, ruleVersion });
      return true;
    }

    await this.pool.query(
      `UPDATE clients SET
        last_seen = $2,
        status = 'ENROLLED',
        rule_version = COALESCE($3, rule_version),
        client_name = COALESCE($4, client_name),
        ip = COALESCE($5, ip)
      WHERE id = $1`,
      [clientId, now, ruleVersion || null, clientName || null, ip || null]
    );

    return true;
  }

  public async getClients(): Promise<EnrolledClient[]> {
    const clientsRes = await this.pool.query("SELECT * FROM clients ORDER BY last_seen DESC");
    const countsRes = await this.pool.query(`
      SELECT
        client_id,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE classification = 'SAFE') as safe,
        COUNT(*) FILTER (WHERE classification = 'SUSPICIOUS') as suspicious,
        COUNT(*) FILTER (WHERE classification = 'PHISHING') as phishing
      FROM url_events
      GROUP BY client_id
    `);

    const statsMap = new Map<string, any>();
    for (const r of countsRes.rows) {
      statsMap.set(r.client_id, {
        totalScanned: parseInt(r.total, 10),
        safeEvaluated: parseInt(r.safe, 10),
        suspiciousDetected: parseInt(r.suspicious, 10),
        phishingBlocked: parseInt(r.phishing, 10)
      });
    }

    return clientsRes.rows.map(r => ({
      id: r.id,
      clientName: r.client_name,
      os: r.os || "Linux",
      browser: r.browser || "Chrome",
      platform: r.platform || "x86_64",
      extensionVersion: r.extension_version || "1.4",
      ruleVersion: r.rule_version || 1,
      firstSeen: new Date(r.first_seen).toISOString(),
      lastSeen: new Date(r.last_seen).toISOString(),
      status: r.status as any,
      connectionStatus: this.connectionStatusFor(new Date(r.last_seen).toISOString()),
      ip: r.ip,
      telemetryStats: statsMap.get(r.id) || {
        totalScanned: 0,
        safeEvaluated: 0,
        suspiciousDetected: 0,
        phishingBlocked: 0
      }
    }));
  }

  public async clientExists(id: string): Promise<boolean> {
    const res = await this.pool.query("SELECT 1 FROM clients WHERE id = $1 LIMIT 1", [id]);
    return res.rows.length > 0;
  }

  public async getClientById(id: string): Promise<EnrolledClient | null> {
    const clients = await this.getClients();
    return clients.find(c => c.id === id) || null;
  }

  public async deleteClient(id: string): Promise<boolean> {
    const res = await this.pool.query("DELETE FROM clients WHERE id = $1", [id]);
    return (res.rowCount ?? 0) > 0;
  }

  public async recordThreatAlert(
    alert: Omit<ThreatAlert, "id" | "timestamp" | "status">
  ): Promise<ThreatAlert> {
    const existing = await this.pool.query(
      `SELECT * FROM threat_alerts 
       WHERE client_id = $1 AND url = $2 AND status = 'ACTIVE' 
         AND occurred_at >= (now() - interval '5 minutes')
       LIMIT 1`,
      [alert.clientId, alert.url]
    );
    if (existing.rows.length > 0) {
      const r = existing.rows[0];
      return {
        id: r.id,
        clientId: r.client_id,
        clientName: r.client_name,
        url: r.url,
        domain: r.domain,
        score: r.score,
        reasons: typeof r.reasons === "string" ? JSON.parse(r.reasons) : r.reasons || [],
        source: r.source,
        status: r.status,
        timestamp: new Date(r.occurred_at).toISOString()
      };
    }

    const id = `alt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    await this.pool.query(
      `INSERT INTO threat_alerts (
        id, client_id, client_name, url, domain, score, reasons, source, status, occurred_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVE', $9)`,
      [
        id,
        alert.clientId,
        alert.clientName,
        alert.url,
        alert.domain,
        alert.score,
        JSON.stringify(alert.reasons || []),
        alert.source,
        now
      ]
    );

    return {
      ...alert,
      id,
      status: "ACTIVE",
      timestamp: now
    };
  }

  public async getThreatAlerts(clientId?: string): Promise<ThreatAlert[]> {
    let query = "SELECT * FROM threat_alerts";
    const values: any[] = [];
    if (clientId && clientId !== "ALL") {
      query += " WHERE client_id = $1";
      values.push(clientId);
    }
    query += " ORDER BY occurred_at DESC";

    const res = await this.pool.query(query, values);
    return res.rows.map(r => ({
      id: r.id,
      clientId: r.client_id,
      clientName: r.client_name,
      url: r.url,
      domain: r.domain,
      score: r.score,
      reasons: typeof r.reasons === "string" ? JSON.parse(r.reasons) : r.reasons || [],
      source: r.source,
      status: r.status,
      timestamp: new Date(r.occurred_at).toISOString()
    }));
  }

  public async updateThreatAlertStatus(
    id: string,
    status: "ACKNOWLEDGED" | "RESOLVED"
  ): Promise<boolean> {
    const res = await this.pool.query(
      "UPDATE threat_alerts SET status = $1 WHERE id = $2",
      [status, id]
    );
    return (res.rowCount ?? 0) > 0;
  }

  public async getRuleVersion(): Promise<number> {
    const res = await this.pool.query("SELECT value FROM system_settings WHERE key = 'ruleVersion'");
    if (res.rows.length > 0 && typeof res.rows[0].value?.version === "number") {
      return res.rows[0].value.version;
    }
    return 1;
  }

  public async bumpRuleVersion(): Promise<number> {
    const current = await this.getRuleVersion();
    const next = current + 1;
    await this.pool.query(
      `INSERT INTO system_settings (key, value)
       VALUES ('ruleVersion', $1)
       ON CONFLICT (key) DO UPDATE SET value = $1`,
      [JSON.stringify({ version: next })]
    );
    return next;
  }

  public async getRuleSyncStatus(): Promise<RuleSyncStatus> {
    const centralRuleVersion = await this.getRuleVersion();
    const clients = await this.getClients();
    const totalEnrolled = clients.length;
    const synchronized = clients.filter(
      c => c.connectionStatus === "ONLINE" && (c.ruleVersion || 0) === centralRuleVersion
    ).length;
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

  public async getWhitelistRules(): Promise<WhitelistRule[]> {
    const res = await this.pool.query("SELECT * FROM whitelist_rules ORDER BY created_at DESC");
    return res.rows.map(r => ({
      id: r.id,
      pattern: r.pattern,
      description: r.description,
      enabled: r.enabled !== false,
      addedBy: r.added_by,
      createdAt: new Date(r.created_at).toISOString()
    }));
  }

  public async addWhitelistRule(
    pattern: string,
    description: string,
    addedBy = "Admin"
  ): Promise<WhitelistRule> {
    const cleanPattern = pattern.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
    const id = `wl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    await this.pool.query(
      `INSERT INTO whitelist_rules (id, pattern, description, added_by, enabled, created_at)
       VALUES ($1, $2, $3, $4, TRUE, $5)
       ON CONFLICT (pattern) DO UPDATE SET description = $3, enabled = TRUE`,
      [id, cleanPattern, description, addedBy, now]
    );

    await this.bumpRuleVersion();
    return {
      id,
      pattern: cleanPattern,
      description,
      enabled: true,
      addedBy,
      createdAt: now
    };
  }

  public async updateWhitelistRule(
    id: string,
    updates: Partial<WhitelistRule>
  ): Promise<WhitelistRule | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (updates.pattern) {
      const cleanPattern = updates.pattern.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
      fields.push(`pattern = $${idx++}`);
      values.push(cleanPattern);
    }
    if (typeof updates.description === "string") {
      fields.push(`description = $${idx++}`);
      values.push(updates.description.trim());
    }
    if (typeof updates.enabled === "boolean") {
      fields.push(`enabled = $${idx++}`);
      values.push(updates.enabled);
    }

    if (fields.length === 0) return (await this.getWhitelistRules()).find(r => r.id === id) || null;

    values.push(id);
    await this.pool.query(
      `UPDATE whitelist_rules SET ${fields.join(", ")} WHERE id = $${idx}`,
      values
    );
    await this.bumpRuleVersion();
    const rules = await this.getWhitelistRules();
    return rules.find(r => r.id === id) || null;
  }

  public async deleteWhitelistRule(id: string): Promise<boolean> {
    const res = await this.pool.query("DELETE FROM whitelist_rules WHERE id = $1", [id]);
    if ((res.rowCount ?? 0) > 0) {
      await this.bumpRuleVersion();
      return true;
    }
    return false;
  }

  public async getPhishingRules(): Promise<PhishingRule[]> {
    const res = await this.pool.query("SELECT * FROM phishing_rules ORDER BY created_at DESC");
    return res.rows.map(r => ({
      id: r.id,
      pattern: r.pattern,
      severity: r.severity,
      reason: r.reason,
      enabled: r.enabled !== false,
      addedBy: r.added_by,
      createdAt: new Date(r.created_at).toISOString()
    }));
  }

  public async addPhishingRule(
    pattern: string,
    severity: "HIGH" | "CRITICAL",
    reason: string,
    addedBy = "Admin"
  ): Promise<PhishingRule> {
    const cleanPattern = pattern.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
    const id = `ph_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    await this.pool.query(
      `INSERT INTO phishing_rules (id, pattern, severity, reason, added_by, enabled, created_at)
       VALUES ($1, $2, $3, $4, $5, TRUE, $6)
       ON CONFLICT (pattern) DO UPDATE SET severity = $3, reason = $4, enabled = TRUE`,
      [id, cleanPattern, severity, reason, addedBy, now]
    );

    await this.bumpRuleVersion();
    return {
      id,
      pattern: cleanPattern,
      severity,
      reason,
      enabled: true,
      addedBy,
      createdAt: now
    };
  }

  public async updatePhishingRule(
    id: string,
    updates: Partial<PhishingRule>
  ): Promise<PhishingRule | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (updates.pattern) {
      const cleanPattern = updates.pattern.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
      fields.push(`pattern = $${idx++}`);
      values.push(cleanPattern);
    }
    if (updates.severity) {
      fields.push(`severity = $${idx++}`);
      values.push(updates.severity);
    }
    if (typeof updates.reason === "string") {
      fields.push(`reason = $${idx++}`);
      values.push(updates.reason.trim());
    }
    if (typeof updates.enabled === "boolean") {
      fields.push(`enabled = $${idx++}`);
      values.push(updates.enabled);
    }

    if (fields.length === 0) return (await this.getPhishingRules()).find(r => r.id === id) || null;

    values.push(id);
    await this.pool.query(
      `UPDATE phishing_rules SET ${fields.join(", ")} WHERE id = $${idx}`,
      values
    );
    await this.bumpRuleVersion();
    const rules = await this.getPhishingRules();
    return rules.find(r => r.id === id) || null;
  }

  public async deletePhishingRule(id: string): Promise<boolean> {
    const res = await this.pool.query("DELETE FROM phishing_rules WHERE id = $1", [id]);
    if ((res.rowCount ?? 0) > 0) {
      await this.bumpRuleVersion();
      return true;
    }
    return false;
  }

  public async getDashboardStats(clientId?: string): Promise<DashboardStatsResult> {
    const isGlobal = !clientId || clientId === "ALL";
    const values: any[] = [];
    const clientCondition = isGlobal ? "" : "WHERE client_id = $1";
    if (!isGlobal) values.push(clientId);

    const countsRes = await this.pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE classification = 'SAFE') as safe,
        COUNT(*) FILTER (WHERE classification = 'SUSPICIOUS') as suspicious,
        COUNT(*) FILTER (WHERE classification = 'PHISHING') as phishing
      FROM url_events ${clientCondition}
    `, values);

    const row = countsRes.rows[0];
    const urlsMonitored = parseInt(row.total, 10);
    const safeCount = parseInt(row.safe, 10);
    const suspiciousCount = parseInt(row.suspicious, 10);
    const phishingCount = parseInt(row.phishing, 10);

    const totalClientsRes = await this.pool.query("SELECT COUNT(*) FROM clients");
    const totalSystems = parseInt(totalClientsRes.rows[0].count, 10);

    const alertsCondition = isGlobal ? "WHERE status = 'ACTIVE'" : "WHERE status = 'ACTIVE' AND client_id = $1";
    const alertsRes = await this.pool.query(`SELECT COUNT(*) FROM threat_alerts ${alertsCondition}`, values);
    const activeAlerts = parseInt(alertsRes.rows[0].count, 10);

    const topDomainsRes = await this.pool.query(`
      SELECT domain, COUNT(*) as count
      FROM threat_alerts
      ${isGlobal ? "" : "WHERE client_id = $1"}
      GROUP BY domain
      ORDER BY count DESC
      LIMIT 5
    `, values);

    const topThreatDomains = topDomainsRes.rows.map(r => ({
      domain: r.domain,
      count: parseInt(r.count, 10)
    }));

    const eventsRes = await this.getUrlEvents({
      clientId: isGlobal ? undefined : clientId,
      limit: 10
    });

    return {
      scope: isGlobal ? "ALL" : clientId!,
      totalSystems,
      urlsMonitored,
      allowedUrls: safeCount,
      phishingIntercepted: phishingCount,
      activeAlerts,
      breakdown: {
        evaluated: urlsMonitored,
        safe: safeCount,
        suspicious: suspiciousCount,
        phishing: phishingCount
      },
      recentEvents: eventsRes.events,
      topThreatDomains
    };
  }

  public async getReportData(
    clientId?: string,
    startDate?: string,
    endDate?: string
  ): Promise<ReportDataResult> {
    const isGlobal = !clientId || clientId === "ALL";
    const clients = await this.getClients();
    const eventsRes = await this.getUrlEvents({ clientId, startDate, endDate, limit: 1000 });
    
    let alerts = await this.getThreatAlerts(clientId);
    if (startDate) {
      alerts = alerts.filter(a => a.timestamp >= startDate);
    }
    if (endDate) {
      alerts = alerts.filter(a => a.timestamp <= endDate);
    }

    let safeCount = 0;
    let suspiciousCount = 0;
    let phishingCount = 0;
    for (const e of eventsRes.events) {
      if (e.classification === "PHISHING") phishingCount++;
      else if (e.classification === "SUSPICIOUS") suspiciousCount++;
      else safeCount++;
    }

    const threatDomainCounts = new Map<string, number>();
    alerts.forEach(a => {
      if (a.domain) threatDomainCounts.set(a.domain, (threatDomainCounts.get(a.domain) || 0) + 1);
    });
    const topThreatDomains = Array.from(threatDomainCounts.entries())
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const perSystem = isGlobal
      ? clients.map(c => {
          const clientEvents = eventsRes.events.filter(e => e.clientId === c.id);
          const clientAlerts = alerts.filter(a => a.clientId === c.id);
          let cSafe = 0, cSuspicious = 0, cPhishing = 0;
          for (const ce of clientEvents) {
            if (ce.classification === "PHISHING") cPhishing++;
            else if (ce.classification === "SUSPICIOUS") cSuspicious++;
            else cSafe++;
          }
          return {
            clientId: c.id,
            clientName: c.clientName,
            os: c.os,
            browser: c.browser,
            totalScanned: clientEvents.length,
            safe: cSafe,
            suspicious: cSuspicious,
            phishing: cPhishing,
            activeAlerts: clientAlerts.filter(a => a.status === "ACTIVE").length
          };
        })
      : [];

    return {
      scope: isGlobal ? "ALL" : clientId!,
      generatedAt: new Date().toISOString(),
      systems: isGlobal ? clients : clients.filter(c => c.id === clientId),
      summary: {
        totalEvaluated: eventsRes.events.length,
        safe: safeCount,
        suspicious: suspiciousCount,
        phishing: phishingCount,
        activeAlerts: alerts.filter(a => a.status === "ACTIVE").length
      },
      topThreatDomains,
      events: eventsRes.events,
      alerts: alerts.slice(0, 500),
      perSystem
    };
  }

  public async getAdminCredentials(): Promise<AdminCredentials> {
    const res = await this.pool.query("SELECT value FROM system_settings WHERE key = 'adminCredentials'");
    if (res.rows.length > 0 && res.rows[0].value) {
      return res.rows[0].value;
    }
    return {
      username: "admin",
      passwordHash: "28a5e2d7726bf2f12aadf95f091c32d70a6936a8bb5bc118e2f649fd6ce1075a",
      salt: "9a15afb5e24aded8f8bac3ffa66ac759"
    };
  }

  public async updateAdminCredentials(
    username: string,
    passwordHash: string,
    salt: string
  ): Promise<boolean> {
    await this.pool.query(
      `INSERT INTO system_settings (key, value)
       VALUES ('adminCredentials', $1)
       ON CONFLICT (key) DO UPDATE SET value = $1`,
      [JSON.stringify({ username, passwordHash, salt })]
    );
    return true;
  }

  public async createRemovalRequest(payload: {
    clientId: string;
    clientName?: string;
    reason?: string;
  }): Promise<RemovalRequest> {
    const id = `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date().toISOString();

    await this.pool.query(
      `INSERT INTO removal_requests (
        id, client_id, client_name, requested_at, status, reason
      ) VALUES ($1, $2, $3, $4, 'PENDING', $5)`,
      [id, payload.clientId, payload.clientName || payload.clientId, now, payload.reason || ""]
    );

    return {
      id,
      clientId: payload.clientId,
      clientName: payload.clientName || payload.clientId,
      requestedAt: now,
      status: "PENDING",
      reason: payload.reason || ""
    };
  }

  public async getRemovalRequests(): Promise<RemovalRequest[]> {
    const res = await this.pool.query("SELECT * FROM removal_requests ORDER BY requested_at DESC");
    return res.rows.map(r => ({
      id: r.id,
      clientId: r.client_id,
      clientName: r.client_name,
      requestedAt: new Date(r.requested_at).toISOString(),
      status: r.status,
      reason: r.reason,
      authorizationToken: r.authorization_token,
      tokenExpiresAt: r.token_expires_at ? new Date(r.token_expires_at).toISOString() : undefined,
      reviewedAt: r.reviewed_at ? new Date(r.reviewed_at).toISOString() : undefined,
      reviewedBy: r.reviewed_by,
      decisionNote: r.decision_note
    }));
  }

  public async getRemovalRequestById(id: string): Promise<RemovalRequest | null> {
    const reqs = await this.getRemovalRequests();
    return reqs.find(r => r.id === id) || null;
  }

  public async reviewRemovalRequest(
    id: string,
    decision: "APPROVE" | "DENY",
    reviewedBy = "admin",
    note?: string
  ): Promise<RemovalRequest | null> {
    const now = new Date();
    const token =
      decision === "APPROVE"
        ? `pg_auth_${Math.random().toString(36).substring(2, 12)}_${Date.now().toString(36)}`
        : null;
    const expiresAt =
      decision === "APPROVE" ? new Date(now.getTime() + 15 * 60 * 1000).toISOString() : null;

    await this.pool.query(
      `UPDATE removal_requests SET
        status = $1,
        reviewed_at = $2,
        reviewed_by = $3,
        decision_note = $4,
        authorization_token = $5,
        token_expires_at = $6
      WHERE id = $7`,
      [decision === "APPROVE" ? "APPROVED" : "DENIED", now.toISOString(), reviewedBy, note || null, token, expiresAt, id]
    );

    return this.getRemovalRequestById(id);
  }

  public async verifyAndConsumeRemovalToken(
    clientId: string,
    token: string
  ): Promise<{ authorized: boolean; error?: string }> {
    const res = await this.pool.query(
      `SELECT * FROM removal_requests WHERE client_id = $1 AND authorization_token = $2 AND status = 'APPROVED'`,
      [clientId, token]
    );

    if (res.rows.length === 0) {
      return { authorized: false, error: "Invalid, unauthorized, or expired removal authorization token" };
    }

    const row = res.rows[0];
    if (row.token_expires_at && new Date(row.token_expires_at).getTime() < Date.now()) {
      await this.pool.query("UPDATE removal_requests SET status = 'EXPIRED' WHERE id = $1", [row.id]);
      return { authorized: false, error: "Removal authorization token has expired (valid for 15 minutes only)" };
    }

    // Invalidate token and unenroll
    await this.pool.query(
      `UPDATE removal_requests SET
        authorization_token = NULL,
        decision_note = COALESCE(decision_note || ' | ', '') || 'Token consumed and agent uninstalled'
      WHERE id = $1`,
      [row.id]
    );

    await this.pool.query("DELETE FROM clients WHERE id = $1", [clientId]);

    return { authorized: true };
  }

  public getDatabaseInfo(): { isSupabase: boolean; host: string } {
    return {
      isSupabase: this.host.includes("supabase"),
      host: this.host
    };
  }

  public isPossiblyEphemeralDeployment(): boolean {
    return false;
  }
}
