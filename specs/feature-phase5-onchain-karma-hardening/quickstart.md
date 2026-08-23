# Quickstart: Phase 5 On-Chain Karma Hardening & Node Deployment

---

## 1. Running the Hardened KYA Gateway

### Prerequisites
- Node.js >= 18.0.0
- Docker & Docker Compose (optional for containerized deployment)
- Algorand LocalNet / Testnet node access (optional for offline testing)

### Installation & Test Suite
```bash
# Clone and install dependencies
git clone https://github.com/IcanBENCHurCAT/kya.git
cd kya

# Run the complete test suite
npm test

# Build clean TypeScript output
npm run build
```

---

## 2. Launching a Self-Hosted Node Operator Instance

Independent community operators can host their own gateway node and capture 100% of the x402 query fees:

```bash
# Export operator payout address and network config
export KYA_TREASURY_ADDRESS="YOUR_ALGORAND_WALLET_ADDRESS"
export KYA_FAIL_CLOSED="true"
export PORT="3000"

# Launch using Docker
docker build -t kya-service .
docker run -d \
  -p 3000:3000 \
  -e KYA_TREASURY_ADDRESS="$KYA_TREASURY_ADDRESS" \
  -e KYA_FAIL_CLOSED="$KYA_FAIL_CLOSED" \
  --name kya-node \
  kya-service
```

### Validate Discovery Card
```bash
curl http://localhost:3000/.well-known/agent-card.json
```

---

## 3. Autonomous Agent Pre-Flight Check & x402 Payment Flow

```typescript
import { algosdk } from 'algosdk';

// 1. Check Node Discovery Card
const card = await fetch('https://kya-node.example.com/.well-known/agent-card.json').then(r => r.json());
console.log(`Routing query to operator: ${card.nodeOperator}, Treasury: ${card.treasuryAddress}`);

// 2. Submit Bilateral Pre-Flight Handshake with Anti-Proxying Signature
const payload = {
  initiatorAddress: myAgentAddress,
  targetAddress: counterpartyAddress,
  minKarmaScore: 600
};

const timestamp = Math.floor(Date.now() / 1000);
const nonce = crypto.randomUUID();
const signature = signAgentPayload(payload, timestamp, nonce, myPrivateKey);

const response = await fetch('https://kya-node.example.com/api/v1/a2a/handshake', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Payment': myMicroPaymentTxId,
    'X-Agent-Address': myAgentAddress,
    'X-Agent-Signature': signature,
    'X-Agent-Timestamp': timestamp.toString(),
    'X-Agent-Nonce': nonce
  },
  body: JSON.stringify(payload)
});

const credential = await response.json();
console.log(`Pre-flight Decision: ${credential.decision}, VC:`, credential.verifiableCredential);
```
