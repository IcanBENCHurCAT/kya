/**
 * Watchlist Update Service
 *
 * Periodically refreshes sanctions lists from official sources.
 * Supports manual triggers and scheduled updates.
 *
 * Sources:
 * - OFAC SDN: https://www.treasury.gov/ofac/downloads/sdn.csv
 * - OFAC SDN JSON v2: https://sanctionslistservice.ofac.gov/v2/SDN.json
 *
 * In production: Run as a background cron job or via API endpoint.
 */
import type { SanctionsList, SanctionedEntry, ListRegistry } from './ofac.js';
export type { ListRegistry } from './ofac.js';
/**
 * Watchlist update state.
 */
export interface WatchlistState {
    lastUpdate: string;
    lastUpdateSource: string;
    totalEntries: number;
    version: string;
    running: boolean;
}
/**
 * Get current watchlist state.
 */
export declare function getState(): WatchlistState;
/**
 * Load existing watchlist from disk (if available).
 */
export declare function loadWatchlist(): SanctionsList | null;
/**
 * Save watchlist to disk.
 */
export declare function saveWatchlist(list: SanctionsList): void;
/**
 * Refresh all sanctions watchlists from official sources.
 * Returns the updated list, or null on failure.
 */
export declare function refreshWatchlists(lists: ListRegistry, force?: boolean): Promise<Record<string, SanctionedEntry[]> | null>;
/**
 * Load watchlist from disk fallback (when network unavailable).
 */
export declare function loadFallbackWatchlist(): SanctionsList;
/**
 * Initialize watchlist: load from disk or download fresh.
 */
export declare function initializeWatchlist(lists: ListRegistry, preferNetwork?: boolean): Promise<ListRegistry>;
/**
 * Get summary info for API responses.
 */
export declare function getSummary(): {
    name: string;
    lastUpdated: string;
    totalEntries: number;
    version: string;
    source: string;
    cached: boolean;
};
