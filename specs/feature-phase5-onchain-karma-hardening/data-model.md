# Phase 1 Data Model: On-Chain Karma Hardening & Non-Custodial Trust Infrastructure (KYA v3.0)

**Feature Branch**: `feature/phase5-onchain-karma-hardening`  
**Date**: 2026-08-23  
**Status**: Completed  

---

## 1. Algorand Box Storage Layout v2 (80-Byte Binary Spec)

### 1.1 Binary Field Layout
Box Key: `k_` + 32-byte Algorand Public Key = 34 bytes.  
Box Value: 80 bytes fixed binary buffer (big-endian).

```
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|    version    |   ver_level   |          risk_flags           |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                          karma_score                          |
|                           (uint64)                            |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                         stake_amount                          |
|                           (uint64)                            |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                         registered_at                         |
|                           (uint64)                            |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                         last_updated                          |
|                           (uint64)                            |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                        unbonding_until                        |
|                           (uint64)                            |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                      total_queries_paid                       |
|                           (uint32)                            |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                                                               |
+                    owner_identity_nullifier                   +
|                           (32 bytes)                          |
+                                                               +
|                                                               |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
```

### 1.2 Field Specification Table

| Offset | Field Name | Type | Size | Valid Range / Description |
| :--- | :--- | :--- | :--- | :--- |
| `0` | `version` | `uint8` | 1 | `0x02` (Version 2.0.0) |
| `1` | `ver_level` | `uint8` | 1 | `0` (Unverified), `1` (Email), `2` (ZK-KYC), `3` (Enterprise) |
| `2` | `risk_flags` | `uint16` | 2 | Bitmask: `0x0001` (Sanctions Match), `0x0002` (Dispute Active), `0x0004` (Slashed), `0x0008` (Rate Abuser) |
| `4` | `karma_score` | `uint64` | 8 | `0` to `10000` (Basis Points / Scaled Karma) |
| `12` | `stake_amount` | `uint64` | 8 | Collateral locked in microALGO |
| `20` | `registered_at` | `uint64` | 8 | Unix Epoch timestamp (seconds) |
| `28` | `last_updated` | `uint64` | 8 | Unix Epoch timestamp (seconds) |
| `36` | `unbonding_until` | `uint64` | 8 | `0` = Active, $>0$ = Unbonding timestamp, `0xFFFFFFFFFFFFFFFF` = Locked/Disputed |
| `44` | `total_queries_paid` | `uint32` | 4 | Lifetime x402 queries paid count |
| `48` | `owner_identity_nullifier` | `byte[32]` | 32 | Salted zero-knowledge identity commitment/nullifier |

---

## 2. TypeScript Domain Interfaces

### 2.1 On-Chain Box v2 Interface (`src/algorand/box-layout.ts`)

```typescript
export interface OnChainKarmaBoxV2 {
  version: number;               // uint8 (0x02)
  ver_level: number;             // uint8 (0-3)
  risk_flags: number;            // uint16 (bitmask)
  karma_score: bigint;           // uint64 (0-10000)
  stake_amount: bigint;          // uint64 (microALGO)
  registered_at: bigint;         // uint64 (timestamp)
  last_updated: bigint;          // uint64 (timestamp)
  unbonding_until: bigint;       // uint64 (0 = active, >0 = cooldown, max = locked)
  total_queries_paid: number;    // uint32
  owner_identity_nullifier: Uint8Array | string; // 32 bytes
}
```

### 2.2 Oracle Karma Attestation Payload (`src/types/karma.ts`)

```typescript
export interface OracleKarmaAttestation {
  oraclePubkey: string;          // Algorand address / Ed25519 public key of oracle
  agentAddress: string;          // Target agent being scored
  sourceDomain: 'COMPUTE' | 'DEX_ESCROW' | 'PREDICTION_MARKET' | 'NATIVE_ZK';
  eventType: string;             // e.g. "COMPUTE_TASK_SUCCESS"
  karmaDelta: number;            // Signed delta (-10000 to +2500)
  timestamp: number;             // Unix timestamp
  nonce: string;                 // Anti-replay UUID / nonce
  reasonCode: string;            // Standard reason identifier
  signature: string;             // Hex or Base64 Ed25519 signature over payload
}
```

### 2.3 Anti-Proxy Signed Request Envelope (`src/types/a2a.ts`)

```typescript
export interface SignedAgentRequest<T> {
  agentAddress: string;          // Public key claiming discount / initiating request
  timestamp: number;             // Request timestamp (max 60s skew)
  nonce: string;                 // Unique single-use nonce
  payload: T;                    // Inner request data
  signature: string;             // Signature over hash(payload + timestamp + nonce)
}
```

### 2.4 Agent Card Metadata (`GET /.well-known/agent-card.json`)

```typescript
export interface AgentCardDiscovery {
  gatewayVersion: string;
  treasuryAddress: string;
  nodeOperator: string;
  supportedProtocols: string[];
  arc28Selectors: Record<string, string>;
  watchlist: {
    entriesCount: number;
    lastUpdated: string;
    isFresh: boolean;
    failClosedEnabled: boolean;
  };
  pricing: {
    baseFeeMicroAlgo: number;
    maxDiscountPercent: number;
    minStakeForDiscountMicroAlgo: number;
  };
}
```

---

## 3. ARC-28 Event Emitters Specification

| Event Name | Signature | 4-Byte Selector | Args Payload |
| :--- | :--- | :--- | :--- |
| `AgentRegistered` | `AgentRegistered(address,uint64,uint8)` | `0x4a7e9b12` | Agent address, Initial Stake, Ver Level |
| `KarmaUpdated` | `KarmaUpdated(address,uint64,int32,bytes32)` | `0x8c21f904` | Agent address, New Score, Delta, Reason Code |
| `UnbondingInitiated`| `UnbondingInitiated(address,uint64,uint64)` | `0x7b10fa8c` | Agent address, Stake Amount, Unbonding Until |
| `UnbondingClaimed` | `UnbondingClaimed(address,uint64)` | `0x92f4c1e7` | Agent address, Refunded microALGO |
| `DisputeLogged` | `DisputeLogged(address,address,bytes32)` | `0xd3e51a60` | Agent address, Challenger, Reason Hash |
| `RiskFlagged` | `RiskFlagged(address,uint16)` | `0x1f94d03e` | Agent address, Flag Bitmask |
| `X402PaymentSettled`| `X402PaymentSettled(address,uint64,bytes32)` | `0x3d6a89c1` | Payer address, Amount, Query Hash |
