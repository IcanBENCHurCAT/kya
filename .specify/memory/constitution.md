<!-- SYNC IMPACT REPORT
  Version: 3.0.0
  Date: 2026-08-12
  Action: CONSTITUTION REFACTOR — POSITIVE-ASSERTION PRINCIPLES & GOVERNANCE ALIGNMENT
  Summary:
    - Refactored all principles from legacy negative constraints ("MUST NOT") to proactive, positive assertions ("SHALL / WILL").
    - Cleaned out legacy historical legacy references, focusing purely on KYA Service core identity.
    - Elevated x402 payment gate, on-chain Box Storage, A2A interoperability, ZK identity attestation privacy, and twin SDKs into clear affirmative capabilities.
-->

# KYA Service (Know Your Agent) Constitution

## Core Principles

### I. Independent Microservice Architecture
KYA is a standalone, self-contained microservice (`kya-service`). All package manifests, module exports, and configurations maintain complete structural independence, ensuring KYA operates as an autonomous protocol layer for any blockchain or agent ecosystem.

### II. On-Chain Micro-Payment Monetization (x402 Gate)
Every service endpoint (excluding `/health` and `/api/v1/x402/*` negotiation routes) is payment-gated via the HTTP 402 Payment Required (x402) protocol. Requests settle in microALGO or ASA (USDCa) tokens through a 100% service fee to operator; protocol-level revenue distribution deferred pending legal review. All transactions produce immutable, verifiable payment receipts.

### III. On-Chain Reputation & Optimized Box Storage
Agent reputation (Karma) is anchored immutably on the Algorand blockchain using packed 77-byte static binary Box Storage (`k_{agent_address}`). State updates emit ARC-28 standard event logs for real-time indexer synchronization, while guaranteeing full Minimum Balance Requirement (0.0469 ALGO MBR) refundability upon profile deregistration.

### IV. Modular Domain Autonomy & A2A Interoperability
Domain modules (`screening`, `verification`, `karma`, `wallet-analysis`, `a2a`) maintain decoupled business logic interacting exclusively through typed contracts in `src/types/` and machine-readable W3C Verifiable Credentials. Each module operates and tests independently.

### V. Test-Driven Development & Quality Assurance
Quality assurance relies on a single unified Vitest test suite (`npm test`). Every production code path, middleware, and service method maintains complete test coverage. Application startup paths evaluate runtime configurations without reliance on synthetic test data seeds.

### VI. Zero-Knowledge Privacy & Production Readiness
User and agent privacy is preserved by design. Identity assertions utilize off-chain ephemeral verification enclaves (purged within 72h) and Groth16 ZK-SNARK zero-knowledge proofs, achieving full GDPR Art. 17 compliance with zero on-chain PII exposure. Production entry points enforce strict configuration validation.

### VII. Architectural Transparency & Documentation Integrity
Project documentation (`README.md`, `HANDOFF.md`, `docs/ARCHITECTURE.md`) reflects active, verified source code. System capabilities, visual diagrams, and API contracts remain synchronized with production builds.

### VIII. Multi-Language SDK Ecosystem
KYA maintains twin client libraries to support agent frameworks (ElizaOS, OpenClaw, AutoGen, LangChain, `algo-bounty`):
- `sdk/`: Native TypeScript client (`kya-sdk`)
- `python-sdk/`: Native Python client (`kya-client`) with Pytest suite
Both SDKs provide seamless x402 payment handling, A2A pre-flight risk evaluation, ZK identity attestation proof submission, and Karma profile management.

### IX. Infrastructure Security & Automated Secret Protection
Infrastructure deployment leverages modular Terraform patterns. Sensitive environment files (`*.tfstate`, `*.tfvars`, `.env.deploy`) are strictly excluded via `.gitignore`. An automated pre-commit secret scanner (`.githooks/pre-commit`) validates staged commits to prevent credential exposure.

### X. Evidence-Based Positioning
KYA provides independently verifiable evidence and risk signals. KYA does not make compliance determinations, certify regulatory status, or serve as a regulated identity provider. Screening results indicate data matches, not legal conclusions.

---

## Technical Specifications & Control Flow

1. **x402 Negotiation**: Unauthenticated clients receive HTTP 402 challenges detailing price, receiver address, and offer TTL.
2. **On-Chain Verification**: Middleware verifies transaction round, payment receiver, amount, and replay protection via Algorand indexer before delegating execution to domain routes.
3. **A2A Pre-Flight Risk Evaluation**: Autonomous agents execute pre-flight counterparty evaluation (`POST /api/v1/a2a/handshake`), receiving Ed25519-signed W3C Verifiable Credential risk evaluation credentials.

---

## Governance & Quality Gates

- **Quality Gate**: Every commit and pull request must pass `npm run typecheck`, `npm run build`, and `npm test`.
- **Pre-Commit Gate**: `.githooks/pre-commit` secret scanner must pass cleanly before commits are created.
- **Priority**: Principle II (x402 Monetization) is non-negotiable. Numerically lower principles guide design precedence in architectural decisions.

**Version**: 3.0.0 | **Ratified**: 2026-08-07 | **Last Amended**: 2026-08-12
