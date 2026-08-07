/**
 * Algorand Wallet Analysis Routes
 *
 * Endpoints:
 *   GET    /api/v1/wallet/<address>          — Wallet info + transaction summary
 *   GET    /api/v1/wallet/<address>/txs      — Transaction history
 *   GET    /api/v1/wallet/<address>/siblings — Sibling wallet discovery
 *   GET    /api/v1/wallet/<address>/graph    — Related wallets (graph query)
 *   GET    /api/v1/wallet/graph              — Full graph stats
 *   GET    /api/v1/wallet/health             — Algorand RPC health
 */
import { Hono } from 'hono';
declare const app: Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
export default app;
