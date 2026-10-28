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
import { Hono } from "hono";
import { isValidAddress } from "algosdk";
import { screenSanctions, } from "../services/screening.js";
import { resolveWalletIdentity, registerWalletIdentity, } from "../services/resolution.js";
import { logScreening, getAuditLog, getAuditSummary, } from "../services/audit.js";
import { refreshWatchlists, getSummary as getWatchlistSummary, } from "../services/watchlist-updater.js";
const MAX_STRING_LENGTH = 255;
const app = new Hono();
/**
 * Security: Validate and bound request screening configuration overrides to prevent
 * threshold manipulation attacks or malformed parameters from bypassing sanctions screening.
 */
function validateScreeningConfig(config) {
    if (config === undefined || config === null)
        return null;
    if (typeof config !== "object" || Array.isArray(config)) {
        return "Invalid config: must be a plain object";
    }
    const cfg = config;
    const numFields = ["failThreshold", "flagThreshold", "fuzzyTolerance"];
    for (const f of numFields) {
        if (cfg[f] !== undefined &&
            (typeof cfg[f] !== "number" ||
                !Number.isFinite(cfg[f]) ||
                cfg[f] < 0 ||
                cfg[f] > 1)) {
            return `Invalid config: ${f} must be a number between 0 and 1`;
        }
    }
    if (cfg.maxResults !== undefined &&
        (typeof cfg.maxResults !== "number" ||
            !Number.isInteger(cfg.maxResults) ||
            cfg.maxResults < 1 ||
            cfg.maxResults > 100)) {
        return "Invalid config: maxResults must be an integer between 1 and 100";
    }
    const boolFields = [
        "matchAliases",
        "matchNationalIds",
        "matchAddresses",
        "fuzzyMatch",
    ];
    for (const f of boolFields) {
        if (cfg[f] !== undefined && typeof cfg[f] !== "boolean") {
            return `Invalid config: ${f} must be a boolean`;
        }
    }
    return null;
}
/**
 * Health check endpoint.
 */
app.get("/api/v1/health", (c) => {
    return c.json({ status: "ok", timestamp: new Date().toISOString() });
});
/**
 * Get watchlist summary.
 */
app.get("/api/v1/watchlist", (c) => {
    const { WATCHLIST } = c.env || {};
    const watchlist = WATCHLIST || {};
    const summary = getWatchlistSummary();
    // Performance optimization: Single pass over list keys avoids allocating intermediate [key, value]
    // tuple arrays via Object.entries and eliminates redundant Object.keys array allocations for total count.
    const listNames = Object.keys(watchlist);
    const listBreakdown = {};
    for (let i = 0; i < listNames.length; i++) {
        const name = listNames[i];
        listBreakdown[name] = watchlist[name].length;
    }
    return c.json({
        ...summary,
        listBreakdown,
        totalLists: listNames.length,
    });
});
/**
 * Refresh watchlists (manual trigger).
 */
app.post("/api/v1/watchlist/refresh", async (c) => {
    const { WATCHLIST } = c.env || {};
    const watchlist = WATCHLIST || {};
    const body = (await c.req.json().catch(() => ({}))) || {};
    const force = body.force === true;
    const updated = await refreshWatchlists(watchlist, force);
    if (!updated) {
        return c.json({ error: "Watchlist refresh failed. Check audit log." }, 500);
    }
    // Update the binding if env exists
    if (c.env) {
        c.env.WATCHLIST = updated;
    }
    // Performance optimization: Direct loop over list keys avoids allocating an intermediate array of all values
    // via Object.values and eliminates Array.prototype.reduce function call overhead.
    let totalEntries = 0;
    const updatedKeys = Object.keys(updated);
    for (let i = 0; i < updatedKeys.length; i++) {
        totalEntries += updated[updatedKeys[i]].length;
    }
    return c.json({
        status: "success",
        totalEntries,
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
app.post("/api/v1/screen", async (c) => {
    const { WATCHLIST, SCREENING_CONFIG } = c.env || {};
    const watchlist = WATCHLIST || {};
    const body = (await c.req.json().catch(() => ({}))) || {};
    const address = body.address;
    if (typeof address !== "string" ||
        address.trim().length === 0 ||
        address.length > MAX_STRING_LENGTH ||
        !isValidAddress(address)) {
        return c.json({ error: `Invalid address: must be a valid Algorand wallet address` }, 400);
    }
    const beneficialOwner = body.beneficialOwner;
    if (beneficialOwner !== undefined && beneficialOwner !== null) {
        if (typeof beneficialOwner !== "string" ||
            beneficialOwner.length > MAX_STRING_LENGTH) {
            return c.json({
                error: `Invalid beneficialOwner: must be a string of max ${MAX_STRING_LENGTH} characters`,
            }, 400);
        }
    }
    if (body.config !== undefined && body.config !== null) {
        const configErr = validateScreeningConfig(body.config);
        if (configErr) {
            return c.json({ error: configErr }, 400);
        }
    }
    const config = { ...SCREENING_CONFIG, ...body.config };
    // Check if wallet has a verified owner
    // Performance optimization: Call resolveWalletIdentity directly to avoid redundant hasVerifiedOwner Map lookups.
    let resolvedOwner = beneficialOwner;
    if (!resolvedOwner) {
        const identity = resolveWalletIdentity(address);
        if (identity?.verifiedOwner) {
            resolvedOwner = identity.verifiedOwner.name;
        }
    }
    // Run screening
    const result = screenSanctions(address, resolvedOwner, watchlist, config);
    // Log to audit
    logScreening(result);
    // Add compliance flag
    const screeningResult = {
        status: result.status,
        recommendation: result.status === "POTENTIAL_MATCH"
            ? "ESCALATE"
            : result.status === "MATCH_REQUIRES_REVIEW"
                ? "REVIEW"
                : "NO_ACTION_REQUIRED",
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
app.post("/api/v1/screen/bulk", async (c) => {
    const { WATCHLIST, SCREENING_CONFIG } = c.env || {};
    const watchlist = WATCHLIST || {};
    const body = (await c.req.json().catch(() => ({}))) || {};
    const targets = body.targets;
    if (!Array.isArray(targets) || targets.length === 0) {
        return c.json({ error: "targets array is required and must be non-empty" }, 400);
    }
    if (targets.length > 100) {
        return c.json({ error: "Maximum 100 targets per request" }, 400);
    }
    for (const t of targets) {
        if (!t ||
            typeof t.address !== "string" ||
            t.address.trim().length === 0 ||
            t.address.length > MAX_STRING_LENGTH ||
            !isValidAddress(t.address)) {
            return c.json({
                error: `Invalid target address: must be a valid Algorand wallet address`,
            }, 400);
        }
        if (t.beneficialOwner !== undefined &&
            t.beneficialOwner !== null &&
            (typeof t.beneficialOwner !== "string" ||
                t.beneficialOwner.length > MAX_STRING_LENGTH)) {
            return c.json({
                error: `Invalid target beneficialOwner: must be a string of max ${MAX_STRING_LENGTH} characters`,
            }, 400);
        }
    }
    if (body.config !== undefined && body.config !== null) {
        const configErr = validateScreeningConfig(body.config);
        if (configErr) {
            return c.json({ error: configErr }, 400);
        }
    }
    const config = { ...SCREENING_CONFIG, ...body.config };
    // Performance optimization: Single-pass consolidation over targets array.
    // Resolves beneficial owner, executes screening, logs audit event, constructs result payload,
    // and aggregates status counts in a single pass with a pre-allocated array (new Array(targets.length)).
    // Eliminates intermediate resolvedTargets array, temporary target objects, and post-pass counting loops.
    const targetCount = targets.length;
    const results = new Array(targetCount);
    let noMatchFound = 0;
    let potentialMatch = 0;
    let requiresReview = 0;
    for (let i = 0; i < targetCount; i++) {
        const t = targets[i];
        let owner = t.beneficialOwner;
        if (!owner) {
            const identity = resolveWalletIdentity(t.address);
            if (identity?.verifiedOwner) {
                owner = identity.verifiedOwner.name;
            }
        }
        const result = screenSanctions(t.address, owner, watchlist, config);
        logScreening(result);
        const status = result.status;
        if (status === "NO_MATCH_FOUND") {
            noMatchFound++;
        }
        else if (status === "POTENTIAL_MATCH") {
            potentialMatch++;
        }
        else if (status === "MATCH_REQUIRES_REVIEW") {
            requiresReview++;
        }
        results[i] = {
            address: t.address,
            result,
            screeningResult: {
                status,
                recommendation: status === "POTENTIAL_MATCH"
                    ? "ESCALATE"
                    : status === "MATCH_REQUIRES_REVIEW"
                        ? "REVIEW"
                        : "NO_ACTION_REQUIRED",
                reason: result.details,
            },
        };
    }
    const summary = {
        total: targetCount,
        noMatchFound,
        potentialMatch,
        requiresReview,
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
app.get("/api/v1/audit", (c) => {
    // Security: Sanitize and bound limit query parameter to prevent negative array slice offsets or DoS
    const limitParam = c.req.query("limit");
    let limit = 100;
    if (limitParam !== undefined) {
        if (typeof limitParam !== "string" ||
            limitParam.length > MAX_STRING_LENGTH) {
            return c.json({ error: "Invalid limit parameter: string exceeds maximum length" }, 400);
        }
        const parsed = parseInt(limitParam, 10);
        if (isNaN(parsed) || parsed <= 0) {
            return c.json({ error: "Invalid limit parameter: must be a positive integer" }, 400);
        }
        limit = Math.min(parsed, 1000);
    }
    const after = c.req.query("after");
    const before = c.req.query("before");
    const result = c.req.query("result");
    if (after !== undefined &&
        (typeof after !== "string" || after.length > MAX_STRING_LENGTH)) {
        return c.json({ error: "Invalid after parameter: string exceeds maximum length" }, 400);
    }
    if (before !== undefined &&
        (typeof before !== "string" || before.length > MAX_STRING_LENGTH)) {
        return c.json({ error: "Invalid before parameter: string exceeds maximum length" }, 400);
    }
    if (result !== undefined &&
        (typeof result !== "string" ||
            result.length > MAX_STRING_LENGTH ||
            !["NO_MATCH_FOUND", "POTENTIAL_MATCH", "MATCH_REQUIRES_REVIEW", "ERROR"].includes(result))) {
        return c.json({ error: "Invalid result parameter: must be a valid audit status" }, 400);
    }
    const entries = getAuditLog({ limit, after, before, result });
    return c.json({ success: true, entries });
});
/**
 * Get audit summary stats.
 */
app.get("/api/v1/audit/summary", (c) => {
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
app.post("/api/v1/register", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) || {};
    const address = body.address;
    const ownerName = body.ownerName;
    if (typeof address !== "string" ||
        address.trim().length === 0 ||
        address.length > MAX_STRING_LENGTH ||
        !isValidAddress(address)) {
        return c.json({ error: `Invalid address: must be a valid Algorand wallet address` }, 400);
    }
    if (typeof ownerName !== "string" ||
        ownerName.trim().length === 0 ||
        ownerName.length > MAX_STRING_LENGTH) {
        return c.json({
            error: `Invalid ownerName: must be a non-empty string of max ${MAX_STRING_LENGTH} characters`,
        }, 400);
    }
    // Security: Validate types and bounds for optional registration fields to prevent payload injection and DoS
    const { nationality, dateOfBirth, verificationMethod, altAddresses } = body;
    if (nationality !== undefined &&
        nationality !== null &&
        (typeof nationality !== "string" || nationality.length > MAX_STRING_LENGTH)) {
        return c.json({
            error: `Invalid nationality: must be a string of max ${MAX_STRING_LENGTH} characters`,
        }, 400);
    }
    if (dateOfBirth !== undefined &&
        dateOfBirth !== null &&
        (typeof dateOfBirth !== "string" || dateOfBirth.length > MAX_STRING_LENGTH)) {
        return c.json({
            error: `Invalid dateOfBirth: must be a string of max ${MAX_STRING_LENGTH} characters`,
        }, 400);
    }
    if (verificationMethod !== undefined &&
        verificationMethod !== null &&
        (typeof verificationMethod !== "string" ||
            verificationMethod.length > MAX_STRING_LENGTH)) {
        return c.json({
            error: `Invalid verificationMethod: must be a string of max ${MAX_STRING_LENGTH} characters`,
        }, 400);
    }
    if (altAddresses !== undefined && altAddresses !== null) {
        if (!Array.isArray(altAddresses) || altAddresses.length > 50) {
            return c.json({
                error: "Invalid altAddresses: must be an array of max 50 valid Algorand wallet addresses",
            }, 400);
        }
        for (const altAddr of altAddresses) {
            if (typeof altAddr !== "string" ||
                altAddr.trim().length === 0 ||
                altAddr.length > MAX_STRING_LENGTH ||
                !isValidAddress(altAddr)) {
                return c.json({
                    error: "Invalid altAddresses: each entry must be a valid Algorand wallet address",
                }, 400);
            }
        }
    }
    const identity = registerWalletIdentity(address, ownerName, {
        nationality: nationality || undefined,
        dateOfBirth: dateOfBirth || undefined,
        verificationMethod: verificationMethod || undefined,
        altAddresses: altAddresses || undefined,
    });
    return c.json({ success: true, identity });
});
export default app;
