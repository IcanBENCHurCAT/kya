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
import { serve } from '@hono/node-server';
import screeningApp from './routes/screening.js';
import walletAnalysisApp from './routes/wallet-analysis.js';
import karmaApp from './routes/karma.js';
import zkProofApp from './routes/zk-proof.js';
import a2aApp from './routes/a2a.js';
import { x402PaymentGate } from './middleware/x402.js';
import { createVerificationRoutes } from './routes/verification-routes.js';
import { initializeWatchlist, } from './services/watchlist-updater.js';
import { loadAuditLog } from './services/audit.js';
import { generateSigningKey } from './utils/crypto.js';
import { ClaimStore } from './verification/claim-store.js';
import { AttemptStore } from './verification/attempt-store.js';
import { InMemoryClaimStore, } from './verification/in-memory-claim-store.js';
import { InMemoryAttemptStore, } from './verification/in-memory-store.js';
import { EmailVerificationProvider } from './verification/providers/email-provider.js';
import { VerificationService } from './verification/service.js';
// Mount all apps into a single router
const app = new Hono();
// Global health check routes (exempt)
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));
app.get('/api/v1/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));
// ─── x402 Merchant Metadata & Bazaar Discovery Endpoints ───────────────
const logoUrl = 'https://raw.githubusercontent.com/IcanBENCHurCAT/kya/main/docs/kya_architecture_infographic.jpg';
const x402MetadataHandler = (c) => {
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
    let attemptStore;
    let claimStore;
    if (useInMemory) {
        console.log('  ⚠️  No DB credentials found — running in in-memory mode');
        attemptStore = new InMemoryAttemptStore();
        claimStore = new InMemoryClaimStore();
    }
    else {
        console.log('  ✅ Connected to Supabase for verification storage');
        attemptStore = new AttemptStore(dbUrl, serviceRoleKey);
        claimStore = new ClaimStore(dbUrl, serviceRoleKey);
    }
    // Generate or use existing signing key
    let signingKeyPEM;
    if (privateKey) {
        signingKeyPEM = privateKey;
    }
    else {
        console.log('  🔑 Generating ephemeral signing key (not persisted)');
        const keys = await generateSigningKey();
        signingKeyPEM = keys.privateKey;
    }
    // Set up email provider
    const emailProvider = new EmailVerificationProvider({
        attemptStore: attemptStore,
        claimStore: claimStore,
        privateKey: signingKeyPEM,
        keyId,
        sendEmail: async (to, subject, body) => {
            if (process.env.NODE_ENV === 'production') {
                console.log(`📧 Email to ${to}: ${subject}`);
            }
            else {
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
