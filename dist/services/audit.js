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
function pushAuditEntry(entry) {
    if (auditLog.length >= MAX_AUDIT_LOG_CAP) {
        auditLog.splice(0, auditLog.length - MAX_AUDIT_LOG_CAP + 1);
    }
    auditLog.push(entry);
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
    // Reverse loop: newest entries are appended at the end of auditLog
    for (let i = auditLog.length - 1; i >= 0; i--) {
        const entry = auditLog[i];
        if (after && entry.timestamp < after)
            continue;
        if (before && entry.timestamp > before)
            continue;
        if (result && entry.result !== result)
            continue;
        entries.push(entry);
        if (entries.length >= limit) {
            break;
        }
    }
    // Ensure entries are strictly sorted descending by ISO timestamp using fast relational operators
    entries.sort((a, b) => (b.timestamp > a.timestamp ? 1 : b.timestamp < a.timestamp ? -1 : 0));
    return entries;
}
/**
 * Get audit summary stats.
 *
 * Performance optimization:
 * Single $O(N)$ pass directly over auditLog using ISO string comparison for the 24h cutoff.
 * Eliminates $O(N \log N)$ localeCompare sorting, repeated .filter() array allocations,
 * and Date object instantiations per log entry.
 */
export function getAuditSummary() {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    let total = 0;
    let noMatchFound = 0;
    let potentialMatch = 0;
    let requiresReview = 0;
    let errors = 0;
    let recentScreenings = 0;
    for (let i = 0; i < auditLog.length; i++) {
        const entry = auditLog[i];
        total++;
        if (entry.result === 'NO_MATCH_FOUND') {
            noMatchFound++;
        }
        else if (entry.result === 'POTENTIAL_MATCH') {
            potentialMatch++;
        }
        else if (entry.result === 'MATCH_REQUIRES_REVIEW') {
            requiresReview++;
        }
        else if (entry.result === 'ERROR') {
            errors++;
        }
        if (entry.timestamp >= cutoff && entry.eventType === 'screening') {
            recentScreenings++;
        }
    }
    return {
        total,
        noMatchFound,
        potentialMatch,
        requiresReview,
        errors,
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
            for (let i = 0; i < data.length; i++) {
                auditLog.push(data[i]);
            }
            if (auditLog.length > MAX_AUDIT_LOG_CAP) {
                auditLog.splice(0, auditLog.length - MAX_AUDIT_LOG_CAP);
            }
            console.log(`[Audit] Loaded ${data.length} audit entries from disk.`);
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
    try {
        fs.unlinkSync(AUDIT_LOG_PATH);
    }
    catch {
        // ignore
    }
}
