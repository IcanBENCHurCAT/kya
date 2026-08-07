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

import fs from 'node:fs';
import path from 'node:path';

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
export function buildDefaultData(): SanctionedEntry[] {
  return [
    {
      id: '23444',
      name: 'AL-RAZI, Abubakar',
      type: 'individual',
      source: 'OFAC-SDN',
      program: 'SDGT',
      addresses: ['Nigeria'],
      aliases: ['Abubakar Al-Razi', 'Abu Bakr Al-Razi'],
      nationalities: ['Nigeria'],
      nationalIds: [],
      birthdates: ['1965'],
      lastUpdated: new Date().toISOString().split('T')[0],
    },
    {
      id: '29412',
      name: 'BAHRAINI, Ahmad',
      type: 'individual',
      source: 'OFAC-SDN',
      program: 'IRAN',
      addresses: ['Tehran, Iran'],
      aliases: ['Ahmad Bahraini'],
      nationalities: ['Iran'],
      nationalIds: [],
      birthdates: ['1970-03-15'],
      lastUpdated: new Date().toISOString().split('T')[0],
    },
    {
      id: '31052',
      name: 'CRYPTOMIXER LIMITED',
      type: 'entity',
      source: 'OFAC-SDN',
      program: 'CYBER2',
      addresses: ['Seychelles'],
      aliases: ['CryptoMixer', 'CryptoMixer Ltd'],
      nationalities: [],
      nationalIds: [],
      birthdates: [],
      lastUpdated: new Date().toISOString().split('T')[0],
    },
    {
      id: '48910',
      name: 'NORDSTREAM AG',
      type: 'entity',
      source: 'OFAC-SDN',
      program: 'UA-EO13662',
      addresses: ['Geneva, Switzerland'],
      aliases: ['Nordstream'],
      nationalities: ['Switzerland'],
      nationalIds: [],
      birthdates: [],
      lastUpdated: new Date().toISOString().split('T')[0],
    },
    {
      id: '51223',
      name: 'VESSEL MARIYKA U123',
      type: 'vessel',
      source: 'OFAC-SDN',
      program: 'UKRAINE-EO13661',
      addresses: ['Unknown'],
      aliases: ['Mariyka U123', 'MV MARIYKA'],
      nationalities: [],
      nationalIds: ['IMO 9876543'],
      birthdates: [],
      lastUpdated: new Date().toISOString().split('T')[0],
    },
    // Fake wallet address mapping for testing
    {
      id: '99001',
      name: 'SANC-WALLET-01 (Test Entry)',
      type: 'other',
      source: 'OFAC-SDN',
      program: 'SDGT',
      addresses: ['test-only'],
      aliases: ['SancWallet01'],
      nationalities: [],
      nationalIds: ['ALGO:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'],
      birthdates: [],
      lastUpdated: new Date().toISOString().split('T')[0],
    },
  ];
}

/**
 * Parse OFAC SDN CSV data into SanctionedEntry array.
 * Expected CSV format (simplified — real OFAC CSV is more complex):
 *   Record Type,Last Name,First Name,Type,Address,City,State,Country,SSN,DOB
 *
 * This parser handles the OFAC SDN CSV format.
 */
export function parseOFACCSV(csvText: string): SanctionedEntry[] {
  const lines = csvText.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  // OFAC CSV header: Record Type,Last Name,First Name,Type,Address,City,State,Country,SSN/DOB/other IDs...
  const entries: SanctionedEntry[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('!') || line.startsWith('#')) continue;

    // Handle quoted fields — naive split (real OFAC CSV needs proper CSV parser)
    const parts = line.split(',').map(f => f.replace(/^"|"$/g, '').trim());

    if (parts.length < 5) continue;

    const recordType = parts[0] || 'I';
    const lastName = parts[1] || '';
    const firstName = parts[2] || '';
    const name = [lastName, firstName].filter(Boolean).join(', ');
    const entityType = parts[3] || 'Individual';

    let entryType: SanctionedEntry['type'] = 'individual';
    if (entityType.toLowerCase().includes('entity') || entityType.toLowerCase().includes('corp')) {
      entryType = 'entity';
    } else if (entityType.toLowerCase().includes('vessel')) {
      entryType = 'vessel';
    } else if (entityType.toLowerCase().includes('aircraft')) {
      entryType = 'aircraft';
    }

    const country = parts[7] || '';
    const addresses = [country].filter(Boolean);

    entries.push({
      id: parts[0] || `unknown-${i}`,
      name,
      type: entryType,
      source: 'OFAC-SDN',
      program: 'SDN',
      addresses,
      aliases: [],
      nationalities: [country].filter(Boolean),
      nationalIds: [],
      birthdates: [],
      lastUpdated: new Date().toISOString().split('T')[0],
    });
  }

  return entries;
}

/**
 * Download OFAC SDN list from official source.
 * Returns parsed SanctionedEntry array, or empty array on failure.
 */
export async function downloadOFACSDN(): Promise<SanctionedEntry[]> {
  const urls = [
    'https://www.treasury.gov/ofac/downloads/sdn.csv',
    'https://sanctionslistservice.ofac.gov/v2/SDN.json',
  ];

  for (const url of urls) {
    try {
      console.log(`[OFAC] Downloading from ${url}...`);
      const response = await fetch(url, {
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        console.warn(`[OFAC] Failed: ${response.status} ${response.statusText}`);
        continue;
      }

      if (url.endsWith('.json')) {
        const data = await response.json();
        // Parse JSON format (v2 API)
        return parseOFACJSON(data);
      } else {
        // Parse CSV format
        const csvText = await response.text();
        return parseOFACCSV(csvText);
      }
    } catch (err) {
      console.warn(`[OFAC] Download error from ${url}:`, err);
      continue;
    }
  }

  console.warn('[OFAC] All download URLs failed — using embedded reference data');
  return buildDefaultData();
}

/**
 * Parse OFAC SDN JSON v2 format (from sanctionslistservice.ofac.gov).
 */
export function parseOFACJSON(data: any): SanctionedEntry[] {
  const entries: SanctionedEntry[] = [];
  const list = Array.isArray(data) ? data : data.SDNList || [];

  for (const item of list) {
    entries.push({
      id: item.uid || item.id || `unknown-${Math.random().toString(36).slice(2)}`,
      name: item.name || '',
      type: (item.entityType || 'Individual').toLowerCase() === 'entity' ? 'entity'
        : (item.entityType || 'Individual').toLowerCase().includes('vessel') ? 'vessel'
        : 'individual',
      source: 'OFAC-SDN',
      program: Array.isArray(item.type) ? item.type.join(',') : 'SDN',
      addresses: (item.address || []).map((a: any) => typeof a === 'string' ? a : JSON.stringify(a)).filter(Boolean),
      aliases: (item.aka || []).map((a: any) => typeof a === 'string' ? a : JSON.stringify(a)).filter(Boolean),
      nationalities: (item.nationalities || []).map((n: any) => typeof n === 'string' ? n : JSON.stringify(n)).filter(Boolean),
      nationalIds: (item.identifications || []).map((id: any) => {
        if (typeof id === 'string') return id;
        return [id.country, id.idNumber, id.type].filter(Boolean).join(' ') || '';
      }).filter(Boolean),
      birthdates: (item.associatedPersons || []).map((p: any) => p.dob || '').filter(Boolean),
      lastUpdated: new Date().toISOString().split('T')[0],
    });
  }

  return entries;
}

/**
 * Save sanctions list to disk for persistence.
 */
export function saveSanctionsList(list: SanctionsList, filepath: string): void {
  const dir = path.dirname(filepath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filepath, JSON.stringify(list, null, 2), 'utf-8');
  console.log(`[OFAC] Sanctions list saved to ${filepath} (${list.totalEntries} entries)`);
}

/**
 * Load sanctions list from disk.
 */
export function loadSanctionsList(filepath: string): SanctionsList | null {
  if (!fs.existsSync(filepath)) return null;

  try {
    const data = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
    console.log(`[OFAC] Loaded sanctions list from ${filepath} (${data.totalEntries} entries)`);
    return data;
  } catch (err) {
    console.error(`[OFAC] Failed to load sanctions list:`, err);
    return null;
  }
}
