<!-- SYNC IMPACT REPORT
  Version: 1.1.0
  Date: 2026-08-07
  Action: CONSTITUTION CLEANUP & AMENDMENT
  Summary:
    - Streamlined formatting and improved readability
    - Removed redundant boilerplate text
    - Preserved all 7 non-negotiable core principles, x402 architecture, workflow rules, and governance
-->

# KYA Service (Know Your Agent) Constitution

## Core Principles

### I. Standalone Service
KYA MUST NOT be packaged, scoped, or coupled to any parent project. The npm package name MUST be `kya-service`. The `@algorbounty` namespace MUST NOT appear in `package.json`, import paths, or configuration files. No code MUST depend on `algo-bounty` or `@algorbounty/*`.

### II. x402 Payment Gate (NON-NEGOTIABLE)
Every API endpoint except `/health` and `/api/v1/x402/*` negotiation endpoints MUST be gated behind the x402 (HTTP 402 Payment Required) protocol. MicroALGO or ASA payments are required per request. Middleware MUST verify payments on-chain before forwarding to domain handlers. Payment receipts MUST be logged and auditable.

### III. On-Chain Karma System
Agent reputation (Karma) is the primary value proposition of KYA. Karma state MUST be anchored on Algorand. The system MUST support karma events (emit/debit/credit), agent balances, and queries. Supabase acts as an indexed read-cache for fast lookups.

### IV. Module Independence
Domains (`screening`, `verification`, `karma`, `wallet-analysis`) MUST be self-contained and independently testable. Modules interact strictly via shared TypeScript interfaces in `src/types/`. Removing one module MUST NOT break others.

### V. Test-First Development
All modules MUST use `vitest` as the single test runner (`npm test` = `vitest run`). Tests MUST pass before merging code. Production entry points MUST NEVER invoke test data seed functions.

### VI. Mainnet-Ready Code
Production code paths MUST NOT use stub or `console.log` fallbacks. Empty scaffold directories under `src/` are forbidden. Required environment variables MUST be validated at application startup.

### VII. Honest Documentation
Documentation (`README.md`, `HANDOFF.md`, architecture diagrams) MUST strictly reflect the actual state of the codebase. Features that are not implemented MUST NOT be documented as functional.

---

## x402 Payment Architecture

1. **Challenge**: Unauthenticated requests receive HTTP 402 with price, payment address, and offer TTL.
2. **Payment**: Client submits an Algorand payment transaction.
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

**Version**: 1.1.0 | **Ratified**: 2026-08-07 | **Last Amended**: 2026-08-07
