/**
 * Audit Logging Service
 *
 * Records all screening operations for screening audit traceability.
 * Logs include: who was screened, result, confidence, matched entries, timestamp.
 *
 * In production: Write to Supabase/PostgreSQL with structured audit table.
 * Development: In-memory store with disk persistence.
 */
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
/**
 * In-memory audit log store.
 * Bounded by MAX_AUDIT_LOG_CAP to prevent unbounded memory growth and DoS attacks.
 */
export const MAX_AUDIT_LOG_CAP = 100000;
const auditLog = [];
// Performance optimization: Incremental scalar counters for O(1) status breakdown lookups.
let summaryNoMatchFound = 0;
let summaryPotentialMatch = 0;
let summaryRequiresReview = 0;
let summaryErrors = 0;
function incrementSummaryCounters(entry) {
    if (entry.result === 'NO_MATCH_FOUND')
        summaryNoMatchFound++;
    else if (entry.result === 'POTENTIAL_MATCH')
        summaryPotentialMatch++;
    else if (entry.result === 'MATCH_REQUIRES_REVIEW')
        summaryRequiresReview++;
    else if (entry.result === 'ERROR')
        summaryErrors++;
}
function decrementSummaryCounters(entry) {
    if (entry.result === 'NO_MATCH_FOUND')
        summaryNoMatchFound--;
    else if (entry.result === 'POTENTIAL_MATCH')
        summaryPotentialMatch--;
    else if (entry.result === 'MATCH_REQUIRES_REVIEW')
        summaryRequiresReview--;
    else if (entry.result === 'ERROR')
        summaryErrors--;
}
function insertAuditEntryChronological(entry) {
    const len = auditLog.length;
    // Fast path (production common case): entries arrive in ascending chronological order
    if (len === 0 || entry.timestamp >= auditLog[len - 1].timestamp) {
        auditLog.push(entry);
        return;
    }
    // Fallback path: out-of-order entry (e.g. test setups or clock-skewed caller timestamps).
    // Perform binary search to find insertion position and maintain ascending chronological order.
    let low = 0;
    let high = len - 1;
    while (low <= high) {
        const mid = (low + high) >>> 1;
        if (auditLog[mid].timestamp <= entry.timestamp) {
            low = mid + 1;
        }
        else {
            high = mid - 1;
        }
    }
    auditLog.splice(low, 0, entry);
}
function pushAuditEntry(entry) {
    insertAuditEntryChronological(entry);
    if (auditLog.length > MAX_AUDIT_LOG_CAP) {
        const evictedCount = auditLog.length - MAX_AUDIT_LOG_CAP;
        for (let i = 0; i < evictedCount; i++) {
            decrementSummaryCounters(auditLog[i]);
        }
        auditLog.splice(0, evictedCount);
    }
    incrementSummaryCounters(entry);
    persistAuditLog();
}
const AUDIT_LOG_PATH = path.join(process.env.KYA_DATA_DIR || process.cwd(), 'data', 'audit-log.json');
/**
 * Log a screening operation.
 */
export function logScreening(result) {
    const entry = {
        id: randomUUID(),
        timestamp: result.timestamp,
        eventType: 'screening',
        screenableTarget: result.screened,
        result: result.status,
        confidence: result.confidence,
        matchedEntries: result.matchedEntries.map(e => e.name),
        matchedListNames: result.matchedListNames,
        details: result.details,
    };
    pushAuditEntry(entry);
    return entry;
}
/**
 * Log a watchlist update.
 */
export function logUpdate(details) {
    const entry = {
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        eventType: 'update',
        result: details.success ? 'NO_MATCH_FOUND' : 'ERROR',
        confidence: details.success ? 1.0 : 0.0,
        matchedEntries: [],
        matchedListNames: [details.source],
        screenableTarget: details.source,
        details: `${details.entriesAdded} added, ${details.entriesRemoved} removed${details.error ? ` | Error: ${details.error}` : ''}`,
    };
    pushAuditEntry(entry);
    return entry;
}
/**
 * Log an error.
 */
export function logError(message, metadata) {
    const entry = {
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        eventType: 'error',
        result: 'ERROR',
        confidence: 0,
        matchedEntries: [],
        matchedListNames: [],
        screenableTarget: 'system',
        details: message,
        metadata,
    };
    pushAuditEntry(entry);
    return entry;
}
/**
 * Get all audit entries, optionally filtered.
 *
 * Performance optimization:
 * Since auditLog is appended in chronological order, reverse iteration from newest (end) to oldest (start)
 * allows collecting matching entries directly with an early exit once `limit` items are gathered.
 * This turns query operations over large audit histories from $O(N \log N)$ sorting and $O(N)$ full-array copying
 * down to $O(\text{limit})$ time complexity in common cases, eliminating massive array allocations.
 */
export function getAuditLog(options = {}) {
    const limit = options.limit || 100;
    const entries = [];
    const { after, before, result } = options;
    // Performance optimization:
    // 1. Because auditLog is maintained in strict ascending chronological order (via insertAuditEntryChronological),
    //    reverse iteration from newest (end) to oldest (0) naturally visits entries in descending chronological order.
    // 2. Early-exit on `after`: As soon as entry.timestamp < after, all remaining preceding entries (0 to i) also have
    //    timestamp < after due to chronological ordering. Breaking early eliminates scanning up to 100,000 entries.
    // 3. Eliminates redundant `entries.sort(...)` post-pass, saving O(K log K) CPU overhead on every query.
    for (let i = auditLog.length - 1; i >= 0; i--) {
        const entry = auditLog[i];
        if (after && entry.timestamp < after)
            break;
        if (before && entry.timestamp > before)
            continue;
        if (result && entry.result !== result)
            continue;
        entries.push(entry);
        if (entries.length >= limit) {
            break;
        }
    }
    return entries;
}
/**
 * Get audit summary stats.
 *
 * Performance optimization:
 * Uses scalar counters for overall status counts ($O(1)$) and a single linear pass over auditLog
 * to count recent 24h screenings without intermediate array allocations or string sorting.
 */
export function getAuditSummary() {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    let recentScreenings = 0;
    // Performance optimization:
    // Because auditLog maintains strict ascending chronological order via sorted insertion,
    // iterating backwards from the newest entry (auditLog.length - 1 down to 0) allows
    // breaking early as soon as entry.timestamp < cutoff. Avoids scanning up to 100,000 entries.
    for (let i = auditLog.length - 1; i >= 0; i--) {
        const entry = auditLog[i];
        if (entry.timestamp < cutoff) {
            break;
        }
        if (entry.eventType === 'screening') {
            recentScreenings++;
        }
    }
    return {
        total: auditLog.length,
        noMatchFound: summaryNoMatchFound,
        potentialMatch: summaryPotentialMatch,
        requiresReview: summaryRequiresReview,
        errors: summaryErrors,
        recentScreenings,
    };
}
let persistTimer = null;
/**
 * Persist audit log to disk (debounced).
 *
 * Performance optimization:
 * Debounces disk persistence using a timer (100ms) to coalesce rapid log entries
 * (such as bulk screening) into a single disk write operation. Avoids executing synchronous
 * $O(N^2)$ JSON serialization and blocking disk I/O on every single screening event.
 */
function persistAuditLog() {
    if (persistTimer)
        return;
    persistTimer = setTimeout(() => {
        persistTimer = null;
        flushAuditLog();
    }, 100);
}
/**
 * Synchronously flush audit log to disk.
 */
export function flushAuditLog() {
    if (persistTimer) {
        clearTimeout(persistTimer);
        persistTimer = null;
    }
    try {
        const dir = path.dirname(AUDIT_LOG_PATH);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(AUDIT_LOG_PATH, JSON.stringify(auditLog, null, 2), 'utf-8');
    }
    catch (err) {
        console.error('[Audit] Failed to persist audit log:', err);
    }
}
// Ensure pending debounced audit log entries are synchronously written to disk before process exit
if (typeof process !== 'undefined' && process.on) {
    process.on('beforeExit', () => {
        flushAuditLog();
    });
}
/**
 * Load audit log from disk.
 */
export function loadAuditLog() {
    if (!fs.existsSync(AUDIT_LOG_PATH))
        return;
    try {
        const data = JSON.parse(fs.readFileSync(AUDIT_LOG_PATH, 'utf-8'));
        if (Array.isArray(data)) {
            clearAuditLog();
            const startIdx = Math.max(0, data.length - MAX_AUDIT_LOG_CAP);
            for (let i = startIdx; i < data.length; i++) {
                const entry = data[i];
                auditLog.push(entry);
                incrementSummaryCounters(entry);
            }
            console.log(`[Audit] Loaded ${auditLog.length} audit entries from disk.`);
        }
    }
    catch (err) {
        console.error('[Audit] Failed to load audit log:', err);
    }
}
/**
 * Clear audit log (for testing).
 */
export function clearAuditLog() {
    if (persistTimer) {
        clearTimeout(persistTimer);
        persistTimer = null;
    }
    auditLog.length = 0;
    summaryNoMatchFound = 0;
    summaryPotentialMatch = 0;
    summaryRequiresReview = 0;
    summaryErrors = 0;
    try {
        fs.unlinkSync(AUDIT_LOG_PATH);
    }
    catch {
        // ignore
    }
}
