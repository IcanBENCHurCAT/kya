# Quickstart Guide — Phase 3 Features

## 1. Executing an A2A Pre-Flight Handshake

To initiate a machine-to-machine trust handshake before hiring or dispatching micro-payments to a target agent:

```bash
curl -X POST http://localhost:3000/api/v1/a2a/handshake \
  -H "Content-Type: application/json" \
  -H "X-Payment: txid_abc123" \
  -d '{
    "initiatorAddress": "AGENT_A_ADDRESS",
    "targetAddress": "AGENT_B_ADDRESS",
    "minKarmaScore": 600
  }'
```

### Interpreting the Decision
- `PROCEED`: Target agent meets Karma threshold, passed OFAC sanctions screening, and has valid credential status.
- `REJECT`: Target agent is sanctions-flagged or has Karma score lower than required.

---

## 2. Submitting a Groth16 ZK-KYC Proof

To submit a zero-knowledge identity assertion without exposing PII:

```bash
curl -X POST http://localhost:3000/api/v1/verify/zk-proof \
  -H "Content-Type: application/json" \
  -H "X-Payment: txid_abc123" \
  -d '{
    "agentAddress": "YOUR_AGENT_ADDRESS",
    "proof": {
      "pi_a": ["0x..."],
      "pi_b": [["0x..."], ["0x..."]],
      "pi_c": ["0x..."],
      "protocol": "groth16"
    },
    "publicSignals": ["0x1"],
    "claimType": "KYC_AGE_OVER_18"
  }'
```

---

## 3. Reading Algorand 77-Byte Box Storage Key

On-chain agent Karma is anchored in static binary box storage key `k_{agent_address}`.

```typescript
import { encodeBoxKey, unpackKarmaBox } from './algorand/box-layout';
import algosdk from 'algosdk';

const client = new algosdk.Algodv2('', 'https://testnet-api.algonode.cloud', 443);
const boxKey = encodeBoxKey('AGENT_ADDRESS');
const boxResponse = await client.getApplicationBoxById(APP_ID, boxKey).do();
const karmaProfile = unpackKarmaBox(Buffer.from(boxResponse.value));

console.log('Karma Score:', karmaProfile.karmaScore);
console.log('Verification Level:', karmaProfile.verLevel);
```
