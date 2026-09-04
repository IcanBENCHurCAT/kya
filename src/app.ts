/**
 * KYA Sanctions Screening Service — Main Entry
 *
 * Hono HTTP server with:
 * - OFAC SDN sanctions list integration
 * - Screening endpoint (wallet → sanctions check)
 * - Audit logging
 * - Watchlist refresh mechanism
 * - x402 Payment Gate middleware
 * - Karma Ledger routes
 *
 * Usage:
 *   npm install
 *   npm run dev      # Development with hot-reload
 *   npm run build    # Compile to dist/
 *   npm start        # Run in production
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import screeningApp from './routes/screening.js';
import walletAnalysisApp from './routes/wallet-analysis.js';
import karmaApp from './routes/karma.js';
import zkProofApp from './routes/zk-proof.js';
import a2aApp from './routes/a2a.js';
import { x402PaymentGate } from './middleware/x402.js';
import { createVerificationRoutes } from './routes/verification-routes.js';
import {
  initializeWatchlist,
} from './services/watchlist-updater.js';
import { loadAuditLog } from './services/audit.js';
import { generateSigningKey } from './utils/crypto.js';
import { ClaimStore } from './verification/claim-store.js';
import { AttemptStore } from './verification/attempt-store.js';
import {
  InMemoryClaimStore,
} from './verification/in-memory-claim-store.js';
import {
  InMemoryAttemptStore,
} from './verification/in-memory-store.js';
import { EmailVerificationProvider } from './verification/providers/email-provider.js';
import { VerificationService } from './verification/service.js';

// Mount all apps into a single router
const app = new Hono();

// Apply CORS middleware globally
app.use('*', cors());

// Global health check routes (exempt)
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));
app.get('/api/v1/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Root developer landing page
app.get('/', (c) => {
  if (c.req.header('accept')?.includes('application/json')) {
    return c.json({ name: 'KYA Service — Trust Infrastructure for AI Agents', status: 'ok', discovery: { x402: '/.well-known/x402.json', agentCard: '/.well-known/agent-card.json', health: '/health' } });
  }
  return c.html(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>KYA Service</title><style>
body{font-family:system-ui,-apple-system,sans-serif;background:#0f172a;color:#f8fafc;margin:0;padding:2rem 1rem;line-height:1.5}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border-width:0}
.sr-only:focus{position:static;width:auto;height:auto;padding:.5rem;background:#38bdf8;color:#0f172a;font-weight:600;border-radius:.25rem;display:inline-block;margin-bottom:1rem}
main{max-width:680px;margin:0 auto;background:#1e293b;padding:2rem;border-radius:.75rem;border:1px solid #334155}
h1{color:#38bdf8;margin:0 0 .5rem;display:flex;align-items:center;justify-content:space-between;font-size:1.5rem}a{color:#38bdf8;text-decoration:none;font-weight:500}a:hover{text-decoration:underline}
a:focus-visible,button:focus-visible{outline:2px solid #38bdf8;outline-offset:3px;border-radius:.25rem}
.badge{background:#166534;color:#4ade80;font-size:.75rem;padding:.2rem .5rem;border-radius:99px;font-weight:600}
ul{padding-left:1.25rem}li{margin-bottom:.5rem}
.code-box{background:#0f172a;padding:.75rem 1rem;border-radius:.5rem;border:1px solid #334155;display:flex;align-items:center;justify-content:space-between;gap:.5rem}
.copy-btn{background:#334155;color:#f8fafc;border:none;padding:.35rem .75rem;border-radius:.375rem;cursor:pointer;font-size:.75rem;font-weight:500;white-space:nowrap;transition:background 0.15s ease}
.copy-btn:hover{background:#475569}
footer{margin-top:1.5rem;border-top:1px solid #334155;padding-top:1rem;color:#94a3b8;font-size:.875rem}
</style></head><body><a href="#main-content" class="sr-only">Skip to main content</a><main id="main-content"><header><h1>KYA Service <span class="badge" role="status" aria-label="System status: Operational">● Operational</span></h1><p>Trust Infrastructure for AI Agents — On-chain Karma, ZK Identity & Sanctions Screening.</p></header>
<section aria-label="Discovery & System Links"><h2 style="font-size:1.1rem;color:#94a3b8">Discovery Links</h2><ul><li><a href="/health" aria-label="View health check status">/health</a> — Service Health & Timestamp</li><li><a href="/.well-known/x402.json" aria-label="View x402 merchant discovery metadata">/.well-known/x402.json</a> — x402 Merchant Metadata</li><li><a href="/.well-known/agent-card.json" aria-label="View A2A Agent Card manifest">/.well-known/agent-card.json</a> — Agent Card Capabilities Manifest</li></ul></section>
<section aria-label="Quick Start API Example"><h2 style="font-size:1.1rem;color:#94a3b8;margin-top:1.5rem">Quick Start Command</h2><div class="code-box"><code id="curl-cmd" style="color:#e2e8f0;font-size:.875rem;word-break:break-all">curl -s /health</code><button id="copy-btn" onclick="copyCmd()" aria-label="Copy cURL health check command" class="copy-btn">Copy</button></div><div id="copy-status" class="sr-only" aria-live="polite"></div></section>
<footer><p>Protected by x402 micro-payments on Algorand. Built with Hono & TypeScript.</p></footer></main><script>function copyCmd(){var cmd=document.getElementById('curl-cmd')?document.getElementById('curl-cmd').innerText:'';var btn=document.getElementById('copy-btn');var status=document.getElementById('copy-status');if(!navigator.clipboard||!navigator.clipboard.writeText){if(btn){btn.innerText='Failed';setTimeout(function(){btn.innerText='Copy';},2000);}if(status){status.innerText='Failed to copy command to clipboard';}return;}navigator.clipboard.writeText(cmd).then(function(){if(btn){btn.innerText='Copied!';setTimeout(function(){btn.innerText='Copy';},2000);}if(status){status.innerText='Command copied to clipboard';}}).catch(function(){if(btn){btn.innerText='Failed';setTimeout(function(){btn.innerText='Copy';},2000);}if(status){status.innerText='Failed to copy command to clipboard';}});}</script></body></html>`);
});

// ─── x402 Merchant Metadata & Bazaar Discovery Endpoints ───────────────
const logoUrl = 'https://raw.githubusercontent.com/IcanBENCHurCAT/kya/main/docs/kya_architecture_infographic.jpg';

const x402MetadataHandler = (c: any) => {
  c.header('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  const host = c.req.header('host') || 'kya-service.duckdns.org';
  const baseUrl = host.includes('http') ? host : `https://${host}`;

  return c.json({
    merchant: {
      name: 'KYA Service — Trust Infrastructure for AI Agents',
      description: 'On-chain Karma reputation ledgers, pre-flight A2A risk handshakes, zero-knowledge identity assertions, and multi-source sanctions screening gated by x402 micro-payments.',
      icon: logoUrl,
      image: logoUrl,
      iconUrl: logoUrl,
      icon_url: logoUrl,
      avatar: logoUrl,
      avatarUrl: logoUrl,
      contact: 'support@kya.network',
    },
    image: logoUrl,
    icon: logoUrl,
    resources: [
      {
        path: '/api/v1/karma/:address',
        url: `${baseUrl}/api/v1/karma/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`,
        description: 'Query agent Karma score, tier, risk flags, and event history.',
        methods: ['GET'],
        networks: ['algorand:mainnet', 'algorand:testnet'],
        tag: 'x402-global-challenge',
      },
      {
        path: '/api/v1/a2a/handshake',
        url: `${baseUrl}/api/v1/a2a/handshake`,
        description: 'Execute machine-to-machine pre-flight risk evaluation and issue Ed25519-signed W3C Verifiable Credentials.',
        methods: ['POST'],
        networks: ['algorand:mainnet', 'algorand:testnet'],
        tag: 'x402-global-challenge',
      },
      {
        path: '/api/v1/verify/zk-proof',
        url: `${baseUrl}/api/v1/verify/zk-proof`,
        description: 'Submit Groth16 Zero-Knowledge identity proof payloads (zero PII on-chain).',
        methods: ['POST'],
        networks: ['algorand:mainnet', 'algorand:testnet'],
        tag: 'x402-global-challenge',
      },
      {
        path: '/api/v1/screen',
        url: `${baseUrl}/api/v1/screen`,
        description: 'Screen wallet address or beneficial owner identity against sanctions watchlists.',
        methods: ['POST'],
        networks: ['algorand:mainnet', 'algorand:testnet'],
        tag: 'x402-global-challenge',
      },
    ],
  });
};

app.get('/.well-known/x402.json', x402MetadataHandler);
app.get('/.well-known/x402', x402MetadataHandler);

app.get('/.well-known/agent-card.json', (c) => {
  c.header('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  const host = c.req.header('host') || 'kya-service.duckdns.org';
  const baseUrl = host.includes('http') ? host : `https://${host}`;

  return c.json({
    name: 'KYA Service — Trust Infrastructure for AI Agents',
    description: 'On-chain Karma reputation ledgers, pre-flight A2A risk handshakes, zero-knowledge identity assertions, and multi-source sanctions screening gated by x402 micro-payments.',
    icon: logoUrl,
    image: logoUrl,
    iconUrl: logoUrl,
    avatarUrl: logoUrl,
    version: '1.0.0',
    url: baseUrl,
    supportedInterfaces: [
      {
        url: `${baseUrl}/api/v1/karma/{address}`,
        protocolBinding: 'HTTP',
        protocolVersion: '1.1',
      },
      {
        url: `${baseUrl}/api/v1/a2a/handshake`,
        protocolBinding: 'HTTP',
        protocolVersion: '1.1',
      },
      {
        url: `${baseUrl}/api/v1/verify/zk-proof`,
        protocolBinding: 'HTTP',
        protocolVersion: '1.1',
      },
      {
        url: `${baseUrl}/api/v1/screen`,
        protocolBinding: 'HTTP',
        protocolVersion: '1.1',
      },
    ],
    capabilities: {
      streaming: false,
      pushNotifications: false,
    },
    defaultInputModes: ['application/json'],
    defaultOutputModes: ['application/json'],
    skills: [
      {
        id: 'kya_karma_query',
        name: 'Query Agent Karma Profile',
        description: 'Query dynamic agent reputation score, risk flags, and event history.',
        tags: ['reputation', 'karma', 'ai-agents', 'x402-global-challenge'],
        examples: ['Get karma score for agent address AAAA...'],
      },
      {
        id: 'kya_a2a_handshake',
        name: 'Execute A2A Risk Handshake',
        description: 'Execute pre-flight risk evaluation and retrieve signed W3C Verifiable Credential trust passport.',
        tags: ['a2a', 'trust', 'passport', 'x402-global-challenge'],
        examples: ['Run A2A handshake before dispatching bounty payment to target agent.'],
      },
      {
        id: 'kya_zk_proof',
        name: 'Submit ZK Identity Proof',
        description: 'Submit Groth16 Zero-Knowledge identity proof to upgrade verification tier without revealing PII.',
        tags: ['zkp', 'privacy', 'identity', 'x402-global-challenge'],
        examples: ['Submit Groth16 zk-SNARK proof payload.'],
      },
      {
        id: 'kya_sanctions_screening',
        name: 'Screen Wallet Sanctions',
        description: 'Screen wallet address or beneficial owner against OFAC SDN sanctions watchlists.',
        tags: ['ofac', 'sanctions', 'screening', 'x402-global-challenge'],
        examples: ['Screen wallet address AAAA... against sanctions list.'],
      },
    ],
  });
});

// Mount x402 payment gate over /api/v1/*
const defaultEscrowWallet = 'W5IRXJWPSXNUJVSN2MOEJGTDGKUGFKUDVPTR5ZQVMDG5O4KYD5M3QPG3TE';
const configuredReceiver = process.env.KYA_TREASURY_ADDRESS || process.env.ESCROW_ADDRESS || defaultEscrowWallet;
app.use('/api/v1/*', x402PaymentGate({ priceMicroAlgo: 1000, receiverAddress: configuredReceiver, tag: 'x402-global-challenge' }));

app.route('/api/v1', screeningApp);
app.route('/api/v1', walletAnalysisApp);
app.route('/api/v1', karmaApp);
app.route('/api/v1', zkProofApp);
app.route('/api/v1', a2aApp);

const PORT = parseInt(process.env.PORT || '3000', 10);

async function main() {
  console.log('🔍 KYA Service starting...\n');

  // Start HTTP server immediately so health checks pass without delay
  const server = serve({
    fetch: app.fetch,
    port: PORT,
    hostname: '0.0.0.0',
  });

  // Load audit log from disk
  loadAuditLog();

  // ─── Initialize Verification Service ───────────────────────────────
  console.log('🔐 Initializing KYA verification service...');

  const dbUrl = process.env.SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const privateKey = process.env.KYA_PRIVATE_KEY || '';
  const keyId = process.env.KYA_KEY_ID || 'default-key';
  const useInMemory = !dbUrl || !serviceRoleKey || !privateKey;

  let attemptStore: AttemptStore | InMemoryAttemptStore;
  let claimStore: ClaimStore | InMemoryClaimStore;

  if (useInMemory) {
    console.log('  ⚠️  No DB credentials found — running in in-memory mode');
    attemptStore = new InMemoryAttemptStore();
    claimStore = new InMemoryClaimStore();
  } else {
    console.log('  ✅ Connected to Supabase for verification storage');
    attemptStore = new AttemptStore(dbUrl, serviceRoleKey);
    claimStore = new ClaimStore(dbUrl, serviceRoleKey);
  }

  // Generate or use existing signing key
  let signingKeyPEM: string;
  if (privateKey) {
    signingKeyPEM = privateKey;
  } else {
    console.log('  🔑 Generating ephemeral signing key (not persisted)');
    const keys = await generateSigningKey();
    signingKeyPEM = keys.privateKey;
  }

  // Set up email provider
  const emailProvider = new EmailVerificationProvider({
    attemptStore: attemptStore as AttemptStore,
    claimStore: claimStore as ClaimStore,
    privateKey: signingKeyPEM,
    keyId,
    sendEmail: async (to, subject, body) => {
      if (process.env.NODE_ENV === 'production') {
        console.log(`📧 Email to ${to}: ${subject}`);
      } else {
        console.log(`📧 Email to ${to}: ${subject} — ${body}`);
      }
    },
  });

  // Initialize verification service
  const verificationService = new VerificationService({
    databaseUrl: dbUrl,
    serviceRoleKey,
    privateKey: signingKeyPEM,
    keyId,
    defaultProvider: emailProvider,
  });

  // Mount verification routes
  const verificationRoutes = createVerificationRoutes(verificationService);
  app.route('/api/v1/verify', verificationRoutes);

  // Initialize watchlists asynchronously
  console.log('⬇️  Loading sanctions watchlists...');
  initializeWatchlist({}, false).catch((err) => console.error('Watchlist init error:', err));


  console.log(`\n✅ KYA service running on http://0.0.0.0:${PORT}`);
  console.log(`   Endpoints:`);
  console.log(`   ── Screening ──`);
  console.log(`   - POST /api/v1/screen       — Screen a wallet address`);
  console.log(`   - POST /api/v1/screen/bulk  — Bulk screening`);
  console.log(`   - POST /api/v1/register     — Register wallet identity attestation`);
  console.log(`   - GET  /api/v1/audit        — Audit log`);
  console.log(`   - GET  /api/v1/audit/summary — Audit summary`);
  console.log(`   - GET  /api/v1/watchlist    — Watchlist info`);
  console.log(`   - POST /api/v1/watchlist/refresh — Refresh watchlists`);
  console.log(`   ── Karma Ledger ──`);
  console.log(`   - GET  /api/v1/karma/:address — Query agent karma score & history`);
  console.log(`   - POST /api/v1/karma/event  — Record karma credit/debit event`);
  console.log(`   ── Human Verification ──`);
  console.log(`   - POST /api/v1/verify/email/initiate   — Start email OTP verification`);
  console.log(`   - POST /api/v1/verify/email/complete   — Complete email OTP verification`);
  console.log(`   - GET  /api/v1/verify/wallet/:address  — Check verification status`);
  console.log(`   - GET  /api/v1/verify/identity/:hash   — Check by identity hash`);
  console.log(`   - GET  /api/v1/verify/methods          — List available methods`);
  console.log(`   - GET  /api/v1/health                  — Health check\n`);

  server.on('listening', () => {
    console.log('Server is ready to accept connections.');
  });

  server.on('error', (err) => {
    console.error('Server error:', err);
  });
}

if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  main().catch(console.error);
}

export { app };
