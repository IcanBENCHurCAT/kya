/**
 * KYA Sanctions Screening Service — Main Entry
 *
 * Hono HTTP server with:
 * - OFAC SDN sanctions list integration
 * - Screening endpoint (wallet → sanctions check)
 * - Audit logging
 * - Watchlist refresh mechanism
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
app.route('/api/v1', screeningApp);
app.route('/api/v1', walletAnalysisApp);
// Verify and mount verification routes after the service is ready
const PORT = parseInt(process.env.PORT || '3000', 10);
async function main() {
    console.log('🔍 KYA Service starting...\n');
    // Load audit log from disk
    loadAuditLog();
    // Initialize watchlists
    console.log('⬇️  Loading sanctions watchlists...');
    const lists = await initializeWatchlist({}, false);
    // ─── Initialize Verification Service ───────────────────────────────
    console.log('🔐 Initializing KYA verification service...');
    const dbUrl = process.env.SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    const privateKey = process.env.KYA_PRIVATE_KEY || '';
    const keyId = process.env.KYA_KEY_ID || 'default-key';
    const emailFrom = process.env.EMAIL_FROM || 'KYA Service <noreply@example.com>';
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
                // TODO: integrate with SendGrid / Resend / etc.
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
    // Start server
    const server = serve({
        fetch: app.fetch,
        port: PORT,
        hostname: '0.0.0.0',
    });
    console.log(`\n✅ KYA service running on http://0.0.0.0:${PORT}`);
    console.log(`   Endpoints:`);
    console.log(`   ── Screening ──`);
    console.log(`   - POST /api/v1/screen       — Screen a wallet address`);
    console.log(`   - POST /api/v1/screen/bulk  — Bulk screening`);
    console.log(`   - POST /api/v1/register     — Register wallet identity (KYC)`);
    console.log(`   - GET  /api/v1/audit        — Audit log`);
    console.log(`   - GET  /api/v1/audit/summary — Audit summary`);
    console.log(`   - GET  /api/v1/watchlist    — Watchlist info`);
    console.log(`   - POST /api/v1/watchlist/refresh — Refresh watchlists`);
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
main().catch(console.error);
