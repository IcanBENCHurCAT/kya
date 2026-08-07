/**
 * Audit Logging Service
 *
 * Records all screening operations for compliance traceability.
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
 */
const auditLog = [];
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
    auditLog.push(entry);
    persistAuditLog();
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
        result: details.success ? 'PASS' : 'ERROR',
        confidence: details.success ? 1.0 : 0.0,
        matchedEntries: [],
        matchedListNames: [details.source],
        screenableTarget: details.source,
        details: `${details.entriesAdded} added, ${details.entriesRemoved} removed${details.error ? ` | Error: ${details.error}` : ''}`,
    };
    auditLog.push(entry);
    persistAuditLog();
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
    auditLog.push(entry);
    persistAuditLog();
    return entry;
}
/**
 * Get all audit entries, optionally filtered.
 */
export function getAuditLog(options = {}) {
    let entries = [...auditLog];
    if (options.after) {
        const after = options.after;
        entries = entries.filter(e => e.timestamp >= after);
    }
    if (options.before) {
        const before = options.before;
        entries = entries.filter(e => e.timestamp <= before);
    }
    if (options.result) {
        entries = entries.filter(e => e.result === options.result);
    }
    // Sort by timestamp descending
    entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return entries.slice(0, options.limit || 100);
}
/**
 * Get audit summary stats.
 */
export function getAuditSummary() {
    const entries = getAuditLog({ limit: 10000 });
    const last24h = entries.filter(e => {
        const ts = new Date(e.timestamp).getTime();
        return ts > Date.now() - 24 * 60 * 60 * 1000;
    });
    return {
        total: entries.length,
        pass: entries.filter(e => e.result === 'PASS').length,
        fail: entries.filter(e => e.result === 'FAIL').length,
        flagged: entries.filter(e => e.result === 'FLAGGED').length,
        errors: entries.filter(e => e.result === 'ERROR').length,
        recentScreenings: last24h.filter(e => e.eventType === 'screening').length,
    };
}
/**
 * Persist audit log to disk.
 */
function persistAuditLog() {
    try {
        const dir = path.dirname(AUDIT_LOG_PATH);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(AUDIT_LOG_PATH, JSON.stringify(auditLog, null, 2), 'utf-8');
    }
    catch (err) {
        console.error('[Audit] Failed to persist audit log:', err);
    }
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
            auditLog.push(...data);
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
    auditLog.length = 0;
    try {
        fs.unlinkSync(AUDIT_LOG_PATH);
    }
    catch {
        // ignore
    }
}
