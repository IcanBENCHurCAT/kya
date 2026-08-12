# Phase 3 — A2A Handshake, Groth16 ZK-KYC & Algorand Box Storage Task List

**Feature Branch**: `feature/phase3-a2a-zkp-karma`  
**Specification**: [spec.md](file:///c:/Users/Garret/.gemini/antigravity/scratch/kya-service/specs/feature-phase3-a2a-zkp-karma/spec.md)  
**Architecture Spec**: [ARCHITECTURE.md](file:///c:/Users/Garret/.gemini/antigravity/scratch/kya-service/docs/ARCHITECTURE.md)  
**Constitution**: [constitution.md](file:///c:/Users/Garret/.gemini/antigravity/scratch/kya-service/.specify/memory/constitution.md)

---

## Phase 1: Algorand 77-Byte Box Storage Encoder & Serializer (`src/algorand/box-layout.ts`)

- [ ] Task 1.1: Define `OnChainKarmaBox` Interface & Binary Offsets [File: `src/algorand/box-layout.ts`]
  - Define `OnChainKarmaBox` TypeScript interface matching the static 77-byte layout: `karma_score` (uint64, offset 0), `stake_amount` (uint64, offset 8), `risk_flags` (uint32, offset 16), `ver_level` (uint8, offset 20), `registered_at` (uint64, offset 21), `last_updated` (uint64, offset 29), `owner_identity_hash` (bytes32, offset 37), `total_queries_paid` (uint64, offset 69).
  - Define constants for box key formatting (`k_{agent_address}`), total box size (77 bytes), box key size (34 bytes), and MBR calculation constants (0.0469 ALGO = 46,900 microALGO).
  - Define ARC-28 event selector constants: `AgentRegistered` (`0x4a7e9b12`), `KarmaUpdated` (`0x8c21f904`), `RiskFlagged` (`0x1f94d03e`), `X402PaymentSettled` (`0x3d6a89c1`).

- [ ] Task 1.2: Implement `encodeKarmaBox` & `decodeKarmaBox` Binary Serializer Functions [File: `src/algorand/box-layout.ts`]
  - Implement `encodeKarmaBox(box: OnChainKarmaBox): Uint8Array`: Encodes box fields into a 77-byte `Buffer` / `Uint8Array` using big-endian integer writing (`writeBigUInt64BE`, `writeUInt32BE`, `writeUInt8`).
  - Implement `decodeKarmaBox(buffer: Uint8Array): OnChainKarmaBox`: Decodes a 77-byte binary buffer back into an `OnChainKarmaBox` object with exact byte length checks.
  - Implement helper utility `getKarmaBoxKey(agentAddress: string): Uint8Array` to generate the 34-byte box key (`k_` + 32-byte public key).

---

## Phase 2: Groth16 ZK-KYC Verifier Service (`src/services/zkp.ts`)

- [ ] Task 2.1: Define ZK Proof Data Models & Verification Interfaces [File: `src/services/zkp.ts`]
  - Define `ZKProofPayload` (`agentAddress`, `proof` containing `pi_a`, `pi_b`, `pi_c`, `publicSignals`, `claimType`).
  - Define `ZKVerificationResult` (`valid`, `verificationLevel`, `agentAddress`, `timestamp`, `error`).

- [ ] Task 2.2: Implement `ZKPVerifierService` Class [File: `src/services/zkp.ts`]
  - Implement `verifyProof(payload: ZKProofPayload): Promise<ZKVerificationResult>`: Verifies Groth16 zk-SNARK proof payloads against verification keys without persisting PII or un-salted hashes (GDPR Art. 17 compliant).
  - Integrate verification outcome with `KarmaService` to automatically upgrade target agent verification level (`ver_level`) upon successful evaluation.
  - Enforce strict input validation rejecting malformed proof points or missing public signals.

---

## Phase 3: A2A Pre-Flight Handshake Service & W3C VC Engine (`src/services/a2a.ts`)

- [ ] Task 3.1: Define A2A Pre-Flight & W3C Verifiable Credential Schemas [File: `src/services/a2a.ts`]
  - Define `A2AHandshakeRequest` (`initiatorAddress`, `targetAddress`, `requiredVerificationLevel`, `minKarmaScore`).
  - Define `A2AHandshakeResponse` (`decision: "PROCEED" | "REJECT" | "REVIEW"`, `targetProfile`, `verifiableCredential`, `signature`, `timestamp`, `riskSummary`).
  - Define W3C Verifiable Credential JSON-LD schema containing `@context`, `type`, `issuer`, `issuanceDate`, `credentialSubject` (agent address, Karma score, verification tier, sanctions status).

- [ ] Task 3.2: Implement `A2AService` Handshake Evaluator & Signer [File: `src/services/a2a.ts`]
  - Implement `executeHandshake(request: A2AHandshakeRequest): Promise<A2AHandshakeResponse>`:
    - Retrieve target agent profile, Karma score, and OFAC sanctions status from `KarmaService` and screening module.
    - Evaluate compliance rules: check if Target Karma $\ge$ `minKarmaScore` (default 600) and sanctions status == `PASS`.
    - If criteria are met, issue decision `PROCEED`, construct W3C VC JSON-LD passport, and sign VC payload using Ed25519 service key.
    - If criteria fail (Karma $< 600$ or FLAGGED/FAIL sanctions), trip circuit breaker with decision `REJECT` and return detailed risk breakdown.

---

## Phase 4: HTTP Routes Integration (`src/routes/zk-proof.ts`, `src/routes/a2a.ts`, `src/app.ts`)

- [ ] Task 4.1: Implement Groth16 ZK-KYC REST Route [File: `src/routes/zk-proof.ts`]
  - Implement `POST /api/v1/verify/zk-proof` accepting `ZKProofPayload`.
  - Pass payload to `ZKPVerifierService`, process result, upgrade agent profile in `KarmaService`, and return HTTP 200 with `ZKVerificationResult` (or HTTP 400 for invalid proofs).

- [ ] Task 4.2: Implement A2A Pre-Flight Handshake REST Route [File: `src/routes/a2a.ts`]
  - Implement `POST /api/v1/a2a/handshake` accepting `A2AHandshakeRequest`.
  - Pass request to `A2AService`, process pre-flight policy evaluation, and return HTTP 200 with `A2AHandshakeResponse` (W3C VC JSON-LD & signature).

- [ ] Task 4.3: Wire ZK-KYC & A2A Routes into App Gateway [File: `src/app.ts`]
  - Mount `zkProofRouter` under `/api/v1/verify`.
  - Mount `a2aRouter` under `/api/v1/a2a`.
  - Apply `x402Middleware` to gate `/api/v1/verify/zk-proof` and `/api/v1/a2a/handshake` endpoints behind x402 payment protocol.

---

## Phase 5: Vitest Test Suite (`__tests__/a2a.test.ts`, `__tests__/zkp.test.ts`, `__tests__/box-layout.test.ts`)

- [ ] Task 5.1: Create Algorand 77-Byte Box Layout Unit Tests [File: `__tests__/box-layout.test.ts`]
  - Test `encodeKarmaBox` and `decodeKarmaBox` round-trip serialization symmetry.
  - Assert exact 77-byte binary length, field offsets, big-endian integer encodings, and ARC-28 event selector constants (`0x8c21f904`).

- [ ] Task 5.2: Create Groth16 ZK-KYC Proof Verifier Tests [File: `__tests__/zkp.test.ts`]
  - Test valid ZK proof payload processing and verification tier promotion.
  - Test invalid proof payloads (HTTP 400 `Invalid ZK Proof`), corrupt public signals, and verify 0% PII storage in database/logs.

- [ ] Task 5.3: Create A2A Pre-Flight Handshake Tests [File: `__tests__/a2a.test.ts`]
  - Test successful handshake (`PROCEED`) for target agent with Karma $\ge 600$ returning signed W3C VC JSON-LD passport.
  - Test rejected handshake (`REJECT`) for target agent with Karma $< 600$ or FLAGGED sanctions status.
  - Verify Ed25519 signature validity over the returned Verifiable Credential.

---

## Phase 6: Build & Test Quality Gate (`npm run typecheck`, `npm run build`, `npm test`)

- [ ] Task 6.1: Execute Vitest Test Suite [Command: `npm test`]
  - Execute `npm test` (`vitest run`) and confirm 100% pass rate across `__tests__/box-layout.test.ts`, `__tests__/zkp.test.ts`, `__tests__/a2a.test.ts`, and all existing test suites.

- [ ] Task 6.2: Execute TypeScript Type Check & Build [Commands: `npm run typecheck`, `npm run build`]
  - Execute `npm run typecheck` (`tsc --noEmit`) and `npm run build` (`tsc`) to verify strict zero-error TypeScript compilation across all new modules and routes.
