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
import { screenSanctions } from '../services/screening.js';
import { resolveWalletIdentity, registerWalletIdentity, hasVerifiedOwner } from '../services/resolution.js';
import { logScreening, getAuditLog, getAuditSummary } from '../services/audit.js';
import { refreshWatchlists, getSummary as getWatchlistSummary } from '../services/watchlist-updater.js';
const MAX_STRING_LENGTH = 255;
const app = new Hono();
/**
 * Health check endpoint.
 */
app.get('/api/v1/health', (c) => {
    return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});
/**
 * Get watchlist summary.
 */
app.get('/api/v1/watchlist', (c) => {
    const { WATCHLIST } = c.env;
    const summary = getWatchlistSummary();
    // Count entries per list
    const listBreakdown = {};
    for (const [name, entries] of Object.entries(WATCHLIST)) {
        listBreakdown[name] = entries.length;
    }
    return c.json({
        ...summary,
        listBreakdown,
        totalLists: Object.keys(WATCHLIST).length,
    });
});
/**
 * Refresh watchlists (manual trigger).
 */
app.post('/api/v1/watchlist/refresh', async (c) => {
    const { WATCHLIST } = c.env;
    const body = await c.req.json().catch(() => ({}));
    const force = body.force === true;
    const updated = await refreshWatchlists(WATCHLIST, force);
    if (!updated) {
        return c.json({ error: 'Watchlist refresh failed. Check audit log.' }, 500);
    }
    // Update the binding
    c.env.WATCHLIST = updated;
    return c.json({
        status: 'success',
        totalEntries: Object.values(updated).reduce((sum, entries) => sum + entries.length, 0),
        timestamp: new Date().toISOString(),
    });
});
/**
 * Screen a single wallet address.
 *
 * Request body:
 * {
 *   address: string,
 *   beneficialOwner?: string,    // Optional: verified owner name
 *   force?: boolean,             // Optional: bypass cache
 *   config?: Partial<ScreeningConfig> // Optional: per-request config
 * }
 */
app.post('/api/v1/screen', async (c) => {
    const { WATCHLIST, SCREENING_CONFIG } = c.env;
    const body = await c.req.json().catch(() => ({}));
    const address = body.address;
    if (typeof address !== 'string' || address.trim().length === 0 || address.length > MAX_STRING_LENGTH) {
        return c.json({ error: `Invalid address: must be a non-empty string of max ${MAX_STRING_LENGTH} characters` }, 400);
    }
    const beneficialOwner = body.beneficialOwner;
    if (beneficialOwner !== undefined && beneficialOwner !== null) {
        if (typeof beneficialOwner !== 'string' || beneficialOwner.length > MAX_STRING_LENGTH) {
            return c.json({ error: `Invalid beneficialOwner: must be a string of max ${MAX_STRING_LENGTH} characters` }, 400);
        }
    }
    const config = { ...SCREENING_CONFIG, ...body.config };
    // Check if wallet has a verified owner
    let resolvedOwner = beneficialOwner;
    if (!resolvedOwner && hasVerifiedOwner(address)) {
        const identity = resolveWalletIdentity(address);
        if (identity?.verifiedOwner) {
            resolvedOwner = identity.verifiedOwner.name;
        }
    }
    // Run screening
    const result = screenSanctions(address, resolvedOwner, WATCHLIST, config);
    // Log to audit
    logScreening(result);
    // Add compliance flag
    const screeningResult = {
        status: result.status,
        recommendation: result.status === 'POTENTIAL_MATCH' ? 'ESCALATE' : result.status === 'MATCH_REQUIRES_REVIEW' ? 'REVIEW' : 'NO_ACTION_REQUIRED',
        reason: result.details,
    };
    return c.json({
        success: true,
        result,
        screeningResult,
        hasVerifiedOwner: !!resolvedOwner,
    });
});
/**
 * Screen multiple wallet addresses (bulk).
 *
 * Request body:
 * {
 *   targets: [
 *     { address: string, beneficialOwner?: string },
 *     ...
 *   ],
 *   config?: Partial<ScreeningConfig>
 * }
 */
app.post('/api/v1/screen/bulk', async (c) => {
    const { WATCHLIST, SCREENING_CONFIG } = c.env;
    const body = await c.req.json();
    const targets = body.targets;
    if (!Array.isArray(targets) || targets.length === 0) {
        return c.json({ error: 'targets array is required and must be non-empty' }, 400);
    }
    if (targets.length > 100) {
        return c.json({ error: 'Maximum 100 targets per request' }, 400);
    }
    for (const t of targets) {
        if (!t || typeof t.address !== 'string' || t.address.trim().length === 0 || t.address.length > MAX_STRING_LENGTH) {
            return c.json({ error: `Invalid target address: must be a non-empty string of max ${MAX_STRING_LENGTH} characters` }, 400);
        }
        if (t.beneficialOwner !== undefined && t.beneficialOwner !== null && (typeof t.beneficialOwner !== 'string' || t.beneficialOwner.length > MAX_STRING_LENGTH)) {
            return c.json({ error: `Invalid target beneficialOwner: must be a string of max ${MAX_STRING_LENGTH} characters` }, 400);
        }
    }
    const config = { ...SCREENING_CONFIG, ...body.config };
    // Resolve beneficial owners for each target
    const resolvedTargets = targets.map(t => {
        let owner = t.beneficialOwner;
        if (!owner && hasVerifiedOwner(t.address)) {
            const identity = resolveWalletIdentity(t.address);
            if (identity?.verifiedOwner) {
                owner = identity.verifiedOwner.name;
            }
        }
        return { address: t.address, beneficialOwner: owner };
    });
    // Run screening for each target
    const results = resolvedTargets.map(t => {
        const result = screenSanctions(t.address, t.beneficialOwner, WATCHLIST, config);
        logScreening(result);
        return {
            address: t.address,
            result,
            screeningResult: {
                status: result.status,
                recommendation: result.status === 'POTENTIAL_MATCH' ? 'ESCALATE' : result.status === 'MATCH_REQUIRES_REVIEW' ? 'REVIEW' : 'NO_ACTION_REQUIRED',
                reason: result.details,
            },
        };
    });
    // Count by status
    const summary = {
        total: results.length,
        noMatchFound: results.filter(r => r.screeningResult.status === 'NO_MATCH_FOUND').length,
        potentialMatch: results.filter(r => r.screeningResult.status === 'POTENTIAL_MATCH').length,
        requiresReview: results.filter(r => r.screeningResult.status === 'MATCH_REQUIRES_REVIEW').length,
    };
    return c.json({ success: true, results, summary });
});
/**
 * Get audit log.
 *
 * Query params:
 *   limit: number (default 100)
 *   after: ISO timestamp
 *   before: ISO timestamp
 *   result: NO_MATCH_FOUND | POTENTIAL_MATCH | MATCH_REQUIRES_REVIEW | ERROR
 */
app.get('/api/v1/audit', (c) => {
    const limit = parseInt(c.req.query('limit') || '100', 10);
    const after = c.req.query('after');
    const before = c.req.query('before');
    const result = c.req.query('result');
    const entries = getAuditLog({ limit: limit || 100, after, before, result });
    return c.json({ success: true, entries });
});
/**
 * Get audit summary stats.
 */
app.get('/api/v1/audit/summary', (c) => {
    const stats = getAuditSummary();
    return c.json({ success: true, ...stats });
});
/**
 * Register a wallet identity (for identity attestation/verification).
 *
 * Request body:
 * {
 *   address: string,
 *   ownerName: string,
 *   nationality?: string,
 *   dateOfBirth?: string,
 *   verificationMethod?: string,
 *   altAddresses?: string[]
 * }
 */
app.post('/api/v1/register', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const address = body.address;
    const ownerName = body.ownerName;
    if (typeof address !== 'string' || address.trim().length === 0 || address.length > MAX_STRING_LENGTH) {
        return c.json({ error: `Invalid address: must be a non-empty string of max ${MAX_STRING_LENGTH} characters` }, 400);
    }
    if (typeof ownerName !== 'string' || ownerName.trim().length === 0 || ownerName.length > MAX_STRING_LENGTH) {
        return c.json({ error: `Invalid ownerName: must be a non-empty string of max ${MAX_STRING_LENGTH} characters` }, 400);
    }
    const identity = registerWalletIdentity(address, ownerName, {
        nationality: body.nationality,
        dateOfBirth: body.dateOfBirth,
        verificationMethod: body.verificationMethod,
        altAddresses: body.altAddresses,
    });
    return c.json({ success: true, identity });
});
export default app;
