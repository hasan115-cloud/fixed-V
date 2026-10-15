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

export interface UrlEventFilters {
  clientId?: string;
  classification?: string;
  search?: string;
  limit?: number;
  offset?: number;
  startDate?: string;
  endDate?: string;
}

export interface UrlEventsResult {
  events: UrlEvent[];
  total: number;
}

export interface DashboardStatsResult {
  scope: string;
  totalSystems: number;
  urlsMonitored: number;
  allowedUrls: number;
  phishingIntercepted: number;
  activeAlerts: number;
  breakdown: {
    evaluated: number;
    safe: number;
    suspicious: number;
    phishing: number;
  };
  recentEvents: UrlEvent[];
  topThreatDomains: { domain: string; count: number }[];
}

export interface ReportDataResult {
  scope: string;
  generatedAt: string;
  systems: EnrolledClient[];
  summary: {
    totalEvaluated: number;
    safe: number;
    suspicious: number;
    phishing: number;
    activeAlerts: number;
  };
  topThreatDomains: { domain: string; count: number }[];
  events: UrlEvent[];
  alerts: ThreatAlert[];
  perSystem?: {
    clientId: string;
    clientName: string;
    os: string;
    browser: string;
    totalScanned: number;
    safe: number;
    suspicious: number;
    phishing: number;
    activeAlerts: number;
  }[];
}

export interface IDatabase {
  hasEventId(eventId: string): Promise<boolean>;
  recordUrlEvent(
    event: Omit<UrlEvent, "id" | "timestamp">,
    occurredAt?: string
  ): Promise<{ event: UrlEvent; wasNew: boolean }>;
  getUrlEvents(filters?: UrlEventFilters): Promise<UrlEventsResult>;
  registerOrUpdateClient(payload: {
    clientId: string;
    clientName?: string;
    os?: string;
    browser?: string;
    platform?: string;
    extensionVersion?: string;
    ruleVersion?: number;
    ip?: string;
  }): Promise<EnrolledClient>;
  heartbeatClient(
    clientId: string,
    stats?: Record<string, number>,
    clientName?: string,
    ip?: string,
    ruleVersion?: number
  ): Promise<boolean>;
  getClients(): Promise<EnrolledClient[]>;
  clientExists(id: string): Promise<boolean>;
  getClientById(id: string): Promise<EnrolledClient | null>;
  deleteClient(id: string): Promise<boolean>;
  recordThreatAlert(
    alert: Omit<ThreatAlert, "id" | "timestamp" | "status">
  ): Promise<ThreatAlert>;
  getThreatAlerts(clientId?: string): Promise<ThreatAlert[]>;
  updateThreatAlertStatus(
    id: string,
    status: "ACKNOWLEDGED" | "RESOLVED"
  ): Promise<boolean>;
  getRuleVersion(): Promise<number>;
  bumpRuleVersion(): Promise<number>;
  getRuleSyncStatus(): Promise<RuleSyncStatus>;
  getWhitelistRules(): Promise<WhitelistRule[]>;
  addWhitelistRule(
    pattern: string,
    description: string,
    addedBy?: string
  ): Promise<WhitelistRule>;
  updateWhitelistRule(
    id: string,
    updates: Partial<WhitelistRule>
  ): Promise<WhitelistRule | null>;
  deleteWhitelistRule(id: string): Promise<boolean>;
  getPhishingRules(): Promise<PhishingRule[]>;
  addPhishingRule(
    pattern: string,
    severity: "HIGH" | "CRITICAL",
    reason: string,
    addedBy?: string
  ): Promise<PhishingRule>;
  updatePhishingRule(
    id: string,
    updates: Partial<PhishingRule>
  ): Promise<PhishingRule | null>;
  deletePhishingRule(id: string): Promise<boolean>;
  getDashboardStats(clientId?: string): Promise<DashboardStatsResult>;
  getReportData(
    clientId?: string,
    startDate?: string,
    endDate?: string
  ): Promise<ReportDataResult>;
  getAdminCredentials(): Promise<AdminCredentials>;
  updateAdminCredentials(
    username: string,
    passwordHash: string,
    salt: string
  ): Promise<boolean>;
  createRemovalRequest(payload: {
    clientId: string;
    clientName?: string;
    reason?: string;
  }): Promise<RemovalRequest>;
  getRemovalRequests(): Promise<RemovalRequest[]>;
  getRemovalRequestById(id: string): Promise<RemovalRequest | null>;
  reviewRemovalRequest(
    id: string,
    decision: "APPROVE" | "DENY",
    reviewedBy?: string,
    note?: string
  ): Promise<RemovalRequest | null>;
  verifyAndConsumeRemovalToken(
    clientId: string,
    token: string
  ): Promise<{ authorized: boolean; error?: string }>;
  getDatabaseInfo(): { isSupabase: boolean; host: string };
  isPossiblyEphemeralDeployment(): boolean;
}
