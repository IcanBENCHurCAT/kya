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
 * Combines filter criteria into a single pass and replaces localeCompare with fast ISO string
 * relational comparisons (> / <), avoiding multi-pass array allocations and expensive ICU locale overhead.
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
 * Single $O(N)$ pass directly over auditLog using ISO string comparison for the 24h cutoff.
 * Eliminates $O(N \log N)$ localeCompare sorting, repeated .filter() array allocations,
 * and Date object instantiations per log entry.
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
 * Load audit log from disk.
 */
export declare function loadAuditLog(): void;
/**
 * Clear audit log (for testing).
 */
export declare function clearAuditLog(): void;
