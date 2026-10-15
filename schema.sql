-- PhishGuard Enterprise Security Hub — Production Database Schema
-- Compatible with Supabase, PostgreSQL 14+, Neon, Cloud SQL, and AWS RDS.

-- 1. Enrolled Client Workstations / Extension Agents
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

CREATE INDEX IF NOT EXISTS idx_clients_status ON clients (status);
CREATE INDEX IF NOT EXISTS idx_clients_last_seen ON clients (last_seen DESC);

-- 2. Durable URL Event Telemetry & Navigation History
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

-- Enforce exactly one row per observation across concurrent submissions
CREATE UNIQUE INDEX IF NOT EXISTS uq_url_events_event_id
    ON url_events (event_id) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_url_events_client ON url_events (client_id);
CREATE INDEX IF NOT EXISTS idx_url_events_occurred_at ON url_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_url_events_classification ON url_events (classification);
CREATE INDEX IF NOT EXISTS idx_url_events_domain ON url_events (domain);

-- 3. Phishing & Threat Alerts
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

CREATE INDEX IF NOT EXISTS idx_threat_alerts_client ON threat_alerts (client_id);
CREATE INDEX IF NOT EXISTS idx_threat_alerts_status ON threat_alerts (status);
CREATE INDEX IF NOT EXISTS idx_threat_alerts_occurred_at ON threat_alerts (occurred_at DESC);

-- 4. Central Whitelist Rules
CREATE TABLE IF NOT EXISTS whitelist_rules (
    id TEXT PRIMARY KEY,
    pattern TEXT NOT NULL UNIQUE,
    description TEXT,
    added_by TEXT,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Central Phishing Rules
CREATE TABLE IF NOT EXISTS phishing_rules (
    id TEXT PRIMARY KEY,
    pattern TEXT NOT NULL UNIQUE,
    severity TEXT NOT NULL,
    reason TEXT,
    added_by TEXT,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Extension Diagnostic Heartbeats Log
CREATE TABLE IF NOT EXISTS heartbeats (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    stats JSONB
);

CREATE INDEX IF NOT EXISTS idx_heartbeats_client ON heartbeats (client_id);
CREATE INDEX IF NOT EXISTS idx_heartbeats_occurred_at ON heartbeats (occurred_at DESC);

-- 7. Central System Settings & Administrator Credentials
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL
);

-- 8. Admin-Controlled Extension Removal Requests
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

CREATE INDEX IF NOT EXISTS idx_removal_requests_client ON removal_requests (client_id);
CREATE INDEX IF NOT EXISTS idx_removal_requests_status ON removal_requests (status);
CREATE INDEX IF NOT EXISTS idx_removal_requests_requested_at ON removal_requests (requested_at DESC);

-- Row Level Security (RLS) Configuration for Supabase
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE url_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE threat_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE whitelist_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE phishing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE heartbeats ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE removal_requests ENABLE ROW LEVEL SECURITY;

-- Permissive policies for serverless and authenticated Supabase access
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'phishguard_clients_policy') THEN
        CREATE POLICY phishguard_clients_policy ON clients FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'phishguard_url_events_policy') THEN
        CREATE POLICY phishguard_url_events_policy ON url_events FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'phishguard_threat_alerts_policy') THEN
        CREATE POLICY phishguard_threat_alerts_policy ON threat_alerts FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'phishguard_whitelist_policy') THEN
        CREATE POLICY phishguard_whitelist_policy ON whitelist_rules FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'phishguard_phishing_policy') THEN
        CREATE POLICY phishguard_phishing_policy ON phishing_rules FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'phishguard_heartbeats_policy') THEN
        CREATE POLICY phishguard_heartbeats_policy ON heartbeats FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'phishguard_settings_policy') THEN
        CREATE POLICY phishguard_settings_policy ON system_settings FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'phishguard_removal_policy') THEN
        CREATE POLICY phishguard_removal_policy ON removal_requests FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;
