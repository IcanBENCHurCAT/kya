/**
 * Audit Logging Service
 *
 * Records all screening operations for compliance traceability.
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
    result: 'PASS' | 'FAIL' | 'FLAGGED' | 'ERROR';
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
    status: 'PASS' | 'FAIL' | 'FLAGGED';
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
 */
export declare function getAuditLog(options?: {
    limit?: number;
    after?: string;
    before?: string;
    result?: 'PASS' | 'FAIL' | 'FLAGGED' | 'ERROR';
}): AuditEntry[];
/**
 * Get audit summary stats.
 */
export declare function getAuditSummary(): {
    total: number;
    pass: number;
    fail: number;
    flagged: number;
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
