export type NavigationTab =
  | "overview"
  | "url_history"
  | "enrolled_systems"
  | "security_rules"
  | "threat_alerts"
  | "install_extension"
  | "reports"
  | "admin_settings"
  | "removal_requests";

export type UrlClassification = "SAFE" | "SUSPICIOUS" | "PHISHING";
export type UrlVerdict = "ALLOWED" | "WARNING" | "BLOCKED";

export interface UrlEvent {
  id: string;
  eventId?: string;
  url: string;
  domain: string;
  classification: UrlClassification;
  verdict?: UrlVerdict;
  score: number;
  reason: string;
  clientId: string;
  clientName: string;
  source: string;
  timestamp: string;
  ruleTriggered?: boolean;
  ruleType?: "WHITELIST" | "PHISHING" | null;
}

export interface EnrolledClient {
  id: string;
  clientName: string;
  os: string;
  browser: string;
  platform: string;
  extensionVersion: string;
  ruleVersion: number;
  firstEnrolled?: string;
  firstSeen?: string;
  lastSeen: string;
  status: "ENROLLED" | "OFFLINE" | "SUSPENDED";
  connectionStatus?: "ONLINE" | "OFFLINE" | "CONNECTED" | "IDLE" | "ACTIVE";
  ip?: string;
  telemetryStats: {
    totalScanned: number;
    safeEvaluated: number;
    suspiciousDetected: number;
    phishingBlocked: number;
  };
}

export interface StoredClient extends EnrolledClient {}

export const ONLINE_THRESHOLD_MS = 60 * 1000;

export interface ThreatAlert {
  id: string;
  clientId: string;
  clientName: string;
  url: string;
  domain: string;
  score: number;
  reasons: string[];
  source: string;
  timestamp: string;
  status: "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED";
}

export interface WhitelistRule {
  id: string;
  pattern: string;
  description: string;
  enabled?: boolean;
  addedBy?: string;
  createdAt: string;
}

export interface PhishingRule {
  id: string;
  pattern: string;
  severity: "HIGH" | "CRITICAL";
  reason: string;
  enabled?: boolean;
  addedBy?: string;
  createdAt: string;
}

export interface RuleSyncStatus {
  serverVersion?: number;
  centralRuleVersion?: number;
  totalWhitelist?: number;
  totalPhishing?: number;
  totalEnrolled?: number;
  synchronized?: number;
  outdated?: number;
  offline?: number;
  failed?: number;
  lastBumpedAt?: string;
  clientsCount?: number;
  upToDateClientsCount?: number;
}

export interface RemovalRequest {
  id: string;
  clientId: string;
  clientName: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "DENIED" | "EXPIRED";
  createdAt?: string;
  requestedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  note?: string;
  decisionNote?: string;
  authorizationToken?: string;
  tokenExpiresAt?: string;
  consumedAt?: string;
}

export interface AdminCredentials {
  username: string;
  passwordHash: string;
  salt: string;
}

export interface DatabaseSchema {
  ruleVersion: number;
  clients: EnrolledClient[];
  heartbeats: any[];
  threatAlerts: ThreatAlert[];
  whitelistRules: WhitelistRule[];
  phishingRules: PhishingRule[];
  removalRequests: RemovalRequest[];
  admin: AdminCredentials;
  urlEvents: UrlEvent[];
}

export interface DashboardStats {
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

export interface ReportData {
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
