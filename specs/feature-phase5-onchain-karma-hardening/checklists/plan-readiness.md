# Plan Readiness Checklist: On-Chain Karma Hardening & Non-Custodial Trust Infrastructure (KYA v3.0)

**Purpose**: Validate technical implementation plan completeness, architectural alignment, and constitutional conformance before task breakdown.  
**Created**: 2026-08-23  
**Feature**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md)

---

## 1. Architectural & Technical Alignment

- [x] **PLN001**: 80-byte Algorand Box Layout v2 matches endianness, field offsets, and MBR formula ($0.0481 \text{ ALGO}$).
- [x] **PLN002**: Backwards compatibility for legacy 77-byte v1 boxes is specified with fallback decoding.
- [x] **PLN003**: ARC-28 event emitters defined for `UnbondingInitiated`, `UnbondingClaimed`, and `DisputeLogged`.
- [x] **PLN004**: Anti-proxying cryptographic verification uses `algosdk.verifyBytes` with timestamp skew tolerance ($\le 60\text{s}$).
- [x] **PLN005**: Volume-saturation decay model is mathematically specified to eliminate resale arbitrage margins.
- [x] **PLN006**: Pluggable oracle ingestion validates external signatures, nonces, and calibrated delta limits.
- [x] **PLN007**: Direct bilateral SaaS settlement to `KYA_TREASURY_ADDRESS` is documented without custodial routing.
- [x] **PLN008**: Discovery endpoint `GET /.well-known/agent-card.json` schema is fully specified.

---

## 2. Constitutional & Regulatory Compliance

- [x] **PLN009**: Zero external imports from `@algorbounty` (Principle I).
- [x] **PLN010**: Micro-payment x402 gate enforced on all non-health endpoints (Principle II).
- [x] **PLN011**: On-chain Karma state anchored to Algorand Box Storage with full MBR refundability (Principle III).
- [x] **PLN012**: Domain independence maintained with clean interfaces under `src/types/` (Principle IV).
- [x] **PLN013**: Vitest test coverage planned across all new modules and failure modes (Principle V).
- [x] **PLN014**: Strict fail-closed posture and ZK-SNARK nullifiers with zero on-chain PII (Principle VI).
- [x] **PLN015**: Technical documentation and contracts strictly synchronized with implementation (Principle VII).

---

## 3. Plan Artifacts

- [x] **PLN016**: `specs/feature-phase5-onchain-karma-hardening/plan.md` created.
- [x] **PLN017**: `specs/feature-phase5-onchain-karma-hardening/research.md` created.
- [x] **PLN018**: `specs/feature-phase5-onchain-karma-hardening/data-model.md` created.
- [x] **PLN019**: `specs/feature-phase5-onchain-karma-hardening/quickstart.md` created.
- [x] **PLN020**: `specs/feature-phase5-onchain-karma-hardening/contracts/api.md` created.
- [x] **PLN021**: `implementation_plan.md` artifact created and submitted for review.
