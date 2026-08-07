/**
 * OFAC Sanctions Data Service
 *
 * Manages loading, parsing, and querying of OFAC SDN (Specially Designated Nationals)
 * and other sanctions list data. Supports both embedded reference data and live downloads.
 *
 * OFAC SDN List: https://www.treasury.gov/ofac/downloads/sdn.csv
 *
 * Data model for each entry:
 *   - primaryKey: unique identifier (UID)
 *   - name: entity/individual name
 *   - type: individual | entity | vessel | aircraft
 *   - program: list of sanctions programs (e.g., "SDGT" = Specially Designated Global Terrorist)
 *   - addresses: array of addresses
 *   - aliases: array of known aliases
 *   - nationalities: array of nationalities
 *   - nationalIds: array of national IDs (passport, SSN, etc.)
 *   - birthdates: array of birthdate strings
 *   - altUids: alternative unique identifiers
 */
export interface SanctionedEntry {
    id: string;
    name: string;
    type: 'individual' | 'entity' | 'vessel' | 'aircraft' | 'other';
    source: string;
    program: string;
    addresses: string[];
    aliases: string[];
    nationalities: string[];
    nationalIds: string[];
    birthdates: string[];
    lastUpdated: string;
}
export interface SanctionsList {
    name: string;
    version: string;
    lastUpdated: string;
    totalEntries: number;
    entries: SanctionedEntry[];
}
export interface ListRegistry {
    [listName: string]: SanctionedEntry[];
}
/**
 * Default embedded OFAC SDN data (sample entries for demo/development).
 * In production, this should be loaded from the live OFAC feed.
 *
 * Real feed: https://www.treasury.gov/ofac/downloads/sdn.csv
 * Alternative: https://sanctionslistservice.ofac.gov/v2/SDN.json
 */
export declare function buildDefaultData(): SanctionedEntry[];
/**
 * Parse OFAC SDN CSV data into SanctionedEntry array.
 * Expected CSV format (simplified — real OFAC CSV is more complex):
 *   Record Type,Last Name,First Name,Type,Address,City,State,Country,SSN,DOB
 *
 * This parser handles the OFAC SDN CSV format.
 */
export declare function parseOFACCSV(csvText: string): SanctionedEntry[];
/**
 * Download OFAC SDN list from official source.
 * Returns parsed SanctionedEntry array, or empty array on failure.
 */
export declare function downloadOFACSDN(): Promise<SanctionedEntry[]>;
/**
 * Parse OFAC SDN JSON v2 format (from sanctionslistservice.ofac.gov).
 */
export declare function parseOFACJSON(data: any): SanctionedEntry[];
/**
 * Save sanctions list to disk for persistence.
 */
export declare function saveSanctionsList(list: SanctionsList, filepath: string): void;
/**
 * Load sanctions list from disk.
 */
export declare function loadSanctionsList(filepath: string): SanctionsList | null;
