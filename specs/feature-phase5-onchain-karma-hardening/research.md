# Phase 0 Research: On-Chain Karma Hardening & Non-Custodial Trust Infrastructure (KYA v3.0)

**Feature Branch**: `feature/phase5-onchain-karma-hardening`  
**Date**: 2026-08-23  
**Status**: Completed  

---

## 1. Legal & Regulatory Hardening: Bilateral SaaS vs. Money Transmission

### 1.1 Non-Custodial Bilateral Bandwidth Billing
- **Regulatory Framework**: Under US FinCEN regulations (31 CFR § 1010.100(ff)(5)) and state-level money transmitter acts, taking custody of third-party funds or routing payments between two independent parties for transaction execution creates Money Services Business (MSB) exposure.
- **Architectural Solution**: KYA Gateway processes x402 micro-payments strictly as direct bilateral compensation for computational services rendered (screening compute, graph analysis, VC issuance, box storage state synchronization). The gateway is never an escrow agent or custodian of third-party transaction funds.
- **Node Operator Direct Capture**: When a community operator deploys a node, incoming x402 payments settle directly to `KYA_TREASURY_ADDRESS` (the node operator's address) with 0% intermediate retention or custodial routing.

### 1.2 Fail-Closed Compliance vs. False-Clear Liability
- **Legal Risk**: Under OFAC regulations (31 C.F.R. Part 501), sanctions compliance operates under strict liability. Returning a "clear / pass" result based on stale, mock, or fallback data during an upstream outage creates severe civil and criminal liability for agents and gateways.
- **Architectural Decision**: The screening engine enforces a strict **fail-closed** posture. If the official sanctions feed is unreachable, unverified, or exceeds the maximum freshness threshold (24 hours), the gateway must return `503 Service Unavailable` with `SERVICE_FAIL_CLOSED` error code. Zero mock or seeded fallbacks are permitted in production paths.

### 1.3 Probabilistic Scoring & Non-Reliance Legal Disclaimers
- **Heuristic Characterization**: Sanctions screening output is mathematically defined as probabilistic fuzzy-distance heuristics ($D \in [0, 1]$), not definitive statutory legal determinations.
- **Verifiable Credential Disclaimers**: All issued W3C Verifiable Credentials must embed standard legal disclaimers:
  > *"This verification credential contains algorithmic risk scoring based on publicly available data feeds at the time of query. It constitutes technical heuristic data and does not constitute formal legal certification or statutory compliance counsel."*

---

## 2. On-Chain Box Storage Architecture: Versioned Layout & Atomic Composability

### 2.1 Box Storage Layout v2 Specification
To ensure zero breaking migrations for downstream smart contracts while adding lifecycle, dispute, and unbonding tracking, the box layout is upgraded to a versioned **80-byte binary specification**:

| Offset | Field Name | Type | Size (Bytes) | Description |
| :--- | :--- | :--- | :--- | :--- |
| **0** | `version` | `uint8` | 1 | Schema version (`0x02` for v2, `0x01` legacy) |
| **1** | `ver_level` | `uint8` | 1 | KYC verification tier (0-3) |
| **2** | `risk_flags` | `uint16` | 2 | Compact bitmask of active risk flags |
| **4** | `karma_score` | `uint64` | 8 | Reputation score (0 - 10,000 basis points) |
| **12** | `stake_amount` | `uint64` | 8 | Bonded collateral stake in microALGO |
| **20** | `registered_at` | `uint64` | 8 | Unix timestamp (seconds) of initial registration |
| **28** | `last_updated` | `uint64` | 8 | Unix timestamp (seconds) of last score update |
| **36** | `unbonding_until` | `uint64` | 8 | Unix timestamp when unbonding cooldown completes (0 = active) |
| **44** | `total_queries_paid` | `uint32` | 4 | Count of paid x402 queries processed |
| **48** | `owner_identity_nullifier` | `byte[32]` | 32 | Privacy-preserving ZK-SNARK nullifier / commitment |
| **Total** | | | **80 Bytes** | Static MBR-optimized payload |

### 2.2 Algorand MBR Economics
- **Key**: `k_` + 32-byte public key = 34 bytes
- **Value**: 80 bytes
- **Total MBR Cost**:
  $$\text{MBR} = 2,500 + 400 \times (\text{KeyBytes} + \text{ValueBytes}) = 2,500 + 400 \times (34 + 80) = 2,500 + 45,600 = 48,100 \text{ microALGO } (0.0481 \text{ ALGO})$$
- **100% Refundability**: Upon completion of unbonding without dispute, the box is deleted via `box_del`, returning the entire 0.0481 ALGO MBR back to the agent.

### 2.3 Synchronous On-Chain Smart Contract Inspection
- Downstream smart contracts (e.g., escrow, bounty release, collateral gates) can inspect the 80-byte box in an atomic group transaction using `app_box_extract(key, 0, 80)`.
- Contracts can synchronously read `karma_score` (offset 4, 8 bytes), `risk_flags` (offset 2, 2 bytes), and `unbonding_until` (offset 36, 8 bytes) in $< 5\text{ms}$ execution budget.

---

## 3. Game-Theoretic Anti-Whitewashing & Challenge-Locked Deregistration

### 3.1 The Sybil Whitewashing Attack Vector
- In decentralized reputation systems, if identity disposal cost is zero, malicious agents discard identities after defecting (e.g. non-delivery of tasks, sanctions evasion) and register fresh identities with default scores.

### 3.2 Unbonding Challenge Windows & Dispute Locks
- **Unbonding Cooldown**: When an agent requests deregistration, the box state transitions to `unbonding_until = now() + UNBONDING_DELAY` (default: 7 days / 604,800 seconds).
- **Dispute Lock**: If a counterparty submits a valid cryptographic proof of non-performance or an oracle records a risk flag during the window, `unbonding_until` is locked to $\infty$ (`0xFFFFFFFFFFFFFFFF`), preventing deposit retrieval.
- **Deposit Slashing**: Contested deposits can be burned or redirected to the protocol insurance fund.
- **Honest Reclamation**: Once `now() >= unbonding_until`, the agent invokes `claim_unbonded`, which executes `box_del` and refunds the 0.0481 ALGO MBR and bonded stake.

---

## 4. Rate-Bounded Dynamic Price Discovery & Anti-Proxying Cryptography

### 4.1 Anti-Proxying Arbitrage Prevention
- **The Proxy Attack**: High-karma agents who receive 50% discount on compliance queries might run a fee-arbitrage proxy, allowing unverified, high-risk agents to query through them cheaply without paying risk premiums.
- **Cryptographic Request Binding**: Every x402 query payload must include a cryptographic signature (`X-Agent-Signature`) over `hash(request_body + timestamp + nonce)` signed with the paying agent's private key. The gateway verifies the signature using `algosdk.verifyBytes`.

### 4.2 Volume-Saturation Decay Model
- Reputation discounts decay dynamically when 24-hour query volume exceeds the bonded stake ratio:
  $$\text{Effective Discount} = \text{Base Discount} \times \max\left(0, 1 - \frac{\text{QueryCount}_{24\text{h}}}{\text{MaxQueries}(\text{Stake})}\right)$$
- If an agent exceeds their volume quota, query pricing smoothly reverts to base price (5,000 microALGO), eliminating resale arbitrage margin.

---

## 5. Multi-Source Behavioral Karma & Pluggable Oracle Ingestion

### 5.1 Pluggable Oracle Model
Reputation must aggregate signals from native protocol behaviors and trusted external oracles with calibrated source weights:

| Signal Source | Event Type | Weight ($\omega_i$) | Max Contribution | Verification Method |
| :--- | :--- | :--- | :--- | :--- |
| **Native ZK-KYC** | `ZK_KYC_VERIFIED` | 0.35 | +2,500 pts | Groth16 zk-SNARK proof verification |
| **Native Clean History** | `TENURE_MILESTONE` | 0.20 | +1,500 pts | On-chain age without active dispute |
| **Compute / Worker Oracles** | `COMPUTE_TASK_SUCCESS` | 0.15 | +1,500 pts | Ed25519 oracle signature & task ID |
| **DEX / Escrow Oracles** | `SETTLEMENT_SUCCESS` | 0.20 | +2,500 pts | Oracle attestation of timely settlement |
| **Sanctions / Risk Flags** | `SANCTIONS_FLAG` | -1.00 | -10,000 pts (Instant Blacklist) | Fuzzy match or OFAC SDN match |

### 5.2 Replay Protection & Oracle Authority Verification
- Oracle submissions must include `oracle_pubkey`, `sequence_nonce`, `timestamp`, `signature`, and `reason_code`.
- Gateway verifies oracle registration in an on-chain or configuration-driven Oracle Registry before state commits.

---

## 6. Decentralized Node Operator Model & Service Discovery

### 6.1 Permissionless 1-Click Deployment
- Any developer or cloud operator can clone `kya-service` and run:
  ```bash
  docker run -d -p 3000:3000 -e KYA_TREASURY_ADDRESS=<OPERATOR_ADDRESS> kya-service
  ```
- All x402 fees sent by agents querying this node go 100% to `<OPERATOR_ADDRESS>`.

### 6.2 Agent Card Discovery (`/.well-known/agent-card.json`)
- Every node exposes its operational capability, gateway version, watchlist freshness timestamp, and supported ARC-28 event signatures via standard JSON discovery.
