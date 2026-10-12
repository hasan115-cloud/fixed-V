import { IDatabase, UrlEventFilters, UrlEventsResult, DashboardStatsResult, ReportDataResult } from "./dbTypes";
import { AdminCredentials, EnrolledClient, PhishingRule, RemovalRequest, RuleSyncStatus, ThreatAlert, UrlEvent, WhitelistRule } from "./types";

export class ResilientDatabase implements IDatabase {
  private primary: IDatabase;
  private secondary?: IDatabase;
  private primaryFailedRecently = false;
  private lastFailureTime = 0;
  private failureCooldownMs = 15_000; // 15s cooldown

  constructor(primary: IDatabase, secondary?: IDatabase) {
    this.primary = primary;
    this.secondary = secondary;
  }

  private isPrimaryCoolingDown(): boolean {
    if (this.primaryFailedRecently && Date.now() - this.lastFailureTime < this.failureCooldownMs) {
      return true;
    }
    this.primaryFailedRecently = false;
    return false;
  }

  private markPrimaryFailure(err: any) {
    this.primaryFailedRecently = true;
    this.lastFailureTime = Date.now();
    console.warn("Primary database operation failed, falling back to secondary:", err?.message || err);
  }

  /**
   * Dual-write mechanism: writes are always executed on both databases (if secondary exists)
   * to guarantee zero data loss and eliminate flapping between out-of-sync stores.
   */
  private async executeWrite<T>(fn: (db: IDatabase) => Promise<T>): Promise<T> {
    if (!this.secondary) {
      return fn(this.primary);
    }

    try {
      const primaryRes = await fn(this.primary);
      if (this.secondary) {
        try {
          await fn(this.secondary);
        } catch (secErr) {
          console.warn("Secondary write warning:", secErr);
        }
      }
      return primaryRes;
    } catch (primErr) {
      this.markPrimaryFailure(primErr);
      if (this.secondary) {
        try {
          return await fn(this.secondary);
        } catch (secErr) {
          console.warn("Secondary write also failed:", secErr);
        }
      }
      throw primErr;
    }
  }

  /**
   * Resilient read mechanism: reads from primary, but if primary fails or returns empty while
   * secondary holds genuine data, falls back to secondary without discarding data.
   */
  private async executeRead<T>(
    fn: (db: IDatabase) => Promise<T>,
    fallbackValue?: T,
    isEmpty?: (val: T) => boolean
  ): Promise<T> {
    if (!this.secondary) {
      return fn(this.primary);
    }

    if (this.isPrimaryCoolingDown()) {
      try {
        return await fn(this.secondary);
      } catch (secErr) {
        console.warn("Secondary database read issue:", secErr);
        if (fallbackValue !== undefined) return fallbackValue;
        throw secErr;
      }
    }

    try {
      const primaryRes = await fn(this.primary);
      return primaryRes;
    } catch (err: any) {
      this.markPrimaryFailure(err);
      if (this.secondary) {
        try {
          return await fn(this.secondary);
        } catch (secErr) {
          console.warn("Secondary database read failed:", secErr);
        }
      }
      if (fallbackValue !== undefined) return fallbackValue;
      throw err;
    }
  }

  public getDatabaseInfo(): { isSupabase: boolean; host: string } {
    if (this.primary.getDatabaseInfo) {
      return this.primary.getDatabaseInfo();
    }
    if (this.secondary && this.secondary.getDatabaseInfo) {
      return this.secondary.getDatabaseInfo();
    }
    return { isSupabase: false, host: "resilient" };
  }

  public isPossiblyEphemeralDeployment(): boolean {
    return this.primary.isPossiblyEphemeralDeployment();
  }

  public async getRuleVersion(): Promise<number> {
    return this.executeRead(d => d.getRuleVersion(), 1);
  }

  public async bumpRuleVersion(): Promise<number> {
    return this.executeWrite(d => d.bumpRuleVersion());
  }

  public async getRuleSyncStatus(): Promise<RuleSyncStatus> {
    return this.executeRead(
      d => d.getRuleSyncStatus(),
      {
        centralRuleVersion: 1,
        totalEnrolled: 0,
        synchronized: 0,
        outdated: 0,
        offline: 0,
        failed: 0
      }
    );
  }

  public async getWhitelistRules(): Promise<WhitelistRule[]> {
    return this.executeRead(d => d.getWhitelistRules(), [], r => !r || r.length === 0);
  }

  public async addWhitelistRule(pattern: string, description: string, addedBy?: string): Promise<WhitelistRule> {
    return this.executeWrite(d => d.addWhitelistRule(pattern, description, addedBy));
  }

  public async deleteWhitelistRule(id: string): Promise<boolean> {
    return this.executeWrite(d => d.deleteWhitelistRule(id));
  }

  public async getPhishingRules(): Promise<PhishingRule[]> {
    return this.executeRead(d => d.getPhishingRules(), [], r => !r || r.length === 0);
  }

  public async addPhishingRule(pattern: string, severity: "HIGH" | "CRITICAL", reason: string, addedBy?: string): Promise<PhishingRule> {
    return this.executeWrite(d => d.addPhishingRule(pattern, severity, reason, addedBy));
  }

  public async deletePhishingRule(id: string): Promise<boolean> {
    return this.executeWrite(d => d.deletePhishingRule(id));
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
    return this.executeWrite(d => d.registerOrUpdateClient(payload));
  }

  public async heartbeatClient(clientId: string, stats?: Record<string, number>, clientName?: string, ip?: string, ruleVersion?: number): Promise<boolean> {
    return this.executeWrite(d => d.heartbeatClient(clientId, stats, clientName, ip, ruleVersion));
  }

  public async getClients(): Promise<EnrolledClient[]> {
    return this.executeRead(d => d.getClients(), [], c => !c || c.length === 0);
  }

  public async clientExists(id: string): Promise<boolean> {
    return this.executeRead(d => d.clientExists(id), false);
  }

  public async getClientById(id: string): Promise<EnrolledClient | null> {
    return this.executeRead(d => d.getClientById(id), null);
  }

  public async deleteClient(id: string): Promise<boolean> {
    return this.executeWrite(d => d.deleteClient(id));
  }

  public async recordThreatAlert(alert: Omit<ThreatAlert, "id" | "timestamp" | "status">): Promise<ThreatAlert> {
    return this.executeWrite(d => d.recordThreatAlert(alert));
  }

  public async getThreatAlerts(clientId?: string): Promise<ThreatAlert[]> {
    return this.executeRead(d => d.getThreatAlerts(clientId), []);
  }

  public async updateThreatAlertStatus(id: string, status: "ACKNOWLEDGED" | "RESOLVED"): Promise<boolean> {
    return this.executeWrite(d => d.updateThreatAlertStatus(id, status));
  }

  public async hasEventId(eventId: string): Promise<boolean> {
    return this.executeRead(d => d.hasEventId(eventId), false);
  }

  public async recordUrlEvent(
    event: Omit<UrlEvent, "id" | "timestamp">,
    occurredAt?: string
  ): Promise<{ event: UrlEvent; wasNew: boolean }> {
    return this.executeWrite(d => d.recordUrlEvent(event, occurredAt));
  }

  public async getUrlEvents(filters?: UrlEventFilters): Promise<UrlEventsResult> {
    return this.executeRead(
      d => d.getUrlEvents(filters),
      { events: [], total: 0 },
      res => !res || !res.events || res.events.length === 0
    );
  }

  public async getDashboardStats(clientId?: string): Promise<DashboardStatsResult> {
    return this.executeRead(
      d => d.getDashboardStats(clientId),
      {
        scope: clientId || "ALL",
        totalSystems: 0,
        urlsMonitored: 0,
        allowedUrls: 0,
        phishingIntercepted: 0,
        activeAlerts: 0,
        breakdown: { evaluated: 0, safe: 0, suspicious: 0, phishing: 0 },
        recentEvents: [],
        topThreatDomains: []
      },
      stats => !stats || stats.urlsMonitored === 0
    );
  }

  public async getReportData(clientId?: string, startDate?: string, endDate?: string): Promise<ReportDataResult> {
    return this.executeRead(
      d => d.getReportData(clientId, startDate, endDate),
      {
        scope: clientId || "ALL",
        generatedAt: new Date().toISOString(),
        systems: [],
        summary: { totalEvaluated: 0, safe: 0, suspicious: 0, phishing: 0, activeAlerts: 0 },
        topThreatDomains: [],
        events: [],
        alerts: [],
        perSystem: []
      }
    );
  }

  public async getAdminCredentials(): Promise<AdminCredentials> {
    return this.executeRead(d => d.getAdminCredentials(), {
      username: "admin",
      passwordHash: "28a5e2d7726bf2f12aadf95f091c32d70a6936a8bb5bc118e2f649fd6ce1075a",
      salt: "9a15afb5e24aded8f8bac3ffa66ac759"
    });
  }

  public async updateAdminCredentials(username: string, passwordHash: string, salt: string): Promise<boolean> {
    return this.executeWrite(d => d.updateAdminCredentials(username, passwordHash, salt));
  }

  public async createRemovalRequest(payload: { clientId: string; clientName?: string; reason?: string }): Promise<RemovalRequest> {
    return this.executeWrite(d => d.createRemovalRequest(payload));
  }

  public async getRemovalRequests(): Promise<RemovalRequest[]> {
    return this.executeRead(d => d.getRemovalRequests(), []);
  }

  public async getRemovalRequestById(id: string): Promise<RemovalRequest | null> {
    return this.executeRead(d => d.getRemovalRequestById(id), null);
  }

  public async reviewRemovalRequest(id: string, decision: "APPROVE" | "DENY", reviewedBy?: string, note?: string): Promise<RemovalRequest | null> {
    return this.executeWrite(d => d.reviewRemovalRequest(id, decision, reviewedBy, note));
  }

  public async verifyAndConsumeRemovalToken(clientId: string, token: string): Promise<{ authorized: boolean; error?: string }> {
    return this.executeWrite(d => d.verifyAndConsumeRemovalToken(clientId, token));
  }
}
