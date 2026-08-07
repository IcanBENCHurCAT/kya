/**
 * Screening API Routes
 *
 * Hono routes for the sanctions screening endpoint.
 *
 * Endpoints:
 *   POST /api/v1/screen — Screen a wallet address
 *   POST /api/v1/screen/bulk — Screen multiple addresses
 *   GET  /api/v1/audit — Get audit log
 *   GET  /api/v1/audit/summary — Get audit summary
 *   GET  /api/v1/watchlist — Watchlist info
 *   POST /api/v1/watchlist/refresh — Refresh watchlists
 *   GET  /api/v1/health — Health check
 */
import { Hono } from 'hono';
import { type ScreeningConfig } from '../services/screening.js';
import { type ListRegistry } from '../services/watchlist-updater.js';
export interface AppBindings {
    WATCHLIST: ListRegistry;
    SCREENING_CONFIG?: Partial<ScreeningConfig>;
}
declare const app: Hono<{
    Bindings: AppBindings;
}, import("hono/types").BlankSchema, "/">;
export default app;
