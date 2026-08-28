# KYA Service (Know Your Agent)

**KYA Service** — Trust Infrastructure for AI Agents — Verifiable Evidence & Risk Signals on Algorand.

---

## 🌟 Overview

KYA (Know Your Agent) provides **trust-data infrastructure providing verifiable evidence and risk signals** for autonomous AI agents. Built with TypeScript and Hono, KYA gates API access behind HTTP 402 micro-payments (microALGO or USDCa), maintains on-chain agent Karma ledgers on Algorand Box Storage, screens counterparties against global sanctions watchlists (OFAC SDN), executes machine-to-machine A2A pre-flight risk evaluation with Ed25519-signed W3C Verifiable Credentials, and verifies beneficial owners off-chain via email OTP and Groth16 Zero-Knowledge (ZK) SNARK proofs.

> **Governance & Specification:** KYA is governed by its [Constitution](.specify/memory/constitution.md) (v3.0.0) and full [End-State Architecture Specification](docs/ARCHITECTURE.md) (v2.0.0).

---

## 🚀 Key Features

- **⚡ x402 Micro-Payment Gate**: HTTP 402 Payment Required middleware gating non-health endpoints behind microALGO / ASA micro-payments with dynamic pricing and replay protection. 100% service fee → KYA operator. Protocol-level revenue distribution deferred pending legal review.
- **🔒 On-Chain Karma Ledger**: Algorand Box Storage binary profiles (`k_{agent_address}`, static 77-byte layout) tracking dynamic reputation, stake balances, and risk bitmasks with ARC-28 event logging and 0.0469 ALGO MBR refundability.
- **🛡️ Multi-Source Sanctions Screening**: OFAC SDN multi-list integration with Jaro-Winkler ($\ge 0.88$) + Levenshtein fuzzy matching and audit traceability.
- **🔐 Privacy-Preserving Identity Verification**: Off-chain OTP identity binding (Supabase / In-Memory), Ed25519 signature claims, and Groth16 Zero-Knowledge (ZK) privacy guarantees (zero PII on-chain, GDPR Art. 17 compliant).
- **🤝 A2A Pre-Flight Handshake**: Machine-to-machine pre-flight risk handshakes issuing Ed25519-signed W3C Verifiable Credential trust passports.
- **🌐 Algorand Wallet Graph & Sibling Discovery**: Algorand Indexer integration analyzing transaction history, counterparty diversity, and sibling wallet relationships.
- **🧰 Dual SDK Support**: Official client libraries for both Node.js/TypeScript (`sdk/`) and Python (`python-sdk/`).

---

## 🏗️ Architecture & Component Overview

```
                                  ┌────────────────────────────────────────────────────────┐
                                  │            Autonomous AI Agent / Client (A2A)          │
                                  └───────────────────────────┬────────────────────────────┘
                                                              │
                                                      HTTP Request + x402
                                                              │
                                                              ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                                  KYA SERVICE GATEWAY                                                     │
├──────────────────────────────┬──────────────────────────────┬──────────────────────────────┬─────────────────────────────┤
│  1. x402 Payment Gate        │  2. Sanctions Screening      │  3. Identity & Proofs        │  4. On-Chain Karma Ledger   │
│  - MicroALGO / USDCa fees    - Multi-list OFAC/EU/UN        - ZK identity attestation      - Algorand Box Storage        │
│  - 100% service fee -> oper. - Fuzzy Jaro-Winkler >= 0.88 - Zero on-chain PII (GDPR)     - ARC-28 events & indexer     │
│  - Replay protection         - Graph proximity check        - W3C Verifiable Credentials   - EigenTrust & anti-sybil     │
└──────────────────────────────┴──────────────────────────────┴──────────────────────────────┴─────────────────────────────┘
                                                              │
                                                    Anchored State Logs
                                                              │
                                                              ▼
                                               ┌─────────────────────────────┐
                                               │ Algorand Mainnet Blockchain │
                                               └─────────────────────────────┘
```

Detailed architectural diagrams and byte layouts are documented in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## 🛠️ Setup & Installation

```bash
# Clone the repository
git clone https://github.com/IcanBENCHurCAT/kya.git
cd kya

# Install dependencies
npm install

# Run TypeScript type check
npm run typecheck

# Build TypeScript to dist/
npm run build

# Execute unified Vitest test suite (165 tests across 12 files)
npm test

# Start development server with hot-reload
npm run dev

# Run in production mode
npm start
```

---

## 🔌 API Endpoints

### 1. System, Health & Bazaar Discovery
- `GET /health` — Health check endpoint (Un-gated).
- `GET /api/v1/health` — API v1 health check (Un-gated).
- `GET /.well-known/x402.json` — x402 Merchant Metadata & Endpoint Bazaar Discovery.
- `GET /.well-known/x402` — Alias for x402 Merchant Metadata.
- `GET /.well-known/agent-card.json` — A2A Agent Card capabilities manifest.

### 2. Sanctions Screening
- `POST /api/v1/screen` — Screen a single wallet address / beneficial owner.
- `POST /api/v1/screen/bulk` — Bulk screening for multiple wallets.
- `POST /api/v1/register` — Register wallet identity attestation.
- `GET  /api/v1/watchlist` — Current sanctions watchlist summary & metadata.
- `POST /api/v1/watchlist/refresh` — Refresh watchlist data.
- `GET  /api/v1/audit` — Query screening audit logs.
- `GET  /api/v1/audit/summary` — Audit log statistical breakdown.

### 3. Karma Ledger (Box Storage)
- `GET  /api/v1/karma/:address` — Get agent Karma score, tier, risk flags, and event history.
- `POST /api/v1/karma/event` — Record dynamic Karma reputation event (credit/debit/emit).

### 4. Human Verification & ZK-KYC Proofs
- `POST /api/v1/verify/email/initiate` — Initiate email OTP verification.
- `POST /api/v1/verify/email/complete` — Complete OTP verification & issue signed claim.
- `GET  /api/v1/verify/wallet/:address` — Check verification status by wallet address.
- `GET  /api/v1/verify/identity/:hash` — Check verification status by SHA-256 identity hash.
- `GET  /api/v1/verify/methods` — List available verification methods.
- `POST /api/v1/verify/zk-proof` — Submit Groth16 Zero-Knowledge identity proof.

### 5. A2A Pre-Flight Risk Handshake
- `POST /api/v1/a2a/handshake` — Pre-flight counterparty evaluation returning Ed25519-signed W3C VC passport.

### 6. Algorand Wallet Graph Analysis
- `GET  /api/v1/wallet/:address/history` — Aggregated transaction history.
- `GET  /api/v1/wallet/:address/siblings` — Sibling wallet discovery.
- `GET  /api/v1/wallet/:address/graph` — Directed counterparty graph.

---

## ⚙️ Configuration & Environment Variables

Create a `.env` file based on `.env.example`:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP server port |
| `NODE_ENV` | `development` | Node execution environment |
| `SUPABASE_URL` | — | Supabase project URL (optional, falls back to in-memory) |
| `SUPABASE_SERVICE_ROLE_KEY` | — | Supabase service role key |
| `KYA_PRIVATE_KEY` | — | Ed25519 private key for signing verification claims and VC passports |
| `KYA_KEY_ID` | `default-key` | Key identifier string for claims |
| `ALGORAND_NETWORK_URL` | `https://testnet-api.algonode.cloud` | Algorand Algod node URL |
| `ALGORAND_INDEXER_URL` | `https://testnet-indexer.algonode.cloud` | Algorand Indexer URL |
| `X402_PRICE_MICROALGO` | `1000` | Base x402 payment gate price in microALGOs |
| `KYA_TREASURY_ADDRESS` | — | Algorand wallet address receiving x402 micro-payments |

---

## 📂 Project Structure

```
kya-service/
├── .github/                    # Subagent definitions and GitHub workflows
├── .specify/                   # Spec Kit SDD templates & project Constitution (v3.0.0)
├── db/                         # Supabase PostgreSQL database migrations
├── docs/                       # Architectural specification & visual infographics
├── python-sdk/                 # Native Python client package (`kya-client`)
├── sdk/                        # Native TypeScript client package (`kya-sdk`)
├── scripts/                    # Secret management & maintenance utilities
├── specs/                      # Feature specifications & task tracking
├── src/
│   ├── app.ts                  # Main Hono application gateway entrypoint
│   ├── index.ts                # Package exports
│   ├── algorand/               # Algorand SDK client & 77-byte Box Storage layout serializer
│   ├── cache/                  # In-memory TTL cache with stats
│   ├── graph/                  # Directed wallet transaction graph
│   ├── middleware/             # x402 Payment Gate middleware
│   ├── routes/                 # Hono API domain routes (screening, wallet, karma, zk, a2a)
│   ├── services/               # Business logic services (screening, OFAC, audit, ZK verifier, A2A)
│   ├── types/                  # Shared TypeScript types and interfaces
│   ├── utils/                  # Cryptographic & utility helpers
│   └── verification/           # Human verification service & storage engines
├── terraform/                  # OCI infrastructure configuration
├── __tests__/                  # Vitest unit & integration test suites
├── tests/                      # Wallet analysis test suite
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## 📜 License

AGPL-3.0 — See [LICENSE](LICENSE) file for full text.
