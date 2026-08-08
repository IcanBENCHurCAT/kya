# Phase 2 — x402 Payment Gate & Karma Ledger API Task List

**Feature Branch**: `feature/phase2-x402-karma`  
**Specification**: [spec.md](file:///c:/Users/Garret/.gemini/antigravity/scratch/kya-service/specs/feature-phase2-x402-karma/spec.md)  
**Architecture Spec**: [ARCHITECTURE.md](file:///c:/Users/Garret/.gemini/antigravity/scratch/kya-service/docs/ARCHITECTURE.md)  
**Constitution**: [constitution.md](file:///c:/Users/Garret/.gemini/antigravity/scratch/kya-service/.specify/memory/constitution.md)

---

## Phase 1: Database Schema & Migrations

- [x] Task 1.1: Create Supabase SQL Migration Script [File: `db/migrations/002_karma_ledger.sql`]
  - Define `agent_profiles` table (`agent_address` PRIMARY KEY, `karma_score`, `tier`, `risk_flags`, `verification_level`, `registered_at`, `last_updated`, `owner_identity_hash`, `total_queries_paid`).
  - Define `karma_events` table (`id` UUID PRIMARY KEY, `agent_address` FK, `event_type`, `amount`, `reason`, `txid`, `timestamp`).
  - Define `karma_balances` table (`agent_address` PRIMARY KEY, `score`, `staked_amount`, `updated_at`).
  - Define `x402_receipts` table (`receipt_id` UUID PRIMARY KEY, `txid` UNIQUE, `payer_address`, `amount_micro_algo`, `endpoint`, `timestamp`).
  - Add indexes for fast lookups on `agent_address`, `txid`, `timestamp`, and `event_type`.
  - Add Row-Level Security (RLS) policies allowing read access to authenticated users and write operations strictly for service role.

---

## Phase 2: Karma Service Layer

- [x] Task 2.1: Implement `InMemoryKarmaStore` [File: `src/services/karma.ts`]
  - Implement in-memory Map stores for agent profiles, karma events, and x402 receipts.
  - Implement fallback handling when Supabase credentials (`SUPABASE_URL` / `SUPABASE_KEY`) are missing or unconfigured.
- [x] Task 2.2: Implement Core `KarmaService` Class [File: `src/services/karma.ts`]
  - `getProfile(address)`: Fetch agent profile and reputation record.
  - `recordEvent(event)`: Credit or debit agent karma score, persist `KarmaEvent`, update `agent_profiles` score, tier, and timestamp.
  - `getHistory(address)`: Query chronological event log for a given agent address.
  - `calculateTier(score)`: Compute Tier 0 (0-299), Tier 1 (300-599), Tier 2 (600-849), Tier 3 (850-1000) visual badging and execution limits according to architecture spec.

---

## Phase 3: x402 Payment Middleware

- [x] Task 3.1: Implement Payment Challenge Generator [File: `src/middleware/x402.ts`]
  - Intercept unauthenticated requests missing `X-Payment` header across gated routes.
  - Return HTTP 402 `Payment Required` payload containing `priceMicroAlgo` (default 1000 or dynamic pricing formula), `receiverAddress`, `expiresInSeconds`, and step-by-step instructions.
- [x] Task 3.2: Implement On-Chain Algorand Payment Verification & Replay Protection [File: `src/middleware/x402.ts`]
  - Verify transaction formatting, receiver address match, minimum payment amount, and confirmation on Algorand mainnet/testnet via `algosdk` / Indexer client.
  - Maintain `X402Receipt` ledger and prevent replay attacks by checking uniqueness of `X-Payment` transaction ID (`txid`).
  - Attach `X-Payment-Receipt` response header upon successful payment verification.
- [x] Task 3.3: Implement Exempt Route Filtering [File: `src/middleware/x402.ts`]
  - Ensure `/health` and `/api/v1/x402/*` negotiation endpoints bypass payment challenges.

---

## Phase 4: HTTP Routes & Express Integration

- [x] Task 4.1: Implement Karma REST Endpoints [File: `src/routes/karma.ts`]
  - `GET /api/v1/karma/:address`: Retrieve agent profile, karma score, tier, total event count, and history.
  - `POST /api/v1/karma/event`: Endpoint to record credit/debit karma events (`agentAddress`, `eventType`, `amount`, `reason`).
- [x] Task 4.2: Wire Middleware & Routes in App Gateway [File: `src/app.ts`]
  - Mount `x402Middleware` globally across gated routes (`/api/v1/screen`, `/api/v1/verify`, `/api/v1/wallet-analysis`, `/api/v1/karma`).
  - Mount `karmaRouter` under `/api/v1/karma`.

---

## Phase 5: Vitest Test Suite

- [x] Task 5.1: Create Karma Service Unit & Integration Tests [File: `__tests__/karma.test.ts`]
  - Test profile creation, score updates (credit/debit), tier assignment, and event history retrieval.
  - Test seamless fallback to `InMemoryKarmaStore` when Supabase is disabled.
- [x] Task 5.2: Create x402 Payment Middleware Tests [File: `__tests__/x402.test.ts`]
  - Test HTTP 402 challenge response on missing `X-Payment` header.
  - Test exempt route pass-through (`/health`, `/api/v1/x402/*`).
  - Test payment verification and replay protection (duplicate `txid` rejection).

---

## Phase 6: Build & Test Verification

- [x] Task 6.1: Execute Vitest Test Suite [Command: `npm test`]
  - Run `npm test` (`vitest run`) and verify 100% pass rate across all test modules.
- [x] Task 6.2: Execute TypeScript Build Check [Command: `npm run build`]
  - Run `npm run build` (`tsc`) to verify type safety and clean output compilation.
