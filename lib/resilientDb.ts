import {
  AdminCredentials,
  EnrolledClient,
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

export class ResilientDatabase implements IDatabase {
  constructor(
    private primary: IDatabase,
    private secondary: IDatabase
  ) {}

  private async tryOp<T>(op: (db: IDatabase) => Promise<T>): Promise<T> {
    try {
      return await op(this.primary);
    } catch (err: any) {
      console.warn("Notice: Primary database error, falling back to secondary:", err?.message);
      return await op(this.secondary);
    }
  }

  public hasEventId(eventId: string): Promise<boolean> {
    return this.tryOp(db => db.hasEventId(eventId));
  }

  public recordUrlEvent(
    event: Omit<UrlEvent, "id" | "timestamp">,
    occurredAt?: string
  ): Promise<{ event: UrlEvent; wasNew: boolean }> {
    return this.tryOp(db => db.recordUrlEvent(event, occurredAt));
  }

  public getUrlEvents(filters?: UrlEventFilters): Promise<UrlEventsResult> {
    return this.tryOp(db => db.getUrlEvents(filters));
  }

  public registerOrUpdateClient(payload: {
    clientId: string;
    clientName?: string;
    os?: string;
    browser?: string;
    platform?: string;
    extensionVersion?: string;
    ruleVersion?: number;
    ip?: string;
  }): Promise<EnrolledClient> {
    return this.tryOp(db => db.registerOrUpdateClient(payload));
  }

  public heartbeatClient(
    clientId: string,
    stats?: Record<string, number>,
    clientName?: string,
    ip?: string,
    ruleVersion?: number
  ): Promise<boolean> {
    return this.tryOp(db => db.heartbeatClient(clientId, stats, clientName, ip, ruleVersion));
  }

  public getClients(): Promise<EnrolledClient[]> {
    return this.tryOp(db => db.getClients());
  }

  public clientExists(id: string): Promise<boolean> {
    return this.tryOp(db => db.clientExists(id));
  }

  public getClientById(id: string): Promise<EnrolledClient | null> {
    return this.tryOp(db => db.getClientById(id));
  }

  public deleteClient(id: string): Promise<boolean> {
    return this.tryOp(db => db.deleteClient(id));
  }

  public recordThreatAlert(
    alert: Omit<ThreatAlert, "id" | "timestamp" | "status">
  ): Promise<ThreatAlert> {
    return this.tryOp(db => db.recordThreatAlert(alert));
  }

  public getThreatAlerts(clientId?: string): Promise<ThreatAlert[]> {
    return this.tryOp(db => db.getThreatAlerts(clientId));
  }

  public updateThreatAlertStatus(
    id: string,
    status: "ACKNOWLEDGED" | "RESOLVED"
  ): Promise<boolean> {
    return this.tryOp(db => db.updateThreatAlertStatus(id, status));
  }

  public getRuleVersion(): Promise<number> {
    return this.tryOp(db => db.getRuleVersion());
  }

  public bumpRuleVersion(): Promise<number> {
    return this.tryOp(db => db.bumpRuleVersion());
  }

  public getRuleSyncStatus(): Promise<RuleSyncStatus> {
    return this.tryOp(db => db.getRuleSyncStatus());
  }

  public getWhitelistRules(): Promise<WhitelistRule[]> {
    return this.tryOp(db => db.getWhitelistRules());
  }

  public addWhitelistRule(
    pattern: string,
    description: string,
    addedBy?: string
  ): Promise<WhitelistRule> {
    return this.tryOp(db => db.addWhitelistRule(pattern, description, addedBy));
  }

  public updateWhitelistRule(
    id: string,
    updates: Partial<WhitelistRule>
  ): Promise<WhitelistRule | null> {
    return this.tryOp(db => db.updateWhitelistRule(id, updates));
  }

  public deleteWhitelistRule(id: string): Promise<boolean> {
    return this.tryOp(db => db.deleteWhitelistRule(id));
  }

  public getPhishingRules(): Promise<PhishingRule[]> {
    return this.tryOp(db => db.getPhishingRules());
  }

  public addPhishingRule(
    pattern: string,
    severity: "HIGH" | "CRITICAL",
    reason: string,
    addedBy?: string
  ): Promise<PhishingRule> {
    return this.tryOp(db => db.addPhishingRule(pattern, severity, reason, addedBy));
  }

  public updatePhishingRule(
    id: string,
    updates: Partial<PhishingRule>
  ): Promise<PhishingRule | null> {
    return this.tryOp(db => db.updatePhishingRule(id, updates));
  }

  public deletePhishingRule(id: string): Promise<boolean> {
    return this.tryOp(db => db.deletePhishingRule(id));
  }

  public getDashboardStats(clientId?: string): Promise<DashboardStatsResult> {
    return this.tryOp(db => db.getDashboardStats(clientId));
  }

  public getReportData(
    clientId?: string,
    startDate?: string,
    endDate?: string
  ): Promise<ReportDataResult> {
    return this.tryOp(db => db.getReportData(clientId, startDate, endDate));
  }

  public getAdminCredentials(): Promise<AdminCredentials> {
    return this.tryOp(db => db.getAdminCredentials());
  }

  public updateAdminCredentials(
    username: string,
    passwordHash: string,
    salt: string
  ): Promise<boolean> {
    return this.tryOp(db => db.updateAdminCredentials(username, passwordHash, salt));
  }

  public createRemovalRequest(payload: {
    clientId: string;
    clientName?: string;
    reason?: string;
  }): Promise<RemovalRequest> {
    return this.tryOp(db => db.createRemovalRequest(payload));
  }

  public getRemovalRequests(): Promise<RemovalRequest[]> {
    return this.tryOp(db => db.getRemovalRequests());
  }

  public getRemovalRequestById(id: string): Promise<RemovalRequest | null> {
    return this.tryOp(db => db.getRemovalRequestById(id));
  }

  public reviewRemovalRequest(
    id: string,
    decision: "APPROVE" | "DENY",
    reviewedBy?: string,
    note?: string
  ): Promise<RemovalRequest | null> {
    return this.tryOp(db => db.reviewRemovalRequest(id, decision, reviewedBy, note));
  }

  public verifyAndConsumeRemovalToken(
    clientId: string,
    token: string
  ): Promise<{ authorized: boolean; error?: string }> {
    return this.tryOp(db => db.verifyAndConsumeRemovalToken(clientId, token));
  }

  public getDatabaseInfo(): { isSupabase: boolean; host: string } {
    try {
      return this.primary.getDatabaseInfo();
    } catch {
      return this.secondary.getDatabaseInfo();
    }
  }

  public isPossiblyEphemeralDeployment(): boolean {
    return false;
  }
}
