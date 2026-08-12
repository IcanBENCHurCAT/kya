# API Specification — Phase 3 Contracts

## 1. `POST /api/v1/a2a/handshake`

Machine-to-machine pre-flight compliance handshake endpoint. Protected by x402 payment gate middleware.

### Request Headers
- `Content-Type`: `application/json`
- `X-Payment`: `<Transaction ID or Auth Token>`

### Request Body
```json
{
  "initiatorAddress": "AAA...AAA",
  "targetAddress": "BBB...BBB",
  "minKarmaScore": 600,
  "requiredVerificationLevel": 1
}
```

### Response `200 OK`
```json
{
  "decision": "PROCEED",
  "initiatorAddress": "AAA...AAA",
  "targetAddress": "BBB...BBB",
  "targetProfile": {
    "karmaScore": 750,
    "verificationLevel": 2,
    "sanctionsStatus": "PASS",
    "riskFlags": []
  },
  "verifiableCredential": {
    "@context": ["https://www.w3.org/2018/credentials/v1"],
    "type": ["VerifiableCredential", "AgentKYAPassport"],
    "issuer": "did:kya:algorand:mainnet:gateway",
    "issuanceDate": "2026-08-09T03:50:00Z",
    "credentialSubject": {
      "id": "did:kya:algorand:BBB...BBB",
      "karmaScore": 750,
      "sanctionsStatus": "PASS",
      "verificationLevel": 2,
      "decision": "PROCEED"
    },
    "proof": {
      "type": "Ed25519Signature2020",
      "created": "2026-08-09T03:50:00Z",
      "verificationMethod": "did:kya:algorand:gateway#key-1",
      "proofPurpose": "assertionMethod",
      "proofValue": "z3j9X..."
    }
  },
  "signature": "0xabc...",
  "timestamp": 1786247400
}
```

### Response `400 Bad Request` / `402 Payment Required`
```json
{
  "error": "Payment required",
  "priceMicroAlgo": 5000,
  "paymentAddress": "KYA...TREASURY"
}
```

---

## 2. `POST /api/v1/verify/zk-proof`

Groth16 Zero-Knowledge KYC proof verification endpoint.

### Request Headers
- `Content-Type`: `application/json`
- `X-Payment`: `<Transaction ID or Auth Token>`

### Request Body
```json
{
  "agentAddress": "BBB...BBB",
  "proof": {
    "pi_a": ["0x123...", "0x456..."],
    "pi_b": [["0x789...", "0xabc..."], ["0xdef...", "0x012..."]],
    "pi_c": ["0x345...", "0x678..."],
    "protocol": "groth16"
  },
  "publicSignals": ["0x0001"],
  "claimType": "KYC_AGE_OVER_18"
}
```

### Response `200 OK`
```json
{
  "success": true,
  "agentAddress": "BBB...BBB",
  "claimType": "KYC_AGE_OVER_18",
  "newVerificationLevel": 2,
  "verifiedAt": 1786247400
}
```
