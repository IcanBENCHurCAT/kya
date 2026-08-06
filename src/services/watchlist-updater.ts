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

import {
  SanctionsList,
  SanctionedEntry,
  ListRegistry,
  buildDefaultData,
  saveSanctionsList,
  loadSanctionsList,
  downloadOFACSDN,
  parseOFACCSV,
  parseOFACJSON,
} from './ofac.js';
import { logUpdate, logError } from './audit.js';

const WATCHLIST_PATH = process.env.KYA_DATA_DIR
  ? `${process.env.KYA_DATA_DIR}/watchlists/ofac-sdn.json`
  : `${process.cwd()}/data/watchlists/ofac-sdn.json`;

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

const state: WatchlistState = {
  lastUpdate: '',
  lastUpdateSource: '',
  totalEntries: 0,
  version: '0.0.0',
  running: false,
};

/**
 * Get current watchlist state.
 */
export function getState(): WatchlistState {
  return { ...state };
}

/**
 * Load existing watchlist from disk (if available).
 */
export function loadWatchlist(): SanctionsList | null {
  return loadSanctionsList(WATCHLIST_PATH);
}

/**
 * Save watchlist to disk.
 */
export function saveWatchlist(list: SanctionsList): void {
  saveSanctionsList(list, WATCHLIST_PATH);
}

/**
 * Refresh all sanctions watchlists from official sources.
 * Returns the updated list, or null on failure.
 */
export async function refreshWatchlists(
  lists: ListRegistry,
  force: boolean = false,
): Promise<Record<string, SanctionedEntry[]> | null> {
  if (state.running) {
    console.warn('[Watchlist] Update already in progress.');
    return null;
  }

  state.running = true;

  try {
    console.log('[Watchlist] Starting update...');

    // Download from official source
    const entries = await downloadOFACSDN();

    // Build updated list
    const now = new Date().toISOString().split('T')[0];
    const listName = 'OFAC-SDN';

    // Merge with existing data if available
    const existing = lists[listName] || [];
    const existingIds = new Set(existing.map(e => e.id));
    const newEntries: SanctionedEntry[] = [];
    let addedCount = 0;
    let removedCount = 0;

    // Add new/different entries
    for (const entry of entries) {
      if (!existingIds.has(entry.id)) {
        newEntries.push(entry);
        addedCount++;
      }
    }

    // Check for removed entries
    const newIds = new Set(entries.map(e => e.id));
    for (const entry of existing) {
      if (!newIds.has(entry.id)) {
        removedCount++;
      }
    }

    const updatedList: SanctionsList = {
      name: listName,
      version: now,
      lastUpdated: now,
      totalEntries: entries.length,
      entries,
    };

    // Save to disk
    saveWatchlist(updatedList);

    // Update state
    state.lastUpdate = new Date().toISOString();
    state.lastUpdateSource = 'OFAC official';
    state.totalEntries = entries.length;
    state.version = now;

    // Build updated registry
    const updatedLists = { ...lists };
    updatedLists[listName] = entries;

    // Log the update
    logUpdate({
      source: listName,
      entriesAdded: addedCount,
      entriesRemoved: removedCount,
      success: true,
    });

    console.log(`[Watchlist] Update complete: ${entries.length} entries (added: ${addedCount}, removed: ${removedCount})`);
    return updatedLists;
  } catch (err) {
    console.error('[Watchlist] Update failed:', err);
    logError(`Watchlist update failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  } finally {
    state.running = false;
  }
}

/**
 * Load watchlist from disk fallback (when network unavailable).
 */
export function loadFallbackWatchlist(): SanctionsList {
  const existing = loadWatchlist();
  if (existing) {
    console.log(`[Watchlist] Loaded existing list with ${existing.totalEntries} entries.`);
    return existing;
  }

  // Use embedded reference data
  console.log('[Watchlist] No existing data — using embedded reference data.');
  return {
    name: 'OFAC-SDN',
    version: 'embedded',
    lastUpdated: new Date().toISOString().split('T')[0],
    totalEntries: 0,
    entries: buildDefaultData(),
  };
}

/**
 * Initialize watchlist: load from disk or download fresh.
 */
export async function initializeWatchlist(lists: ListRegistry, preferNetwork: boolean = false): Promise<ListRegistry> {
  if (!preferNetwork) {
    // Try disk first
    const diskList = loadWatchlist();
    if (diskList) {
      console.log(`[Watchlist] Using cached list from disk (${diskList.totalEntries} entries).`);
      lists['OFAC-SDN'] = diskList.entries;
      return lists;
    }
  }

  // Download from network
  console.log('[Watchlist] Fetching fresh sanctions data...');
  const updated = await refreshWatchlists(lists);
  if (updated) {
    return updated;
  }

  // Fallback to embedded data
  console.warn('[Watchlist] Fallback to embedded data.');
  lists['OFAC-SDN'] = buildDefaultData();
  return lists;
}

/**
 * Get summary info for API responses.
 */
export function getSummary(): {
  name: string;
  lastUpdated: string;
  totalEntries: number;
  version: string;
  source: string;
  cached: boolean;
} {
  const diskList = loadWatchlist();
  return {
    name: diskList?.name || 'OFAC-SDN',
    lastUpdated: diskList?.lastUpdated || 'N/A',
    totalEntries: diskList?.totalEntries || 0,
    version: diskList?.version || state.version,
    source: 'treasury.gov/ofac',
    cached: !!diskList,
  };
}
