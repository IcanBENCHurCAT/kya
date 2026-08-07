-- ============================================================
-- KYA Verification Service — Supabase Migration
-- ============================================================
-- This migration creates the tables needed for off-chain
-- human verification. Claims are stored in Supabase (PostgreSQL)
-- and NEVER on the Algorand blockchain.
--
-- Key design decisions:
-- - verification_attempts: Short-lived, deleted after use
-- - verification_claims: Permanent, no sensitive data stored
-- - Row-level security: Claims are readable by all agents
-- - Indexes on wallet_address and identity_hash for fast lookups
-- ============================================================

-- ---------------------------------------------------------------------------
-- 1. Verification Attempts Table
-- ---------------------------------------------------------------------------
-- Stores OTP codes (hashed) with TTL. Deleted immediately after
-- successful verification to ensure no sensitive data persists.

CREATE TABLE IF NOT EXISTS verification_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,           -- email or phone number
  method TEXT NOT NULL DEFAULT 'email', -- 'email' or 'phone'
  code_hash TEXT NOT NULL,             -- bcrypt hash of OTP
  code_salt TEXT NOT NULL,             -- bcrypt salt
  expires_at BIGINT NOT NULL,          -- Unix epoch ms (TTL)
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  created_at BIGINT NOT NULL           -- Unix epoch ms
);

-- Index for TTL-based cleanup
CREATE INDEX IF NOT EXISTS idx_attempts_expires ON verification_attempts (expires_at);

-- Index for rate limiting (recent attempts per identifier)
CREATE INDEX IF NOT EXISTS idx_attempts_identifier_created ON verification_attempts (identifier, created_at);

-- ---------------------------------------------------------------------------
-- 2. Verification Claims Table
-- ---------------------------------------------------------------------------
-- Permanent records of successful verifications.
-- Contains wallet address, identity hash, and signature.
-- The identity_hash is a SHA-256 hash of the email — NOT the email itself.

CREATE TABLE IF NOT EXISTS verification_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,        -- Algorand base32 address (58 chars)
  identity_hash TEXT NOT NULL,         -- SHA-256 hex of verified email
  method TEXT NOT NULL DEFAULT 'email', -- 'email', 'phone', 'oauth'
  verified_at BIGINT NOT NULL,         -- Unix epoch seconds
  signature TEXT NOT NULL,             -- Ed25519 hex signature
  key_id TEXT NOT NULL,                -- Key used to sign (for rotation)
  attempt_id UUID,                     -- Link to deleted attempt (nullable)
  created_at BIGINT NOT NULL,          -- Unix epoch ms
  updated_at BIGINT NOT NULL           -- Unix epoch ms
);

-- Index for wallet address lookup (can this wallet be verified?)
CREATE INDEX IF NOT EXISTS idx_claims_wallet ON verification_claims (wallet_address);

-- Index for identity hash lookup (has this identity verified?)
CREATE UNIQUE INDEX IF NOT EXISTS idx_claims_identity_hash ON verification_claims (identity_hash);

-- Index for signature verification
CREATE INDEX IF NOT EXISTS idx_claims_signature ON verification_claims (signature);

-- Index for method-based queries
CREATE INDEX IF NOT EXISTS idx_claims_method ON verification_claims (method);

-- ---------------------------------------------------------------------------
-- 3. Row-Level Security (RLS)
-- ---------------------------------------------------------------------------
-- Claims are readable by any authenticated user (other agents/services).
-- Only the service role can write.

ALTER TABLE verification_claims ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read claims
CREATE POLICY "Allow read access to all authenticated users"
  ON verification_claims
  FOR SELECT
  TO authenticated
  USING (true);

-- Only service role can insert claims
CREATE POLICY "Allow insert only for service role"
  ON verification_claims
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Only service role can delete claims
CREATE POLICY "Allow delete only for service role"
  ON verification_claims
  FOR DELETE
  TO service_role
  USING (true);

ALTER TABLE verification_attempts ENABLE ROW LEVEL SECURITY;

-- Only service role can access attempts (they contain OTP data)
CREATE POLICY "Allow service role full access to attempts"
  ON verification_attempts
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 4. Cleanup Function
-- ---------------------------------------------------------------------------
-- Called periodically (cron) to delete expired attempts.

CREATE OR REPLACE FUNCTION cleanup_expired_attempts()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM verification_attempts
  WHERE expires_at < EXTRACT(EPOCH FROM NOW()) * 1000;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- 5. View: Current Verification Status per Wallet
-- ---------------------------------------------------------------------------
-- Convenient view for checking if a wallet has been verified.

CREATE OR REPLACE VIEW v_wallet_verification_status AS
SELECT
  vc.wallet_address,
  COUNT(*) OVER (PARTITION BY vc.wallet_address) AS claim_count,
  MAX(vc.verified_at) OVER (PARTITION BY vc.wallet_address) AS latest_verified_at,
  vc.method AS latest_method,
  vc.identity_hash AS latest_identity_hash
FROM verification_claims vc
WHERE vc.verified_at = (
  SELECT MAX(verified_at) FROM verification_claims vc2
  WHERE vc2.wallet_address = vc.wallet_address
);
