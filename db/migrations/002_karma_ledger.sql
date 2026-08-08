-- ============================================================
-- KYA Karma Ledger & x402 Receipts — Supabase Migration
-- ============================================================
-- Defines tables for tracking agent reputation, karma events,
-- balances, and verified x402 payment receipts.
--
-- Tables:
-- 1. agent_profiles
-- 2. karma_events
-- 3. karma_balances
-- 4. x402_receipts
-- ============================================================

-- ---------------------------------------------------------------------------
-- 1. Agent Profiles Table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agent_profiles (
  agent_address TEXT PRIMARY KEY,
  karma_score BIGINT NOT NULL DEFAULT 0,
  tier INTEGER NOT NULL DEFAULT 0,
  risk_flags INTEGER NOT NULL DEFAULT 0,
  verification_level INTEGER NOT NULL DEFAULT 0,
  registered_at BIGINT NOT NULL,
  last_updated BIGINT NOT NULL,
  owner_identity_hash TEXT,
  total_queries_paid BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_agent_profiles_tier ON agent_profiles (tier);
CREATE INDEX IF NOT EXISTS idx_agent_profiles_karma_score ON agent_profiles (karma_score);
CREATE INDEX IF NOT EXISTS idx_agent_profiles_updated ON agent_profiles (last_updated);

-- ---------------------------------------------------------------------------
-- 2. Karma Events Table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS karma_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_address TEXT NOT NULL REFERENCES agent_profiles(agent_address) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  amount BIGINT NOT NULL,
  reason TEXT NOT NULL,
  txid TEXT,
  timestamp BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_karma_events_agent ON karma_events (agent_address);
CREATE INDEX IF NOT EXISTS idx_karma_events_txid ON karma_events (txid);
CREATE INDEX IF NOT EXISTS idx_karma_events_timestamp ON karma_events (timestamp);
CREATE INDEX IF NOT EXISTS idx_karma_events_type ON karma_events (event_type);

-- ---------------------------------------------------------------------------
-- 3. Karma Balances Table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS karma_balances (
  agent_address TEXT PRIMARY KEY REFERENCES agent_profiles(agent_address) ON DELETE CASCADE,
  score BIGINT NOT NULL DEFAULT 0,
  staked_amount BIGINT NOT NULL DEFAULT 0,
  updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_karma_balances_score ON karma_balances (score);
CREATE INDEX IF NOT EXISTS idx_karma_balances_updated ON karma_balances (updated_at);

-- ---------------------------------------------------------------------------
-- 4. x402 Receipts Table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS x402_receipts (
  receipt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  txid TEXT UNIQUE NOT NULL,
  payer_address TEXT NOT NULL,
  amount_micro_algo BIGINT NOT NULL,
  endpoint TEXT NOT NULL,
  timestamp BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_x402_receipts_payer ON x402_receipts (payer_address);
CREATE INDEX IF NOT EXISTS idx_x402_receipts_txid ON x402_receipts (txid);
CREATE INDEX IF NOT EXISTS idx_x402_receipts_timestamp ON x402_receipts (timestamp);
CREATE INDEX IF NOT EXISTS idx_x402_receipts_endpoint ON x402_receipts (endpoint);

-- ---------------------------------------------------------------------------
-- 5. Row-Level Security (RLS) Policies
-- ---------------------------------------------------------------------------
ALTER TABLE agent_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE karma_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE karma_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE x402_receipts ENABLE ROW LEVEL SECURITY;

-- Allow read access to all authenticated users
CREATE POLICY "Allow read access to authenticated users on agent_profiles"
  ON agent_profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow read access to authenticated users on karma_events"
  ON karma_events FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow read access to authenticated users on karma_balances"
  ON karma_balances FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow read access to authenticated users on x402_receipts"
  ON x402_receipts FOR SELECT TO authenticated USING (true);

-- Allow service_role full access (INSERT, UPDATE, DELETE)
CREATE POLICY "Allow write access for service role on agent_profiles"
  ON agent_profiles FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Allow write access for service role on karma_events"
  ON karma_events FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Allow write access for service role on karma_balances"
  ON karma_balances FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Allow write access for service role on x402_receipts"
  ON x402_receipts FOR ALL TO service_role USING (true) WITH CHECK (true);
