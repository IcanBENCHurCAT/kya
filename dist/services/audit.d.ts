/**
 * Audit Logging Service
 *
 * Records all screening operations for screening audit traceability.
 * Logs include: who was screened, result, confidence, matched entries, timestamp.
 *
 * In production: Write to Supabase/PostgreSQL with structured audit table.
 * Development: In-memory store with disk persistence.
 */
export interface AuditEntry {
    id: string;
    timestamp: string;
    eventType: 'screening' | 'update' | 'error' | 'config_change';
    walletAddress?: string;
    beneficialOwner?: string;
    result: 'NO_MATCH_FOUND' | 'POTENTIAL_MATCH' | 'MATCH_REQUIRES_REVIEW' | 'ERROR';
    confidence: number;
    matchedEntries: string[];
    matchedListNames: string[];
    screenableTarget: string;
    details?: string;
    metadata?: Record<string, unknown>;
}
/**
 * In-memory audit log store.
 * Bounded by MAX_AUDIT_LOG_CAP to prevent unbounded memory growth and DoS attacks.
 */
export declare const MAX_AUDIT_LOG_CAP = 100000;
/**
 * Log a screening operation.
 */
export declare function logScreening(result: {
    screened: string;
    status: 'NO_MATCH_FOUND' | 'POTENTIAL_MATCH' | 'MATCH_REQUIRES_REVIEW';
    confidence: number;
    matchedEntries: {
        name: string;
    }[];
    matchedListNames: string[];
    details: string;
    timestamp: string;
}): AuditEntry;
/**
 * Log a watchlist update.
 */
export declare function logUpdate(details: {
    source: string;
    entriesAdded: number;
    entriesRemoved: number;
    success: boolean;
    error?: string;
}): AuditEntry;
/**
 * Log an error.
 */
export declare function logError(message: string, metadata?: Record<string, unknown>): AuditEntry;
/**
 * Get all audit entries, optionally filtered.
 *
 * Performance optimization:
 * Since auditLog is appended in chronological order, reverse iteration from newest (end) to oldest (start)
 * allows collecting matching entries directly with an early exit once `limit` items are gathered.
 * This turns query operations over large audit histories from $O(N \log N)$ sorting and $O(N)$ full-array copying
 * down to $O(\text{limit})$ time complexity in common cases, eliminating massive array allocations.
 */
export declare function getAuditLog(options?: {
    limit?: number;
    after?: string;
    before?: string;
    result?: 'NO_MATCH_FOUND' | 'POTENTIAL_MATCH' | 'MATCH_REQUIRES_REVIEW' | 'ERROR';
}): AuditEntry[];
/**
 * Get audit summary stats.
 *
 * Performance optimization:
 * Uses scalar counters for overall status counts ($O(1)$) and a single linear pass over auditLog
 * to count recent 24h screenings without intermediate array allocations or string sorting.
 */
export declare function getAuditSummary(): {
    total: number;
    noMatchFound: number;
    potentialMatch: number;
    requiresReview: number;
    errors: number;
    recentScreenings: number;
};
/**
 * Synchronously flush audit log to disk.
 */
export declare function flushAuditLog(): void;
/**
 * Load audit log from disk.
 */
export declare function loadAuditLog(): void;
/**
 * Clear audit log (for testing).
 */
export declare function clearAuditLog(): void;
