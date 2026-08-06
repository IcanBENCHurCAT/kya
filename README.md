# KYA Sanctions Screening Service

**KYA (Know Your Agent)** — Sanctions Screening Module for blockchain wallet compliance.

## Overview

A Hono-based HTTP service that screens wallet addresses and beneficial owners against global sanctions watchlists (primarily OFAC SDN). Provides pass/fail decisions with confidence scores, audit logging, and automated watchlist updates.

## Features

- **OFAC SDN Integration** — Downloads and parses official OFAC Specially Designated Nationals list
- **Fuzzy Name Matching** — Jaro-Winkler + Levenshtein similarity for robust matching
- **Beneficial Owner Resolution** — Resolves wallets → KYC-verified owners → screening
- **Compliance Gate** — Auto-approve/approve-flag/block decisions
- **Audit Logging** — Full traceability for compliance/regulatory purposes
- **Watchlist Updates** — Periodic refresh from official sources

## Screening Decision Flow

```
Wallet Address → Check Direct Match (nationalId field)
                → Check Alias Match
                → Check Address Match
                → Check Beneficial Owner Name
                              │
                              ▼
              Confidence Score ≥ 0.85 → FAIL (BLOCK)
              Confidence Score ≥ 0.50 → FLAG (REVIEW)
              Confidence Score <  0.50 → PASS (ALLOW)
```

## Setup

```bash
# Install dependencies
npm install

# Development (hot-reload)
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Run in production
npm start
```

## API Endpoints

### Health Check
```
GET /api/v1/health
```

### Screen Wallet Address
```
POST /api/v1/screen
Content-Type: application/json

{
  "address": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  "beneficialOwner": "John Doe",  // Optional: if KYC-verified
  "force": false,                 // Optional: bypass cache
  "config": {                     // Optional: per-request config
    "failThreshold": 0.85,
    "flagThreshold": 0.5,
    "fuzzyTolerance": 0.8
  }
}

Response:
{
  "success": true,
  "result": {
    "screened": "...",
    "match": false,
    "status": "PASS",           // PASS | FAIL | FLAGGED
    "confidence": 0.0,          // 0.0 — 1.0
    "matchedEntries": [],
    "matchedListNames": [],
    "details": "No sanctions matches found",
    "timestamp": "2025-01-01T00:00:00.000Z"
  },
  "compliance": {
    "status": "PASS",
    "action": "ALLOW",          // ALLOW | REVIEW | BLOCK
    "reason": "No sanctions matches found"
  },
  "hasVerifiedOwner": true
}
```

### Bulk Screening
```
POST /api/v1/screen/bulk
Content-Type: application/json

{
  "targets": [
    { "address": "AAAA...", "beneficialOwner": "John Doe" },
    { "address": "BBBB..." }
  ],
  "config": { ... }
}

Response:
{
  "success": true,
  "results": [...],
  "summary": {
    "total": 2,
    "pass": 1,
    "fail": 0,
    "flagged": 1
  }
}
```

### Register Wallet Identity (KYC)
```
POST /api/v1/register
Content-Type: application/json

{
  "address": "AAAA...",
  "ownerName": "John Doe",
  "nationality": "US",
  "dateOfBirth": "1990-01-01",
  "verificationMethod": "email",  // email | document | biometric | blockchain
  "altAddresses": ["BBBB..."]     // Sibling/associated wallets
}
```

### Watchlist Info
```
GET /api/v1/watchlist

Response:
{
  "name": "OFAC-SDN",
  "lastUpdated": "2025-01-01",
  "totalEntries": 10000,
  "version": "2025-01-01",
  "source": "treasury.gov/ofac",
  "cached": true,
  "listBreakdown": {
    "OFAC-SDN": 10000
  }
}
```

### Refresh Watchlists
```
POST /api/v1/watchlist/refresh
Content-Type: application/json

{ "force": true }  // Optional: force network fetch

Response:
{
  "status": "success",
  "totalEntries": 10000,
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

### Audit Log
```
GET /api/v1/audit?limit=100&after=2025-01-01&result=FAIL

Response:
{
  "success": true,
  "entries": [
    {
      "id": "uuid...",
      "timestamp": "2025-01-01T00:00:00.000Z",
      "eventType": "screening",
      "walletAddress": "AAAA...",
      "result": "FAIL",
      "confidence": 1.0,
      "matchedEntries": ["Sanctioned Entity"],
      "matchedListNames": ["OFAC-SDN"],
      "screenableTarget": "AAAA...",
      "details": "Exact name match found"
    }
  ]
}
```

### Audit Summary
```
GET /api/v1/audit/summary

Response:
{
  "success": true,
  "total": 100,
  "pass": 95,
  "fail": 3,
  "flagged": 2,
  "errors": 0,
  "recentScreenings": 24
}
```

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP server port |
| `KYA_DATA_DIR` | `.` | Directory for audit/watchlist data files |

Per-request screening config (passed in request body):

| Field | Default | Description |
|-------|---------|-------------|
| `failThreshold` | 0.85 | Confidence threshold for FAIL |
| `flagThreshold` | 0.50 | Confidence threshold for FLAGGED |
| `maxResults` | 10 | Maximum match candidates |
| `fuzzyTolerance` | 0.80 | Fuzzy match similarity threshold |
| `matchAliases` | true | Enable alias matching |
| `matchNationalIds` | true | Enable national ID matching |
| `matchAddresses` | true | Enable address matching |

## Watchlist Sources

- **OFAC SDN** (primary): `https://www.treasury.gov/ofac/downloads/sdn.csv`
- **OFAC SDN JSON v2**: `https://sanctionslistservice.ofac.gov/v2/SDN.json`

## Data Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Wallet Address │────▶│  Screening       │────▶│  Compliance     │
│  + Owner Info   │     │  Engine          │     │  Gate           │
└─────────────────┘     └────────┬─────────┘     └────────┬────────┘
                                 │                         │
                          ┌──────▼──────────┐     ┌───────▼────────┐
                          │  Sanctions Lists │────▶│  Pass/Fail/    │
                          │  (OFAC SDN)      │     │  Flag Decision │
                          └──────────────────┘     └────────────────┘
                                 │
                          ┌──────▼──────────┐
                          │  Audit Log       │
                          │  (Compliance     │
                          │   Traceability)  │
                          └──────────────────┘
```

## Project Structure

```
kya-service/
├── src/
│   ├── app.ts                 # Main entry point
│   ├── routes/
│   │   └── screening.ts       # Hono API routes
│   ├── services/
│   │   ├── ofac.ts            # OFAC data download/parse
│   │   ├── screening.ts       # Fuzzy matching engine
│   │   ├── resolution.ts      # Wallet → owner resolution
│   │   ├── audit.ts           # Audit logging
│   │   └── watchlist-updater.ts  # Watchlist refresh
│   └── utils/
├── __tests__/
│   └── screening.test.ts      # Comprehensive tests
├── data/                      # Watchlists & audit log (runtime)
├── package.json
└── tsconfig.json
```

## License

AGPL-3.0 — See LICENSE file.

## Notes

- This is a screening service, not a full KYC module
- In production, connect walletIdentities to Supabase/Algorand indexer
- Watchlist updates should run via cron (recommended: every 4-6 hours)
- Audit logs are persistent (JSON file) but should be migrated to structured DB for production
