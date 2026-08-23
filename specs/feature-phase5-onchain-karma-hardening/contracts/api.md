# API Specification: Phase 5 On-Chain Karma Hardening & Non-Custodial Trust

---

## 1. `GET /.well-known/agent-card.json`

Open service discovery endpoint for autonomous agents and indexers to verify node operator identity, compliance feed freshness, and contract capability before routing queries.

### Response `200 OK`
```json
{
  "gatewayVersion": "3.0.0",
  "treasuryAddress": "KYATREASURY7777777777777777777777777777777777777777777777",
  "nodeOperator": "Autonomous Community Node 01",
  "supportedProtocols": ["x402", "a2a-handshake", "groth16-zkp", "arc-28-events"],
  "arc28Selectors": {
    "AgentRegistered": "0x4a7e9b12",
    "KarmaUpdated": "0x8c21f904",
    "UnbondingInitiated": "0x7b10fa8c",
    "UnbondingClaimed": "0x92f4c1e7",
    "DisputeLogged": "0xd3e51a60",
    "RiskFlagged": "0x1f94d03e",
    "X402PaymentSettled": "0x3d6a89c1"
  },
  "watchlist": {
    "entriesCount": 19188,
    "lastUpdated": "2026-08-23T00:00:00.000Z",
    "isFresh": true,
    "failClosedEnabled": true
  },
  "pricing": {
    "baseFeeMicroAlgo": 5000,
    "maxDiscountPercent": 50,
    "minStakeForDiscountMicroAlgo": 1000000
  }
}
```

---

## 2. `POST /api/v1/screening/evaluate`

Point-of-sale sanctions evaluation with strict fail-closed posture and probabilistic risk heuristics. Gated by x402 micro-payment.

### Request Headers
- `Content-Type`: `application/json`
- `X-Payment`: `<Algorand Transaction ID or Authorization Receipt>`
- `X-Agent-Signature`: `<Ed25519 signature over body + timestamp + nonce>`
- `X-Agent-Address`: `<Payer Algorand Address>`
- `X-Agent-Timestamp`: `1786247400`
- `X-Agent-Nonce`: `e8b2f901-2a45-48b2-92ec-99e74c8b2111`

### Request Body
```json
{
  "targetName": "Oleg Deripaska",
  "targetAddress": "ALGOWALLETADDRESS...",
  "threshold": 0.85
}
```

### Response `200 OK`
```json
{
  "status": "EVALUATED",
  "sanctionsMatch": true,
  "confidenceScore": 0.94,
  "matchVectors": [
    {
      "source": "OFAC_SDN",
      "matchedEntity": "DERIPASKA, Oleg Vladimirovich",
      "algorithm": "Jaro-Winkler",
      "similarity": 0.94
    }
  ],
  "disclaimer": "This verification output is an algorithmic probabilistic heuristic and does not constitute formal statutory legal certification.",
  "timestamp": 1786247400
}
```

### Response `503 Service Unavailable` (Fail-Closed)
```json
{
  "error": "SERVICE_FAIL_CLOSED",
  "message": "Official upstream sanctions watchlist data is stale or unreachable. Screening refused under strict fail-closed compliance policy."
}
```

---

## 3. `POST /api/v1/karma/oracle-attest`

Pluggable oracle karma ingestion endpoint. Allows authorized third-party oracles (compute providers, task escrows, prediction markets) to submit cryptographically signed behavioral attestations.

### Request Body
```json
{
  "oraclePubkey": "ORACLEPUBKEYADDRESS...",
  "agentAddress": "TARGETAGENTADDRESS...",
  "sourceDomain": "COMPUTE",
  "eventType": "COMPUTE_TASK_SUCCESS",
  "karmaDelta": 250,
  "timestamp": 1786247400,
  "nonce": "6a9f4c3d-0112-4211-9a7c-88bf91a12345",
  "reasonCode": "TASK_BENCHMARK_COMPLETED_ON_TIME",
  "signature": "0x9f8e7d..."
}
```

### Response `200 OK`
```json
{
  "success": true,
  "agentAddress": "TARGETAGENTADDRESS...",
  "previousScore": 6500,
  "newScore": 6750,
  "calibratedDelta": 250,
  "arc28EventEmitted": "0x8c21f904",
  "syncedOnChain": true
}
```

---

## 4. `POST /api/v1/karma/deregister`

Initiates the challenge-locked unbonding cooldown for an agent seeking to retrieve their storage MBR and bonded stake.

### Request Body (Signed by Agent)
```json
{
  "agentAddress": "AGENTADDRESS...",
  "timestamp": 1786247400,
  "nonce": "c9284fae-128a-4d2b-bb41-89ef32a18821",
  "signature": "0x12ab34cd..."
}
```

### Response `200 OK`
```json
{
  "success": true,
  "agentAddress": "AGENTADDRESS...",
  "status": "UNBONDING_INITIATED",
  "unbondingUntil": 1786852200,
  "holdingPeriodSeconds": 604800,
  "refundableMbrMicroAlgo": 48100,
  "refundableStakeMicroAlgo": 1000000,
  "disputeStatus": "UNCONTESTED"
}
```

---

## 5. `POST /api/v1/karma/claim-unbonded`

Claims refunded MBR and stake after the unbonding challenge period has elapsed without dispute. Executes on-chain box deletion (`box_del`).

### Request Body
```json
{
  "agentAddress": "AGENTADDRESS...",
  "timestamp": 1786852201,
  "nonce": "a7b8c9d0-3e4f-5a6b-7c8d-9e0f1a2b3c4d",
  "signature": "0xdeadbeef..."
}
```

### Response `200 OK`
```json
{
  "success": true,
  "agentAddress": "AGENTADDRESS...",
  "status": "UNBONDED_AND_DELETED",
  "refundTxId": "TXID987654321...",
  "refundedAmountMicroAlgo": 1048100
}
```

### Response `400 Bad Request` (Disputed or Window Incomplete)
```json
{
  "error": "UNBONDING_CHALLENGE_ACTIVE",
  "message": "Cannot claim unbonded stake: unbonding challenge window is still active or identity is under active dispute.",
  "unbondingUntil": 1786852200,
  "currentTime": 1786247400
}
```
