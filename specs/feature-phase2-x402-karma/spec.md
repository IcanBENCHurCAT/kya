# Feature Specification: Phase 2 — x402 Payment Gate & Karma Ledger API

**Feature Branch**: `feature/phase2-x402-karma`  
**Created**: 2026-08-08  
**Status**: Draft  
**Input**: User description: "Phase 2 (x402 Payment Gate & Karma Ledger API)"

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — x402 Micro-Payment Enforcement (Priority: P1)
As an API consumer or autonomous AI agent calling screening, verification, karma, or wallet analysis endpoints, I want to receive an HTTP 402 challenge when unauthenticated, so that I can submit an Algorand microALGO or ASA (USDCa) payment transaction to unlock authorized API access.

**Why this priority**: Implements Principle II (NON-NEGOTIABLE). Gating endpoints behind microALGO payments creates the primary monetization engine for KYA.

**Independent Test**:
- Call `POST /api/v1/screen` without an `X-Payment` header $\rightarrow$ receive `HTTP 402 Payment Required` with `paymentOffer` details.
- Retry with `X-Payment: <valid_algorand_txid>` $\rightarrow$ request succeeds with `X-Payment-Receipt` response header.

**Acceptance Scenarios**:
1. **Given** an unauthenticated request to any gated route, **When** `X-Payment` header is missing, **Then** return HTTP 402 containing `priceMicroAlgo` (default 1000), `receiverAddress`, `expiresInSeconds`, and instructions.
2. **Given** a request with an `X-Payment` header, **When** the transaction ID format is valid and unused, **Then** allow execution and set `X-Payment-Receipt`.
3. **Given** `/health` or `/api/v1/x402/*` negotiation endpoints, **When** requested, **Then** pass through without payment challenge.

---

### User Story 2 — On-Chain Karma Ledger API & Event Recording (Priority: P1)
As a platform operator, agent supervisor, or counterparty agent, I want to record karma reputation events (credit, debit, emit) and query real-time agent karma scores, so that agent trustworthiness can be programmatically verified.

**Why this priority**: Implements Principle III (On-Chain Karma System). Establishes the core Karma ledger API and database persistence.

**Independent Test**:
- Call `POST /api/v1/karma/event` to credit or debit an agent's karma $\rightarrow$ score updates, event is logged.
- Call `GET /api/v1/karma/:address` $\rightarrow$ return score, event count, and history.

**Acceptance Scenarios**:
1. **Given** an agent address, **When** querying `GET /api/v1/karma/:address`, **Then** return agent record (`score`, `totalEvents`, `lastUpdated`, `events`).
2. **Given** a valid event payload (`agentAddress`, `eventType`, `amount`, `reason`), **When** posting to `/api/v1/karma/event`, **Then** update score, persist event, and return updated karma record.

---

## Edge Cases

- What happens when an `X-Payment` transaction ID has already been redeemed? (Replay attack protection: reject with HTTP 400 Bad Request).
- How does the system handle missing Supabase database credentials? (Seamless fallback to `InMemoryKarmaStore` and `InMemoryClaimStore`).
- What happens when a sanctions match is detected on a paid request? (Refund header issued or soft quarantine HTTP 423 returned).

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST enforce x402 middleware across `/api/v1/screen`, `/api/v1/verify`, `/api/v1/wallet-analysis`, and `/api/v1/karma`.
- **FR-002**: System MUST exempt `/health` and `/api/v1/x402/*` routes from payment challenges.
- **FR-003**: System MUST provide `002_karma_ledger.sql` Supabase migration defining `agent_profiles`, `karma_events`, `karma_balances`, and `x402_receipts` tables with RLS policies.
- **FR-004**: `KarmaService` MUST support in-memory store fallback when Supabase credentials are not configured.
- **FR-005**: `npm test` MUST run all unit and integration tests via `vitest` and pass cleanly.

---

## Key Entities

- **AgentProfile**: Core identity record (`agentAddress`, `karmaScore`, `tier`, `registeredAt`, `ownerHash`).
- **KarmaEvent**: Reputation audit entry (`id`, `agentAddress`, `eventType`, `amount`, `reason`, `timestamp`, `txid`).
- **X402Receipt**: Payment receipt (`receiptId`, `txid`, `payerAddress`, `amountMicroAlgo`, `endpoint`, `timestamp`).

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of non-exempt API endpoints respond with HTTP 402 on missing payment header.
- **SC-002**: `KarmaService` accurately calculates score updates and persists events.
- **SC-003**: All vitest unit and integration tests pass with 0 errors.

---

## Assumptions

- Algorand Testnet/Mainnet node or indexer endpoints are available via environment configuration.
- Default price per request is configured via `X402_PRICE_MICROALGO` (default: 1,000 microALGO = 0.001 ALGO).
