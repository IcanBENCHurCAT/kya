# Implementation Plan: Phase 2 — x402 Payment Gate & Karma Ledger API

**Branch**: `feature/phase2-x402-karma` | **Date**: 2026-08-08 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/feature-phase2-x402-karma/spec.md`

## Summary

Implement an x402 Payment Gate middleware to require microALGO or ASA payments for API access. Establish the On-Chain Karma Ledger API to record agent reputation events on Algorand Box Storage and synchronize them to a Supabase cache.

## Technical Context

**Language/Version**: TypeScript 5.4.0 (Node.js 26+)

**Primary Dependencies**: Hono (API), Algosdk (Algorand interactions), Supabase (Caching DB), Vitest (Testing)

**Storage**: Algorand (Box Storage), Supabase (PostgreSQL `agent_profiles`, `karma_events`, `karma_balances`, `x402_receipts`)

**Testing**: vitest

**Target Platform**: Linux server (Dockerized), Node.js environment

**Project Type**: Web Service (API)

**Performance Goals**: Low latency payment verification (<500ms indexer queries)

**Constraints**: MBR strict compliance (0.0469 ALGO for Box), 77-byte static binary Box payload, fallback to InMemory store if Supabase down.

**Scale/Scope**: Agent to Agent high-throughput API.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principle I (Standalone)**: No `@algorbounty` dependencies. PASS.
- **Principle II (x402)**: Implemented as core middleware. PASS.
- **Principle III (Karma)**: Using 77-byte static binary Box Storage (`k_{agent_address}`) and ARC-28 events. PASS.
- **Principle IV (Module Independence)**: Karma and x402 are separate modules interacting via `src/types/`. PASS.
- **Principle V (Test-First)**: `vitest run` will be used for all. PASS.
- **Principle VI (Privacy)**: No raw PII on-chain. ZK proofs not directly in scope of this karma/x402 phase, but no PII will be stored. PASS.
- **Principle VII (Honest Documentation)**: Docs will be updated. PASS.

## Project Structure

### Documentation (this feature)

```text
specs/feature-phase2-x402-karma/
├── plan.md              # This file
├── research.md          
├── data-model.md        
├── quickstart.md        
└── contracts/           
    └── api.md
```

### Source Code (repository root)

```text
src/
├── index.ts                 # Main entrypoint
├── types/
│   ├── karma.ts             # Karma shared interfaces
│   └── x402.ts              # x402 shared interfaces
├── middleware/
│   └── x402.ts              # Payment gate middleware
├── routes/
│   ├── karma.ts             # Karma endpoints
│   └── x402.ts              # Payment negotiation endpoints
├── services/
│   ├── algorand.service.ts  # Algorand node/indexer wrapper
│   ├── karma.service.ts     # Karma core logic
│   └── store/
│       ├── supabase.store.ts
│       └── in-memory.store.ts
└── db/
    └── migrations/
        └── 002_karma_ledger.sql
```

**Structure Decision**: Standard web service modular structure, segregating routes, middleware, and services to maintain Principle IV independence.

## Complexity Tracking

None required; no Constitution violations.
