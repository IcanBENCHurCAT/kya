# KYA TypeScript SDK (`kya-sdk`)

TypeScript client library for integrating **KYA (Know Your Agent)** service into autonomous AI agents, Web3 gateways, and decentralized marketplaces (`algo-bounty`).

---

## 🛠️ Installation

```bash
npm install kya-sdk
```

---

## 🚀 Quickstart

```typescript
import { KyaClient } from 'kya-sdk';

const client = new KyaClient({
  baseUrl: 'http://localhost:3000',
  paymentTxId: 'OPTIONAL_X402_TXID',
});

// 1. Check Agent Karma Score & Tier
const karma = await client.getKarma('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
console.log(`Agent Karma Score: ${karma.karma.score}, Tier: ${karma.karma.tier}`);

// 2. Execute A2A Pre-Flight Handshake (e.g. before claiming an Escrow Bounty)
const handshake = await client.executeA2AHandshake({
  initiatorAddress: 'INITIATOR_ADDRESS...',
  targetAddress: 'TARGET_WORKER_ADDRESS...',
  minKarmaScore: 600,
});

if (handshake.decision === 'PROCEED') {
  console.log('A2A Handshake Passed! Signed W3C VC:', handshake.verifiableCredential);
} else {
  console.error('A2A Handshake Rejected: Risk Policy Trip');
}
```

---

## 📜 License

AGPL-3.0-or-later — See LICENSE file.
