# Feature Specification: Phase 3 — Agent-to-Agent (A2A) Handshake, Zero-Knowledge KYC (Groth16 ZKP) & Algorand Box Storage Karma Anchoring

**Feature Branch**: `feature/phase3-a2a-zkp-karma`  
**Created**: 2026-08-08  
**Status**: Draft  
**Input**: User description: "Phase 3 (A2A Handshake, Groth16 ZK-KYC Proof Verification & Algorand Box Storage On-Chain Karma Anchoring)"

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Agent-to-Agent (A2A) Pre-Flight Trust Protocol (Priority: P1)
As an autonomous AI agent (Agent A), I want to execute a machine-readable A2A pre-flight handshake with KYA before dispatching funds or hiring counterparty Agent B, so that I can instantly verify Agent B's on-chain Karma score, sanctions status, and W3C Verifiable Compliance Passport without revealing sensitive PII.

**Why this priority**: Fulfills Principle IV (Module Independence & A2A Interoperability). Establishes machine-to-machine trust protocols enabling autonomous agent ecosystems.

**Independent Test**:
- Issue `POST /api/v1/a2a/handshake` with `{ "initiatorAddress": "...", "targetAddress": "...", "minKarmaScore": 600 }`.
- Verify response returns `decision: "PROCEED"` or `"REJECT"`, attached W3C Verifiable Credential payload, and cryptographic signature claim.

**Acceptance Scenarios**:
1. **Given** Target Agent B with Karma $\ge 600$ and PASS sanctions status, **When** Agent A initiates `/api/v1/a2a/handshake`, **Then** return `decision: "PROCEED"`, W3C Verifiable Credential JSON-LD passport, and valid Ed25519 signature.
2. **Given** Target Agent B with FLAGGED sanctions status or Karma $< 600$, **When** Agent A initiates `/api/v1/a2a/handshake`, **Then** return `decision: "REJECT"`, risk breakdown, and non-blocking circuit breaker response.

---

### User Story 2 — Zero-Knowledge KYC Proof Verification (Groth16 zk-SNARK) (Priority: P1)
As a privacy-focused human operator or AI agent owner, I want to submit zero-knowledge identity assertions (Groth16 ZK proofs) proving my KYC compliance, age ($\ge 18$), or nationality without writing any raw PII or un-salted hashes to the blockchain or database.

**Why this priority**: Fulfills Principle VI (Privacy-Preserving & Mainnet-Ready). Ensures 100% compliance with GDPR Art. 17 ("Right to be Forgotten") and zero PII storage on Algorand.

**Independent Test**:
- Submit `POST /api/v1/verify/zk-proof` with `{ "agentAddress": "...", "proof": { ... }, "publicSignals": ["0x123..."] }`.
- Verify ZK proof evaluation succeeds, records verification level in `agent_profiles`, and purges off-chain ephemeral artifacts within 72 hours.

---

### User Story 3 — Algorand Box Storage On-Chain Karma Anchoring & ARC-28 Events (Priority: P2)
As an Algorand indexer or smart contract developer, I want agent Karma state to be stored in packed 77-byte static binary Box Storage (`k_{agent_address}`) on Algorand mainnet/testnet, so that reputation is immutably anchored on-chain with ARC-28 standard event logs.

**Why this priority**: Fulfills Principle III (On-Chain Karma System). Anchors off-chain Supabase karma scores onto Algorand ledger with 0.0469 ALGO MBR refundability.

---

## Edge Cases

- What happens when a Groth16 ZK proof contains invalid public signals or proof verification fails? (Reject with HTTP 400 `Invalid ZK Proof`).
- How does the system handle temporary Algorand indexer downtime during A2A handshakes? (Fall back gracefully to local Supabase/In-Memory read cache).

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST implement `POST /api/v1/a2a/handshake` accepting initiator and target addresses, returning machine-readable JSON-LD compliance passports.
- **FR-002**: System MUST implement `POST /api/v1/verify/zk-proof` to verify Groth16 zk-SNARK proof payloads for Zero-Knowledge KYC assertions.
- **FR-003**: System MUST provide an Algorand Box Storage encoder helper matching the 77-byte binary layout (`karma_score` uint64, `stake_amount` uint64, `risk_flags` uint32, `ver_level` uint8, `registered_at` uint64, `last_updated` uint64, `owner_identity_hash` bytes32, `total_queries_paid` uint64).
- **FR-004**: System MUST emit ARC-28 compliant log events upon on-chain karma sync.
- **FR-005**: All new services and routes MUST be fully tested using `vitest` (`npm test`) and compile cleanly with `npm run build`.

---

## Key Entities

- **A2AHandshakeRequest**: (`initiatorAddress`, `targetAddress`, `requiredVerificationLevel`, `minKarmaScore`).
- **A2AHandshakeResponse**: (`decision`, `targetProfile`, `verifiableCredential`, `signature`, `timestamp`).
- **ZKProofPayload**: (`agentAddress`, `proof`, `publicSignals`, `claimType`).
- **OnChainKarmaBox**: 77-byte packed binary struct (`k_{agent_address}`).

---

## Success Criteria *(mandatory)*

- **SC-001**: A2A handshake endpoint responds in under 150ms with valid machine-readable passports.
- **SC-002**: ZK proof verifier successfully evaluates Groth16 proof payloads without storing PII.
- **SC-003**: 100% of test suites pass cleanly in Vitest.
