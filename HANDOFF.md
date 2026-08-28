# KYA Service — Handoff & Operational Guidance

**Repo:** https://github.com/IcanBENCHurCAT/kya  
**Package:** `kya-service`  
**License:** AGPL-3.0  
**Constitution Version:** 3.0.0
**Architecture Version:** 2.0.0

---

## 📋 System Overview

KYA ("Know Your Agent") is a standalone, mainnet-native trust-data microservice written in TypeScript using Hono. It provides verifiable evidence and risk signals for autonomous AI agents on Algorand by combining:
1. **HTTP 402 (x402) Micro-Payment Gate**: Dynamic payment-gating for all non-health API endpoints in microALGO or ASA tokens.
2. **Algorand Box Storage Karma Ledger**: Static 77-byte packed binary box storage profiles (`k_{agent_address}`) with ARC-28 event emitters and 0.0469 ALGO MBR refundability.
3. **Multi-Source Sanctions Screening**: OFAC SDN list matching using Jaro-Winkler ($\ge 0.88$) and Levenshtein algorithms with cryptographic audit proofs.
4. **Privacy-Preserving Verification**: Ephemeral human OTP verification (email) and Groth16 Zero-Knowledge (ZK) SNARK identity proof verification (GDPR Art. 17 compliant).
5. **A2A Pre-Flight Handshake**: Machine-to-machine risk handshakes issuing Ed25519-signed W3C Verifiable Credentials.
6. **Dual SDKs**: Native TypeScript client (`sdk/`) and Python client (`python-sdk/`).

---

## ✅ Modules & Feature Implementation Status

| Module | Status | Core Implementation Files |
|--------|--------|---------------------------|
| **x402 Payment Gate** | ✅ Production-Ready | `src/middleware/x402.ts` |
| **Sanctions Screening** | ✅ Production-Ready | `src/services/screening.ts`, `src/services/ofac.ts`, `src/services/audit.ts`, `src/routes/screening.ts` |
| **Algorand Box Layout & Serializer** | ✅ Production-Ready | `src/algorand/box-layout.ts`, `src/routes/karma.ts`, `src/services/karma.ts` |
| **Human & ZK-KYC Verification** | ✅ Production-Ready | `src/verification/service.ts`, `src/services/zkp.ts`, `src/routes/zk-proof.ts` |
| **A2A Pre-Flight Engine** | ✅ Production-Ready | `src/services/a2a.ts`, `src/routes/a2a.ts` |
| **Algorand Wallet Graph** | ✅ Production-Ready | `src/algorand/client.ts`, `src/graph/walletGraph.ts`, `src/routes/wallet-analysis.ts` |
| **TypeScript SDK** | ✅ Production-Ready | `sdk/src/index.ts` |
| **Python SDK** | ✅ Production-Ready | `python-sdk/src/kya_client/client.py` |
| **Infrastructure & Deployment** | ✅ Production-Ready | `Dockerfile`, `docker-compose.yml`, `nginx.conf`, `Caddyfile`, `terraform/` |

---

## 🧪 Testing & Validation Metrics

- **Type Check (`npm run typecheck`)**: 0 errors
- **Build (`npm run build`)**: Clean `tsc` compilation to `dist/`
- **Vitest Suite (`npm test`)**: 12 test files passed, **165 passing tests**
  - `__tests__/x402.test.ts` — x402 payment gate middleware verification
  - `__tests__/box-layout.test.ts` — 77-byte static binary box encoding/decoding
  - `__tests__/karma.test.ts` — Karma calculation & event emitting
  - `__tests__/screening.test.ts` — Sanctions fuzzy screening & audit logs
  - `__tests__/attempt-store.test.ts` & `__tests__/claim-store.test.ts` — Verification stores
  - `__tests__/in-memory-claim-store.test.ts` — In-memory verification claims
  - `__tests__/zkp.test.ts` — Groth16 ZK proof verification
  - `__tests__/a2a.test.ts` — A2A handshake evaluation & W3C VC generation
  - `__tests__/walletGraph.test.ts` & `tests/wallet-analysis.test.ts` — Algorand wallet graph
  - `__tests__/deployment.test.ts` — Production readiness & deployment checks

---

## 🚀 Running the Service

```bash
# Install dependencies
npm install

# Type check
npm run typecheck

# Execute test suite
npm test

# Build
npm run build

# Start server
npm start
```

Default HTTP server listens on port `3000`. Health endpoints `/health` and `/api/v1/health` are active and un-gated.
