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

import { serve } from '@hono/node-server';
import app from './routes/screening.js';
import { initializeWatchlist } from './services/watchlist-updater.js';
import { loadAuditLog } from './services/audit.js';
import { seedTestData } from './services/resolution.js';

const PORT = parseInt(process.env.PORT || '3000', 10);

async function main() {
  console.log('🔍 KYA Sanctions Screening Service starting...\n');

  // Load audit log from disk
  loadAuditLog();

  // Initialize watchlists
  console.log('⬇️  Loading sanctions watchlists...');
  const lists = await initializeWatchlist({}, false);

  // Seed test data
  seedTestData();

  // Start server
  const server = serve({
    fetch: app.fetch,
    port: PORT,
    hostname: '0.0.0.0',
  });

  console.log(`\n✅ Sanctions screening service running on http://0.0.0.0:${PORT}`);
  console.log(`   Endpoints:`);
  console.log(`   - POST /api/v1/screen       — Screen a wallet address`);
  console.log(`   - POST /api/v1/screen/bulk  — Bulk screening`);
  console.log(`   - POST /api/v1/register     — Register wallet identity (KYC)`);
  console.log(`   - GET  /api/v1/audit        — Audit log`);
  console.log(`   - GET  /api/v1/audit/summary — Audit summary`);
  console.log(`   - GET  /api/v1/watchlist    — Watchlist info`);
  console.log(`   - POST /api/v1/watchlist/refresh — Refresh watchlists`);
  console.log(`   - GET  /api/v1/health       — Health check\n`);

  server.on('listening', () => {
    console.log('Server is ready to accept connections.');
  });

  server.on('error', (err) => {
    console.error('Server error:', err);
  });
}

main().catch(console.error);
