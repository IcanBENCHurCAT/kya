# KYA Service (Know Your Agent)

**KYA Service** — Trust Infrastructure for AI Agents — Verifiable Evidence & Risk Signals on Algorand.

---

## 🌟 Overview

KYA (Know Your Agent) provides **trust-data infrastructure providing verifiable evidence and risk signals** for autonomous AI agents. Built with TypeScript and Hono, KYA gates API access behind HTTP 402 micro-payments (microALGO or USDCa), maintains on-chain agent Karma ledgers on Algorand Box Storage, screens counterparties against global sanctions watchlists (OFAC SDN), and verifies beneficial human owners off-chain.

> **Governance & Specification:** KYA is governed by its [Constitution](.specify/memory/constitution.md) (v3.0.0) and full [End-State Architecture Specification](docs/ARCHITECTURE.md) (v2.0.0).

---

## 🚀 Key Features

- **⚡ x402 Micro-Payment Gate**: HTTP 402 Payment Required middleware gating non-health endpoints behind microALGO / ASA payments. 100% service fee → KYA operator. Protocol-level revenue distribution deferred pending legal review.
- **🔒 On-Chain Karma Ledger**: Algorand Box Storage binary profiles (`k_{agent_address}`) tracking dynamic reputation, stake balances, and risk bitmasks with ARC-28 event logging.
- **🛡️ Multi-Source Sanctions Screening**: OFAC SDN multi-list integration with Jaro-Winkler ($\ge 0.88$) + Levenshtein fuzzy matching and audit traceability.
- **🔐 Human Identity Verification**: Off-chain OTP identity binding (Supabase / In-Memory), Ed25519 signature claims, and Zero-Knowledge (ZK) privacy guarantees (zero PII on-chain).
- **🌐 Algorand Wallet Graph & Sibling Discovery**: Algorand Indexer integration analyzing transaction history, counterparty diversity, and sibling wallet relationships.

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

# Build TypeScript to dist/
npm run build

# Execute unified Vitest test suite
npm test

# Start development server with hot-reload
npm run dev

# Run in production mode
npm start
```

---

## 🔌 API Endpoints

### 1. System & Health
- `GET /api/v1/health` — Health check endpoint (Un-gated).

### 2. x402 Micro-Payments & Negotiation (Principle II)
- `POST /api/v1/x402/quote` — Request a payment quote for an endpoint.
- `POST /api/v1/x402/verify` — Verify transaction receipt on-chain.

### 3. Sanctions Screening
- `POST /api/v1/screen` — Screen a single wallet address / beneficial owner.
- `POST /api/v1/screen/bulk` — Bulk screening for multiple wallets.
- `GET  /api/v1/watchlist` — Current sanctions watchlist summary & metadata.
- `POST /api/v1/watchlist/refresh` — Trigger watchlist update from Treasury/OFAC sources.
- `GET  /api/v1/audit` — Query screening audit logs.
- `GET  /api/v1/audit/summary` — Audit log statistical breakdown.

### 4. Human Verification
- `POST /api/v1/verify/email/initiate` — Initiate email OTP verification.
- `POST /api/v1/verify/email/complete` — Complete OTP verification & issue signature claim.
- `GET  /api/v1/verify/wallet/:address` — Check verification status by wallet address.
- `GET  /api/v1/verify/identity/:hash` — Check verification status by SHA-256 identity hash.

### 5. Karma Ledger
- `GET  /api/v1/karma/:address` — Get agent Karma score, tier, and history.
- `POST /api/v1/karma/event` — Emit a Karma reputation event (credit/debit/emit).

### 6. Wallet Analysis
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
| `SUPABASE_SERVICE_ROLE_KEY` | — | Supabase service key |
| `KYA_PRIVATE_KEY` | — | Ed25519 private key for signing verification claims |
| `ALGORAND_NETWORK_URL` | `https://testnet-api.algonode.cloud` | Algorand Algod node URL |
| `ALGORAND_INDEXER_URL` | `https://testnet-indexer.algonode.cloud` | Algorand Indexer URL |
| `X402_PRICE_MICROALGO` | `1000` | Base x402 payment gate price in microALGOs |
| `KYA_TREASURY_ADDRESS` | — | Algorand wallet address receiving x402 micro-payments |

---

## 📂 Project Structure

```
kya-service/
├── .github/
│   └── agents/                 # Spec Kit subagent definitions
├── .specify/
│   ├── memory/
│   │   └── constitution.md     # Project Constitution (v1.2.0)
│   └── templates/              # Spec Kit SDD templates
├── docs/
│   └── ARCHITECTURE.md         # End-State Architecture Specification (v2.0.0)
├── db/
│   └── migrations/             # Supabase PostgreSQL migrations
├── src/
│   ├── app.ts                  # Main Hono application entrypoint
│   ├── index.ts                # Package exports
│   ├── algorand/               # Algorand SDK client
│   ├── cache/                  # In-memory TTL cache with stats
│   ├── graph/                  # Directed wallet transaction graph
│   ├── middleware/
│   │   └── x402.ts             # x402 Payment Gate middleware
│   ├── routes/                 # Hono API domain routes (screening, verification, karma, wallet)
│   ├── services/               # Core business services (screening, OFAC, audit, karma)
│   ├── types/                  # TypeScript interfaces & shared types
│   ├── utils/                  # Cryptographic & utility helpers
│   └── verification/           # Human verification service & stores
├── __tests__/                  # Vitest unit & integration test suites
├── tests/                      # Wallet analysis test suite
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## 📜 License

AGPL-3.0 — See [LICENSE](LICENSE) file for full text.
