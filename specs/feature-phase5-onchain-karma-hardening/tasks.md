# Tasks: On-Chain Karma Hardening & Non-Custodial Trust Infrastructure (KYA v3.0)

**Input**: Design documents from `specs/feature-phase5-onchain-karma-hardening/` (`spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/api.md`, `quickstart.md`)  
**Prerequisites**: `plan.md` (complete), `spec.md` (complete)

---

## Phase 1: Setup & Shared Infrastructure

**Purpose**: Shared types, configuration, and testing fixtures for Phase 5.

- [ ] T001 [P] Create Phase 5 TypeScript domain types in `src/types/karma.ts` and `src/types/a2a.ts` (Box v2 layout, Oracle attestation payload, Anti-proxy envelope, Agent card).
- [ ] T002 [P] Export new types in `src/types/index.ts`.
- [ ] T003 [P] Setup test mocks and fixtures for fail-closed feeds, box layouts, and oracles in `__tests__/fixtures/`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core binary layout and cryptographic foundations required across all user stories.

**⚠️ CRITICAL**: Must be completed before higher-level user stories.

- [ ] T004 Implement 80-byte Algorand Box Layout v2 binary serializer and deserializer with version header (`0x02`), `unbonding_until`, and `owner_identity_nullifier` in `src/algorand/box-layout.ts`.
- [ ] T005 Implement backwards compatibility in `src/algorand/box-layout.ts` for decoding legacy 77-byte v1 boxes.
- [ ] T006 Define ARC-28 event constants (`UnbondingInitiated`, `UnbondingClaimed`, `DisputeLogged`, `RiskFlagged`, `KarmaUpdated`, `X402PaymentSettled`) in `src/algorand/box-layout.ts`.
- [ ] T007 [P] Write unit tests in `__tests__/box-layout.test.ts` verifying 80-byte encoding/decoding, backwards compatibility, and MBR calculations ($0.0481 \text{ ALGO}$).

**Checkpoint**: Foundation ready — Box Layout v2 serializer and ARC-28 constants tested and passing.

---

## Phase 3: User Story 1 - Bilateral Point-of-Sale Screening with Strict Fail-Closed Watchlist Reliability (Priority: P1) 🎯 MVP

**Goal**: Bilateral direct micro-payment billing for screening without custodial fund routing; strict fail-closed rejection (`503 Service Unavailable`) on stale or unreachable watchlists; probabilistic confidence metrics and non-reliance legal disclaimers.

**Independent Test**: Query screening with simulated feed failure (assert 503 fail-closed with zero mock data) and with valid live feed (assert probabilistic confidence vectors and disclaimer).

### Tests for User Story 1
- [ ] T008 [P] [US1] Write test in `__tests__/screening-fail-closed.test.ts` verifying 503 rejection on stale watchlist (> 24h) and network failure under `KYA_FAIL_CLOSED=true`.
- [ ] T009 [P] [US1] Write test in `__tests__/screening-fail-closed.test.ts` verifying probabilistic risk scores, match vectors, and legal disclaimers in evaluation response.

### Implementation for User Story 1
- [ ] T010 [US1] Update `src/services/ofac.ts` to implement `isWatchlistFresh()` (24h freshness window) and disable mock fallbacks when `KYA_FAIL_CLOSED=true` or in production.
- [ ] T011 [US1] Update `src/services/screening.ts` to enforce fail-closed check and generate probabilistic similarity scoring alongside match vectors.
- [ ] T012 [US1] Update `src/routes/screening.ts` to format `POST /api/v1/screening/evaluate` responses with legal non-reliance disclaimers.
- [ ] T013 [US1] Embed non-reliance algorithmic disclaimers in W3C Verifiable Credentials issued by `src/services/a2a.ts`.

**Checkpoint**: User Story 1 complete and independently verified.

---

## Phase 4: User Story 2 - Composable On-Chain Reputation Verification with Versioned Box Storage (Priority: P2)

**Goal**: External smart contracts can synchronously inspect an agent's reputation state (karma score, ver tier, risk flags, unbonding state) in an atomic transaction group.

**Independent Test**: Simulate smart contract `app_box_extract` calls against the 80-byte box state to verify sub-millisecond atomic inspection and ARC-28 log emission.

### Tests for User Story 2
- [ ] T014 [P] [US2] Write test in `__tests__/karma.test.ts` verifying synchronous extraction of karma score, risk flags, and verification tier from 80-byte box state.

### Implementation for User Story 2
- [ ] T015 [US2] Update `src/algorand/client.ts` to read and write 80-byte Box Layout v2 instances.
- [ ] T016 [US2] Emit standard ARC-28 event logs (`KarmaUpdated`, `RiskFlagged`) during box updates in `src/services/karma.ts`.

**Checkpoint**: User Story 2 complete and verified.

---

## Phase 5: User Story 3 - Anti-Whitewashing & Challenge-Locked Registration Reclamation (Priority: P3)

**Goal**: Prevent malicious agents from wiping bad scores by deleting and recreating identities. Enforce 7-day unbonding cooldown windows and dispute locks before deposit refunds.

**Independent Test**: Flag an agent profile, initiate deregistration, and assert deposit is challenge-locked; test unflagged agent completing cooldown and receiving MBR refund upon box deletion.

### Tests for User Story 3
- [ ] T017 [P] [US3] Write tests in `__tests__/karma-hardening.test.ts` for unbonding initiation, dispute locking on active risk flags, and successful `claim-unbonded` after cooldown.

### Implementation for User Story 3
- [ ] T018 [US3] Implement `initiateUnbonding(agentAddress)` in `src/services/karma.ts` setting `unbonding_until = now() + 604800`.
- [ ] T019 [US3] Implement `claimUnbonded(agentAddress)` in `src/services/karma.ts` verifying time completion and executing box deletion with MBR refund.
- [ ] T020 [US3] Implement `disputeAgent(agentAddress, challenger, reasonHash)` in `src/services/karma.ts` locking `unbonding_until` to maximum.
- [ ] T021 [US3] Expose routes `POST /api/v1/karma/deregister`, `POST /api/v1/karma/claim-unbonded`, and `POST /api/v1/karma/dispute` in `src/routes/karma.ts`.

**Checkpoint**: User Story 3 complete and verified.

---

## Phase 6: User Story 4 - Rate-Bounded Dynamic Price Discovery & Anti-Proxying Verification (Priority: P4)

**Goal**: Cryptographically bind reputation discounts to the agent's signing key (`X-Agent-Signature`) and apply volume-decay factors to eliminate fee-resale arbitrage.

**Independent Test**: Submit requests with mismatched keys (assert rejection) and submit high query bursts (assert graceful decay of discount to base fee).

### Tests for User Story 4
- [ ] T022 [P] [US4] Write unit tests in `__tests__/anti-proxy.test.ts` for Ed25519 request signature verification, nonce replay prevention, and 60s timestamp drift checks.
- [ ] T023 [P] [US4] Write unit tests in `__tests__/anti-proxy.test.ts` for dynamic query-to-stake volume-saturation fee decay.

### Implementation for User Story 4
- [ ] T024 [US4] Create `src/middleware/anti-proxy.ts` validating `X-Agent-Signature`, `X-Agent-Address`, `X-Agent-Timestamp`, and `X-Agent-Nonce` using `algosdk.verifyBytes`.
- [ ] T025 [US4] Update `src/middleware/x402.ts` to compute dynamic fee discounts with volume-saturation decay.
- [ ] T026 [US4] Apply anti-proxy middleware to `src/routes/a2a.ts` and `src/routes/screening.ts`.

**Checkpoint**: User Story 4 complete and verified.

---

## Phase 7: User Story 5 - Multi-Source Behavioral Karma & Pluggable Oracle Ingestion (Priority: P2)

**Goal**: Ingest weighted behavioral signals from native protocol milestones (ZK-KYC, dispute-free tenure) and authorized third-party oracles (compute, task escrows, prediction markets) with cryptographic origin checks.

**Independent Test**: Submit signed oracle events from registered and unregistered oracles; verify calibrated delta weighting and composite karma aggregation.

### Tests for User Story 5
- [ ] T027 [P] [US5] Write unit tests in `__tests__/oracle-karma.test.ts` verifying oracle signature validation, source domain weighting, and replay prevention.

### Implementation for User Story 5
- [ ] T028 [US5] Create `src/services/oracle-registry.ts` with domain source weights (ZK: 0.35, Tenure: 0.20, Compute: 0.15, DEX: 0.20) and signature validator.
- [ ] T029 [US5] Implement `processOracleAttestation()` in `src/services/karma.ts` updating agent reputation box and emitting `ARC28_EVENTS.KarmaUpdated`.
- [ ] T030 [US5] Expose endpoint `POST /api/v1/karma/oracle-attest` in `src/routes/karma.ts`.

**Checkpoint**: User Story 5 complete and verified.

---

## Phase 8: User Story 6 - Self-Hosted Node Operator Deployment & Decentralized Gateway Rewards (Priority: P2)

**Goal**: Enable community operators to launch open-source gateway nodes with 1-click Docker deployment, capturing 100% of x402 query fees to `KYA_TREASURY_ADDRESS`, discoverable via `/.well-known/agent-card.json`.

**Independent Test**: Boot gateway with custom `KYA_TREASURY_ADDRESS`; query `/.well-known/agent-card.json`; assert treasury address, watchlist freshness, and ARC-28 event metadata.

### Tests for User Story 6
- [ ] T031 [P] [US6] Write unit test in `__tests__/agent-card.test.ts` asserting `GET /.well-known/agent-card.json` schema and accuracy.

### Implementation for User Story 6
- [ ] T032 [US6] Implement `src/routes/agent-card.ts` serving `GET /.well-known/agent-card.json`.
- [ ] T033 [US6] Mount agent card route in `src/app.ts`.
- [ ] T034 [US6] Update `Dockerfile` and `.env.example` with `KYA_TREASURY_ADDRESS`, `KYA_FAIL_CLOSED`, and container defaults.

**Checkpoint**: User Story 6 complete and verified.

---

## Phase 9: Polish, Quality Gates & Verification

**Purpose**: End-to-end integration, performance checks, and documentation synchronization.

- [ ] T035 [P] Run full vitest test suite (`npm test`) and ensure 100% test pass rate across all new and existing test files.
- [ ] T036 [P] Run `npm run build` to verify clean TypeScript compilation with zero errors or warnings.
- [ ] T037 [P] Update `README.md` and `HANDOFF.md` reflecting KYA v3.0 architecture, Box Layout v2, and node deployment guides.
- [ ] T038 Validate quickstart instructions from `specs/feature-phase5-onchain-karma-hardening/quickstart.md`.
