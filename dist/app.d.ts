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
declare const app: Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
export { app };
