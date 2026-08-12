<!-- SYNC IMPACT REPORT
  Version: 1.3.0
  Date: 2026-08-12
  Action: CONSTITUTION AMENDMENT — SECURITY, SDK & INFRASTRUCTURE MANDATES
  Summary:
    - Added Principle VIII (Client SDK Maintenance): Mandates twin TypeScript (`kya-sdk`) and Python (`kya-client`) SDK clients kept in sync with REST API.
    - Added Principle IX (Infrastructure & Secret Sentinel): Mandates automated pre-commit secret scanning hooks and Terraform infrastructure patterns (OCI/Cloud) with strict .gitignore of sensitive credentials (*.tfvars, *.tfstate).
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

### VIII. Dual Client SDK Maintenance (TypeScript & Python)
To enable seamless integration into multi-language agent ecosystems (`algo-bounty`, ElizaOS, AutoGen, LangChain), KYA MUST maintain twin client SDK libraries:
- `sdk/`: TypeScript client (`kya-sdk`)
- `python-sdk/`: Python client (`kya-client`) with Pytest suite
Both SDKs MUST support x402 payment header injection, A2A handshakes, ZK-KYC proof submission, and Karma querying.

### IX. Infrastructure Security & Pre-Commit Secret Sentinel
All infrastructure provisioning MUST follow modular Terraform patterns. Sensitive files (`*.tfstate`, `*.tfvars`, `.env.deploy`) MUST be strictly ignored in `.gitignore`. A `.githooks/pre-commit` secret scanner MUST run before every commit to block hardcoded API keys, JWTs, and database credentials.

---

## x402 Payment Architecture

1. **Challenge**: Unauthenticated requests receive HTTP 402 with price, payment address, and offer TTL.
2. **Payment**: Client submits an Algorand payment transaction (microALGO or USDCa).
3. **Verification**: Client retries with transaction ID in `X-Payment` header. x402 middleware verifies round, amount, receiver, and replay protection via Algorand indexer.
4. **Fulfillment**: Validated requests pass to domain handlers; an immutable receipt is recorded.

---

## Development Workflow & Quality Gates

- **Test Gate**: All tests MUST pass via `vitest run`.
- **Pre-Commit Gate**: `.githooks/pre-commit` MUST pass cleanly to prevent credential leaks.
- **Clean Structure**: Scaffold directories without active code MUST be deleted immediately.
- **Strict Scoping**: All features MUST be covered by unit/integration tests before PR approval.

---

## Governance

- This constitution is the authoritative source of truth for all development.
- **Priority**: Principle II (x402) is non-negotiable. Lower-numbered principles take precedence in conflicts.
- **Amendments**: Require user approval, semver bump, and updated `Last Amended` timestamp.

**Version**: 1.3.0 | **Ratified**: 2026-08-07 | **Last Amended**: 2026-08-12
