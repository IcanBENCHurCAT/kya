<!-- SYNC IMPACT REPORT
  Version: 1.2.0
  Date: 2026-08-08
  Action: CONSTITUTION AMENDMENT & END-STATE VISION ALIGNMENT
  Summary:
    - Expanded Principle II (x402 Payment Gate) to mandate atomic revenue waterfall (60/25/15) and dynamic pricing.
    - Expanded Principle III (On-Chain Karma) to specify Algorand 77-byte static binary Box Storage layouts, ARC-28 event standards, and refund MBR mechanics.
    - Added Zero-Knowledge (ZK) identity assertion mandate (GDPR compliance; zero raw PII on-chain).
    - Added Agent-to-Agent (A2A) pre-flight trust handshake mandate (W3C Verifiable Credentials & framework middleware SDKs).
-->

# KYA Service (Know Your Agent) Constitution

## Core Principles

### I. Standalone Service
KYA MUST NOT be packaged, scoped, or coupled to any parent project. The npm package name MUST be `kya-service`. The `@algorbounty` namespace MUST NOT appear in `package.json`, import paths, or configuration files. No code MUST depend on `algo-bounty` or `@algorbounty/*`.

### II. x402 Payment Gate (NON-NEGOTIABLE)
Every API endpoint except `/health` and `/api/v1/x402/*` negotiation endpoints MUST be gated behind the x402 (HTTP 402 Payment Required) protocol. MicroALGO or ASA (USDCa) payments are required per request. Middleware MUST verify payments on-chain before forwarding to domain handlers. Payments MUST settle via an atomic 60/25/15 revenue split (60% Node Operators, 25% Staking Pool, 15% Treasury). Payment receipts MUST be logged and auditable.

### III. On-Chain Karma System & Box Storage Layout
Agent reputation (Karma) is the primary value proposition of KYA. Karma state MUST be anchored on Algorand using packed 77-byte static binary Box Storage (`k_{agent_address}`) to optimize Minimum Balance Requirements (MBR = 0.0469 ALGO). Full MBR MUST be refunded upon deregistration. The system MUST emit ARC-28 standard event logs for Conduit indexing into Supabase read-caches.

### IV. Module Independence & A2A Interoperability
Domains (`screening`, `verification`, `karma`, `wallet-analysis`, `a2a`) MUST be self-contained and independently testable. Modules interact strictly via shared TypeScript interfaces in `src/types/` and W3C Verifiable Credentials. Removing one module MUST NOT break others.

### V. Test-First Development
All modules MUST use `vitest` as the single test runner (`npm test` = `vitest run`). Tests MUST pass before merging code. Production entry points MUST NEVER invoke test data seed functions.

### VI. Mainnet-Ready & Privacy-Preserving (Zero-Knowledge KYC)
Production code paths MUST NOT use stub or `console.log` fallbacks. Empty scaffold directories under `src/` are forbidden. Required environment variables MUST be validated at application startup. Raw PII or un-salted identity hashes MUST NOT be written to the blockchain; identity verification MUST use off-chain ephemeral enclaves (purged within 72h) and Groth16 ZK-SNARK proofs to maintain full GDPR compliance.

### VII. Honest Documentation
Documentation (`README.md`, `HANDOFF.md`, `docs/ARCHITECTURE.md`, architecture diagrams) MUST strictly reflect the actual state of the codebase. Features that are not implemented MUST NOT be documented as functional.

---

## x402 Payment Architecture

1. **Challenge**: Unauthenticated requests receive HTTP 402 with price, payment address, and offer TTL.
2. **Payment**: Client submits an Algorand payment transaction (microALGO or USDCa).
3. **Verification**: Client retries with transaction ID in `X-Payment` header. x402 middleware verifies round, amount, receiver, and replay protection via Algorand indexer.
4. **Fulfillment**: Validated requests pass to domain handlers; an immutable receipt is recorded.

---

## Development Workflow & Quality Gates

- **Test Gate**: All tests MUST pass via `vitest run`.
- **Clean Structure**: Scaffold directories without active code MUST be deleted immediately.
- **Strict Scoping**: All features MUST be covered by unit/integration tests before PR approval.

---

## Governance

- This constitution is the authoritative source of truth for all development.
- **Priority**: Principle II (x402) is non-negotiable. Lower-numbered principles take precedence in conflicts.
- **Amendments**: Require user approval, semver bump, and updated `Last Amended` timestamp.

**Version**: 1.2.0 | **Ratified**: 2026-08-07 | **Last Amended**: 2026-08-08
