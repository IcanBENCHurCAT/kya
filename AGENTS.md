# AGENTS.md — KYA Service Agent Guidance & Operational Rules

Welcome AI Agent. This document defines the operating rules, technical standards, and governance obligations for working on the **KYA (Know Your Agent)** codebase.

---

## 🏛️ 1. Governing Principles

All agents working on this project MUST comply strictly with the **KYA Constitution** ([`.specify/memory/constitution.md`](.specify/memory/constitution.md), v3.0.0):

1. **Principle I: Standalone Service**: KYA is an independent microservice (`kya-service`). All modules and SDKs maintain structural autonomy.
2. **Principle II: x402 Payment Gate (NON-NEGOTIABLE)**: All endpoints (except `/health`, `/api/v1/health`, and `/.well-known/x402*` discovery routes) MUST be payment-gated via HTTP 402 micro-payments in microALGO or ASA (USDCa).
3. **Principle III: On-Chain Karma Ledger**: Karma state MUST be anchored on Algorand Box Storage (`k_{agent_address}`, 77-byte static payload) with 0.0469 ALGO MBR refundability and ARC-28 event emitters.
4. **Principle IV: Module Independence & A2A Interoperability**: Each domain (`screening`, `verification`, `karma`, `wallet-analysis`, `a2a`) MUST remain self-contained and interact only through `src/types/` or W3C Verifiable Credentials.
5. **Principle V: Test-First Development**: Quality assurance relies on Vitest (`npm test`). Production entry points MUST NOT use synthetic seed fallbacks.
6. **Principle VI: Zero-Knowledge Privacy & Production Readiness**: Zero on-chain PII (GDPR Art. 17). Off-chain ephemeral verification enclaves (purged within 72h) and Groth16 ZK-SNARK proofs are used for identity attestations.
7. **Principle VII: Architectural Transparency & Documentation Integrity**: Documentation (`README.md`, `HANDOFF.md`, `DEPLOY.md`, `docs/ARCHITECTURE.md`) MUST strictly reflect active source code.
8. **Principle VIII: Multi-Language SDK Ecosystem**: Maintain synchronized client libraries (`sdk/` TypeScript SDK and `python-sdk/` Python SDK).
9. **Principle IX: Infrastructure Security & Automated Secret Protection**: Modular Terraform patterns, gitignored credentials, and pre-commit hook validation.
10. **Principle X: Evidence-Based Positioning**: KYA provides verifiable risk signals and evidence; it does not render legal determinations.

---

## 🛠️ 2. Development Workflow

- **Branch Naming**: Feature work SHOULD occur on feature branches named `feature/<feature-name>` (e.g., `feature/phase3-a2a-zkp-karma`).
- **Default Branch**: The default repository branch is **`main`**.
- **Quality Gates**: Every pull request / commit MUST pass:
  ```bash
  npm run typecheck # tsc --noEmit check
  npm run build     # tsc clean compilation
  npm test          # vitest test suite (all 165 tests passing across 12 files)
  ```
- **Directory Discipline**: Do NOT create empty scaffold directories under `src/`. If a directory exists, it MUST contain active source code.

---

## 📚 3. Reference Documentation

- [Constitution](.specify/memory/constitution.md) — Governing principles and rules (v3.0.0).
- [End-State Architecture Specification](docs/ARCHITECTURE.md) — Technical architecture, Box Storage layout, ARC-28 events, and A2A sequence flows.
- [README.md](README.md) — System overview, setup, and full API route specification.
- [HANDOFF.md](HANDOFF.md) — Project completion status and operational guidance.
- [DEPLOY.md](DEPLOY.md) — Deployment instructions and OCI infrastructure guide.
