# AGENTS.md — KYA Service Agent Guidance & Operational Rules

Welcome AI Agent. This document defines the operating rules, technical standards, and governance obligations for working on the **KYA (Know Your Agent)** codebase.

---

## 🏛️ 1. Governing Principles

All agents working on this project MUST comply strictly with the **KYA Constitution** ([`.specify/memory/constitution.md`](.specify/memory/constitution.md), v3.0.0):

1. **Principle I: Standalone Service**: KYA is a standalone application (`kya-service`). Do NOT use `@algorbounty` scope or import from `algo-bounty`.
2. **Principle II: x402 Payment Gate (NON-NEGOTIABLE)**: All endpoints (except `/health` and x402 negotiation) MUST be payment-gated behind microALGO / ASA micro-payments.
3. **Principle III: On-Chain Karma Ledger**: Karma state MUST be anchored on Algorand Box Storage (`k_{agent_address}`, 77-byte static payload) with 0.0469 ALGO MBR refundability and ARC-28 event emitters.
4. **Principle IV: Module Independence**: Each domain (`screening`, `verification`, `karma`, `wallet-analysis`, `a2a`) MUST remain self-contained and interact only through `src/types/` or W3C Verifiable Credentials.
5. **Principle V: Test-First Development**: All tests MUST use `vitest` (`npm test` = `vitest run`). Never invoke `seedTestData()` in production entry points.
6. **Principle VI: Mainnet-Ready & Privacy-Preserving**: No console.log or stub fallbacks in production. Raw PII or un-salted hashes MUST NOT be written to the blockchain; use off-chain enclaves (purged within 72h) and Groth16 ZK-SNARK proofs for zero-knowledge identity attestation (GDPR Art. 17).
7. **Principle VII: Honest Documentation**: Documentation (`README.md`, `HANDOFF.md`, `docs/ARCHITECTURE.md`) MUST strictly reflect actual source code.

---

## 🛠️ 2. Development Workflow

- **Branch Naming**: All feature work MUST occur on feature branches named `feature/<feature-name>` (e.g., `feature/phase2-x402-karma`).
- **Default Branch**: The default repository branch is **`main`**. Do NOT target `master`.
- **Quality Gates**: Every pull request / commit MUST pass:
  ```bash
  npm run build   # tsc clean compilation
  npm test        # vitest suite (all tests passing)
  ```
- **Directory Discipline**: Do NOT create empty scaffold directories under `src/`. If a directory exists, it MUST contain active code.

---

## 📚 3. Reference Documentation

- [Constitution](.specify/memory/constitution.md) — Governing principles and rules.
- [End-State Architecture Specification](docs/ARCHITECTURE.md) — Full technical architecture, Box Storage layouts, ARC-28 events, and A2A handshake sequence flows.
- [README.md](README.md) — Setup instructions and endpoint summary.
- [HANDOFF.md](HANDOFF.md) — Handoff tracking and current progress.
