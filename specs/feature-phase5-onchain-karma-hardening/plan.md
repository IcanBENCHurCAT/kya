# Implementation Plan: On-Chain Karma Hardening & Non-Custodial Trust Infrastructure (KYA v3.0)

**Branch**: `feature/phase5-onchain-karma-hardening` | **Date**: 2026-08-23 | **Spec**: [specs/feature-phase5-onchain-karma-hardening/spec.md](specs/feature-phase5-onchain-karma-hardening/spec.md)

**Input**: Feature specification from `specs/feature-phase5-onchain-karma-hardening/spec.md`

---

## Summary

KYA v3.0 delivers on-chain Karma software and smart contract architecture hardened against legal, game-theoretic, and investor-scale risks:
1. **Bilateral Non-Custodial Micro-Payments & Strict Fail-Closed Watchlist Reliability**: Bilateral SaaS bandwidth billing settling directly to node operator payout wallets without money transmission exposure; fail-closed `503 Service Unavailable` with zero mock fallback when upstream feeds degrade; probabilistic risk heuristic scoring with explicit non-reliance legal disclaimers.
2. **Composable Versioned 80-Byte Algorand Box Storage Layout v2**: Introduces schema versioning byte (`0x02`), unbonding challenge window tracking, MBR refundability (0.0481 ALGO), and synchronous atomic on-chain smart contract inspection.
3. **Anti-Whitewashing & Challenge-Locked Deregistration**: Sybil churn prevention via unbonding cooldown windows (7 days) and dispute locks preventing malicious agents from wiping bad scores and stealing back deposits.
4. **Anti-Proxying Cryptographic Verification & Volume-Decay Pricing**: Cryptographic signature validation (`algosdk.verifyBytes`) over request payloads to prevent high-karma agents from reselling fee discounts; volume-saturation decay curves.
5. **Multi-Source Behavioral Karma & Pluggable Oracle Ingestion**: Ingests weighted behavioral signals from native protocol milestones (ZK-KYC, dispute-free tenure) and authorized third-party oracles (compute, task escrows, prediction markets) with cryptographic origin checks.
6. **Decentralized Node Operator Infrastructure**: Permissionless 1-click container deployment with direct operator revenue capture (`KYA_TREASURY_ADDRESS`) and `/.well-known/agent-card.json` discovery.

---

## Technical Context

**Language/Version**: TypeScript (Node.js >= 18.0.0, target ES2022)  
**Primary Framework**: Hono (`@hono/node-server`), `algosdk` v2.7.0, `snarkjs`  
**Storage**: Algorand Box Storage (80-byte binary packing), Supabase PostgreSQL / In-Memory cache  
**Testing**: `vitest` (`npm test = vitest run`)  
**Target Platform**: Linux / Container (OCI Always Free A1.Flex / Bare Metal / LocalNet)  
**Project Type**: Autonomous Agent Identity & Compliance Gateway Web Service  
**Performance Goals**: $< 15\text{ms}$ atomic box inspect, $< 100\text{ms}$ screening response, 100% test coverage  
**Constraints**: Zero raw PII on-chain (GDPR Art. 17), zero mock fallback in production fail-closed mode, zero custodial fund routing  

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Compliance Details |
| :--- | :---: | :--- |
| **Principle I: Standalone Service** | ✅ PASS | Package is self-contained `kya-service` with zero `@algorbounty` imports. |
| **Principle II: x402 Payment Gate** | ✅ PASS | Non-negotiable micro-payment gate on all data routes; payments settle directly to operator treasury. |
| **Principle III: On-Chain Karma Ledger** | ✅ PASS | Versioned 80-byte binary layout on Algorand Box Storage (`k_{agent_address}`) with ARC-28 event emitters. |
| **Principle IV: Module Independence** | ✅ PASS | Self-contained domain layers (`screening`, `verification`, `karma`, `a2a`, `zkp`) interacting via shared types. |
| **Principle V: Test-First Development** | ✅ PASS | Vitest test suite (`npm test`) covering all functional and edge-case requirements. |
| **Principle VI: Mainnet-Ready & Privacy** | ✅ PASS | Groth16 ZK-SNARK nullifiers for privacy; strict fail-closed posture; no mock fallbacks in prod. |
| **Principle VII: Honest Documentation** | ✅ PASS | All documentation and ADRs strictly reflect verified executable code. |

---

## Project Structure

### Documentation (this feature)

```text
specs/feature-phase5-onchain-karma-hardening/
├── spec.md              # Feature specification
├── plan.md              # This implementation plan
├── research.md          # Phase 0 legal, game-theoretic, and box layout research
├── data-model.md        # Phase 1 80-byte box layout & TypeScript interfaces
├── quickstart.md        # Phase 1 node operator & agent quickstart
├── contracts/
│   └── api.md           # Phase 1 API endpoint contracts
└── tasks.md             # Phase 2 tasks (generated during speckit.tasks)
```

### Source Code

```text
src/
├── algorand/
│   ├── box-layout.ts          # 80-byte Box Layout v2 encoder/decoder, MBR helpers, ARC-28 constants
│   └── client.ts              # Algorand client with box read/write & event logging
├── middleware/
│   ├── x402.ts                # x402 payment verification & dynamic volume-decay discount calculator
│   └── anti-proxy.ts          # Cryptographic signature validation for agent request payloads
├── routes/
│   ├── agent-card.ts          # GET /.well-known/agent-card.json discovery
│   ├── screening.ts           # POST /api/v1/screening/evaluate with strict fail-closed logic
│   ├── karma.ts               # Oracle attestations, unbonding, and dispute management
│   └── a2a.ts                 # Pre-flight handshake with anti-proxy check & probabilistic VC
├── services/
│   ├── screening.ts           # Sanctions engine with fail-closed checks & probabilistic scoring
│   ├── karma.ts               # Multi-source karma calculation, anti-whitewashing cooldowns
│   ├── oracle-registry.ts     # Pluggable oracle validation and weighting engine
│   └── ofac.ts                # Watchlist loader with freshness validation
├── types/
│   ├── index.ts               # Shared domain types
│   ├── karma.ts               # Karma box v2, oracle attestation, and dispute interfaces
│   └── a2a.ts                 # Signed agent request and agent card interfaces
└── app.ts                     # App entry point mounting routes
__tests__/
├── box-layout.test.ts         # Box v2 layout 80-byte binary encode/decode unit tests
├── screening-fail-closed.test.ts # Strict fail-closed & probabilistic disclaimer tests
├── karma-hardening.test.ts    # Anti-whitewashing, unbonding, and multi-source oracle tests
├── anti-proxy.test.ts         # Anti-proxying signature & volume saturation tests
└── agent-card.test.ts         # Agent card discovery & node metadata tests
```

---

## Execution Phases & Components

### Phase 1: Algorand Box Layout v2 & ARC-28 Event Emitters
- Update `src/algorand/box-layout.ts` to support the 80-byte v2 binary layout (version byte `0x02`, `unbonding_until`, `owner_identity_nullifier`).
- Provide backwards compatibility for decoding legacy 77-byte v1 boxes.
- Add ARC-28 event constants for `UnbondingInitiated`, `UnbondingClaimed`, and `DisputeLogged`.

### Phase 2: Strict Fail-Closed Screening & Non-Reliance Legal Disclaimers
- Harden `src/services/screening.ts` and `src/services/ofac.ts` to reject queries if watchlists are stale (> 24h) or upstream fails in production mode.
- Embed probabilistic distance scoring and legal non-reliance disclaimers into evaluation responses and issued VCs.

### Phase 3: Anti-Whitewashing & Challenge-Locked Deregistration
- Implement unbonding state transitions in `src/services/karma.ts` and endpoints `POST /api/v1/karma/deregister` and `POST /api/v1/karma/claim-unbonded`.
- Lock unbonding attempts on active disputes or risk flags to prevent sybil whitewashing.

### Phase 4: Anti-Proxying & Dynamic Volume-Saturation Pricing
- Build `src/middleware/anti-proxy.ts` to verify `X-Agent-Signature` headers against the paying agent public key using `algosdk.verifyBytes`.
- Update `src/middleware/x402.ts` to calculate dynamic fee discounts with query volume-to-stake saturation curves.

### Phase 5: Multi-Source Behavioral Karma & Pluggable Oracle Ingestion
- Implement `src/services/oracle-registry.ts` and `POST /api/v1/karma/oracle-attest` to verify and aggregate multi-source reputation signals (ZK-KYC, compute, DEX escrow).

### Phase 6: Decentralized Node Operator Card & Discovery
- Implement `GET /.well-known/agent-card.json` exposing operator treasury, watchlist freshness, supported ARC-28 selectors, and gateway version.
- Validate end-to-end container launcher.

---

## Complexity Tracking

*No constitutional violations. All modules are cleanly decoupled, test-driven, and strictly comply with the KYA Constitution.*
