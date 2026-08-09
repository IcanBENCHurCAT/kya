# Architectural Technical Plan — Phase 3: A2A Handshake, Groth16 ZK-KYC & Algorand Box Karma Anchoring

**Branch**: `feature/phase3-a2a-zkp-karma`  
**Package**: `kya-service`  
**Status**: Approved Architecture Specification  

---

## 1. Technical Component Overview

Phase 3 implements three core subsystem additions to `kya-service`:

1. **A2A Handshake Engine (`src/services/a2a.ts` & `src/routes/a2a.ts`)**:
   - Evaluates pre-flight risk for autonomous counterparty agents (Karma threshold verification, OFAC sanctions fuzzy check, risk flag aggregation).
   - Issues W3C Verifiable Credentials (JSON-LD format) signed with Ed25519 service keys.
   - Enforces x402 payment gate middleware.

2. **Groth16 ZK-KYC Proof Verifier (`src/services/zkp.ts` & `src/routes/zk-proof.ts`)**:
   - Accepts Groth16 zk-SNARK proof payloads (`pi_a`, `pi_b`, `pi_c`) and public signals.
   - Performs off-chain zero-knowledge verification using `snarkjs` / verification keys.
   - Upgrades agent verification tier upon success without persisting any PII or un-salted hashes (GDPR Art. 17 compliant).

3. **Algorand 77-Byte Box Storage Encoder & Anchoring (`src/algorand/box-layout.ts` & `src/services/karma.ts`)**:
   - Encodes/decodes static 77-byte binary layout for box key `k_{agent_address}`.
   - Maintains exact MBR cost of 0.0469 ALGO.
   - Emits ARC-28 standard event logs (`0x8c21f904`) for Conduit indexer synchronization.

---

## 2. Requirements & Constitution Compliance Matrix

| Requirement / Principle | Design Implementation |
| :--- | :--- |
| **Principle I (Standalone Service)** | Module defined in `kya-service` with no external `@algorbounty` dependencies. |
| **Principle II (x402 Payment Gate)** | Gated behind `x402` middleware, enforcing atomic 60/25/15 fee split. |
| **Principle III (Box Layout & MBR)** | 77-byte binary buffer encoding; full 0.0469 ALGO MBR refund on deletion. |
| **Principle IV (Module Independence)** | Self-contained domain modules under `src/services/` and `src/routes/`. |
| **Principle V (Test-First)** | `vitest` unit tests covering box binary encoding, proof verification, and A2A rules. |
| **Principle VI (Zero-Knowledge Privacy)** | Groth16 ZK proofs ensure no raw PII or un-salted PII hashes on-chain or DB. |

---

## 3. Execution Phases

### Phase 3.1: Data Models & Binary Layout
- Construct 77-byte static binary parser/serializer in `src/algorand/box-layout.ts`.

### Phase 3.2: Groth16 Verification Domain
- Implement ZK proof handler in `src/services/zkp.ts` and API endpoint `POST /api/v1/verify/zk-proof`.

### Phase 3.3: A2A Pre-Flight Protocol
- Build A2A evaluation and JSON-LD VC signer in `src/services/a2a.ts` and `POST /api/v1/a2a/handshake`.

### Phase 3.4: On-Chain Box Sync & Integration
- Integrate box layout serializer into Algorand client calls in `src/services/karma.ts`.
