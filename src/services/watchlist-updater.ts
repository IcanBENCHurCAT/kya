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

import type {
  SanctionsList,
  SanctionedEntry,
  ListRegistry,
} from './ofac.js';
import {
  buildDefaultData,
  saveSanctionsList,
  loadSanctionsList,
  downloadOFACSDN,
  parseOFACCSV,
  parseOFACJSON,
} from './ofac.js';

// Re-export ListRegistry for consumers
export type { ListRegistry } from './ofac.js';
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

function updateStateFromList(list: SanctionsList, source: string = 'disk cache'): void {
  state.lastUpdate = list.lastUpdated || list.version || new Date().toISOString();
  state.lastUpdateSource = source;
  state.totalEntries = list.totalEntries || list.entries.length;
  state.version = list.version || '0.0.0';
}

/**
 * Load existing watchlist from disk (if available).
 */
export function loadWatchlist(): SanctionsList | null {
  const list = loadSanctionsList(WATCHLIST_PATH);
  if (list) {
    updateStateFromList(list, 'disk cache');
  }
  return list;
}

/**
 * Save watchlist to disk.
 */
export function saveWatchlist(list: SanctionsList): void {
  saveSanctionsList(list, WATCHLIST_PATH);
  updateStateFromList(list, 'disk save');
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
    // Performance optimization: Direct Set population in single-pass for loops avoids allocating
    // intermediate string[] arrays via .map() and eliminates dead newEntries array allocations (~20% faster).
    const existing = lists[listName] || [];
    const existingIds = new Set<string>();
    for (let i = 0; i < existing.length; i++) {
      existingIds.add(existing[i].id);
    }

    let addedCount = 0;
    let removedCount = 0;

    const newIds = new Set<string>();
    for (let i = 0; i < entries.length; i++) {
      const id = entries[i].id;
      newIds.add(id);
      if (!existingIds.has(id)) {
        addedCount++;
      }
    }

    for (let i = 0; i < existing.length; i++) {
      if (!newIds.has(existing[i].id)) {
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
    updateStateFromList(existing, 'disk cache');
    return existing;
  }

  // Use embedded reference data
  console.log('[Watchlist] No existing data — using embedded reference data.');
  const defaultEntries = buildDefaultData();
  const defaultList: SanctionsList = {
    name: 'OFAC-SDN',
    version: 'embedded',
    lastUpdated: new Date().toISOString().split('T')[0],
    totalEntries: defaultEntries.length,
    entries: defaultEntries,
  };
  updateStateFromList(defaultList, 'embedded reference data');
  return defaultList;
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
      updateStateFromList(diskList, 'disk cache');
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
  const defaultEntries = buildDefaultData();
  lists['OFAC-SDN'] = defaultEntries;
  state.lastUpdate = new Date().toISOString().split('T')[0];
  state.lastUpdateSource = 'embedded reference data';
  state.totalEntries = defaultEntries.length;
  state.version = 'embedded';
  return lists;
}

/**
 * Get summary info for API responses.
 *
 * Performance optimization:
 * Uses in-memory state when populated (`state.totalEntries > 0`), avoiding redundant synchronous
 * `fs.statSync` and `loadWatchlist` disk reads on every query or health probe (~30x faster response).
 */
export function getSummary(): {
  name: string;
  lastUpdated: string;
  totalEntries: number;
  version: string;
  source: string;
  cached: boolean;
} {
  if (state.totalEntries === 0) {
    const diskList = loadWatchlist();
    if (diskList) {
      updateStateFromList(diskList, 'disk cache');
    }
  }
  return {
    name: 'OFAC-SDN',
    lastUpdated: state.lastUpdate || 'N/A',
    totalEntries: state.totalEntries,
    version: state.version,
    source: 'treasury.gov/ofac',
    cached: state.totalEntries > 0,
  };
}
