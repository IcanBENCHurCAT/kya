# Architectural Research Notes — Phase 3

## 1. Groth16 ZK-KYC Verifier Integration

### Context
To maintain 100% GDPR Art. 17 ("Right to be Forgotten") compliance while providing mainnet-native KYC trust assertions, `kya-service` relies on Groth16 zk-SNARK proof evaluation.

### Key Decision
- **In-Memory Verification**: Proofs are validated in-memory using `snarkjs.groth16.verify(vKey, publicSignals, proof)`.
- **Zero On-Chain PII**: Neither identity documents, names, nor un-salted hashes are stored on the Algorand blockchain or Supabase. Only boolean proof validity and resulting `verification_level` (uint8) are committed to state.
- **Verification Artifact Lifecycle**: Ephemeral enclaves or verification logs purge all metadata within 72 hours.

---

## 2. W3C Verifiable Credentials (VC) Format for A2A Pre-Flight

### Context
Agent-to-Agent communication requires a standardized, machine-readable format for identity and compliance passports.

### Schema Decision
The handshake returns a W3C Verifiable Credential (`application/vc+json` / JSON-LD standard):

```json
{
  "@context": [
    "https://www.w3.org/2018/credentials/v1",
    "https://kya.network/context/v1.jsonld"
  ],
  "type": ["VerifiableCredential", "AgentKYAPassport"],
  "issuer": "did:kya:algorand:mainnet:gateway",
  "issuanceDate": "2026-08-09T03:50:00Z",
  "credentialSubject": {
    "id": "did:kya:algorand:ACCOUNT_ADDRESS",
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
}
```

---

## 3. 77-Byte Algorand Box Storage Layout

### Binary Spec (`k_{agent_address}`)

To minimize Algorand Minimum Balance Requirements (MBR), agent karma profiles are packed into a static 77-byte binary layout:

| Field Name | Offset | Type | Size (Bytes) | Description |
| :--- | :--- | :--- | :--- | :--- |
| `karma_score` | 0 | uint64 | 8 | Reputation score (0-10000) |
| `stake_amount` | 8 | uint64 | 8 | Collateral stake in microALGO |
| `risk_flags` | 16 | uint32 | 4 | Bitfield of active risk flags |
| `ver_level` | 20 | uint8 | 1 | KYC verification tier (0-3) |
| `registered_at` | 21 | uint64 | 8 | Unix timestamp of registration |
| `last_updated` | 29 | uint64 | 8 | Unix timestamp of last update |
| `owner_identity_hash` | 37 | byte[32] | 32 | Salted zero-knowledge root hash |
| `total_queries_paid` | 69 | uint64 | 8 | Count of paid x402 queries |
| **Total Size** | | | **77 Bytes** | |

### MBR Calculation
$$\text{MBR} = 2,500 + 400 \times (\text{BoxKeyBytes} + \text{BoxValueBytes}) = 2,500 + 400 \times (34 + 77) = 46,900 \text{ microALGO } (0.0469 \text{ ALGO})$$
Upon key deletion (`box_del`), 100% of this MBR is refunded.
