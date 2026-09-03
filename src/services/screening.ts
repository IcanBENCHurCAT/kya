/**
 * Screening Engine
 *
 * Core fuzzy-matching engine that compares wallet addresses and
 * beneficial owner identities against sanctions watchlists.
 *
 * Returns: screening evidence, confidence score, and matched list details.
 */

import { SanctionedEntry } from './ofac.js';

export interface ScreeningResult {
  screened: string;
  match: boolean;
  status: 'NO_MATCH_FOUND' | 'POTENTIAL_MATCH' | 'MATCH_REQUIRES_REVIEW';
  confidence: number; // 0.0 — 1.0
  matchedEntries: MatchedEntry[];
  matchedListNames: string[];
  details: string;
  timestamp: string;
}

export interface MatchedEntry {
  sanctionedId: string;
  name: string;
  matchField: string; // 'name', 'alias', 'nationalId', 'address'
  matchScore: number; // 0.0 — 1.0
  program: string;
  source: string;
  reason: string;
}

/**
 * Screening configuration.
 */
export interface ScreeningConfig {
  /** Confidence threshold for potential match escalation (default: 0.85) */
  failThreshold: number;
  /** Confidence threshold for review escalation (default: 0.5) */
  flagThreshold: number;
  /** Max matching candidates to return (default: 10) */
  maxResults: number;
  /** Enable alias matching (default: true) */
  matchAliases: boolean;
  /** Enable national ID matching (default: true) */
  matchNationalIds: boolean;
  /** Enable address matching (default: true) */
  matchAddresses: boolean;
  /** Enable fuzzy name matching (default: true) */
  fuzzyMatch: boolean;
  /** Fuzzy match tolerance (0-1, lower = stricter; default: 0.8) */
  fuzzyTolerance: number;
}

const DEFAULT_CONFIG: ScreeningConfig = {
  failThreshold: 0.85,
  flagThreshold: 0.5,
  maxResults: 10,
  matchAliases: true,
  matchNationalIds: true,
  matchAddresses: true,
  fuzzyMatch: true,
  fuzzyTolerance: 0.8,
};

/**
 * Jaro-Winkler similarity for fuzzy name matching.
 * Returns a score from 0.0 (no match) to 1.0 (exact match).
 */
function jaroWinklerSimilarity(a: string, b: string): number {
  if (a === b) return 1.0;
  if (a.length === 0 || b.length === 0) return 0.0;

  const lenA = a.length;
  const lenB = b.length;
  const maxDist = Math.max(lenA, lenB) / 2 - 1;

  const charsA: (string | null)[] = new Array(lenA).fill(null);
  const charsB: (string | null)[] = new Array(lenB).fill(null);

  let matches = 0;
  const start = Math.min(4, Math.min(lenA, lenB));

  for (let i = 0; i < lenA; i++) {
    const lowerBound = Math.max(0, i - maxDist);
    const upperBound = Math.min(lenB - 1, i + maxDist);

    for (let j = lowerBound; j <= upperBound; j++) {
      if (charsB[j] !== null) continue;
      if (a[i] === b[j]) {
        charsA[i] = b[j];
        charsB[j] = a[i];
        matches++;
        break;
      }
    }
  }

  if (matches === 0) return 0.0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < lenA; i++) {
    while (charsA[i] === null) i++;
    while (charsB[k] === null) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }

  const jaro = (
    matches / lenA +
    matches / lenB +
    (matches - transpositions / 2) / matches
  ) / 3;

  // Winkler prefix bonus
  let prefix = 0;
  for (let i = 0; i < start; i++) {
    if (a[i] === b[i]) prefix++;
    else break;
  }

  return Math.min(1.0, jaro + prefix * 0.1 * (1.0 - jaro));
}

/**
 * Normalized Levenshtein similarity.
 * Optimized using 1D Int32Array row buffers to avoid 2D array allocations.
 */
function levenshteinSimilarity(a: string, b: string): number {
  if (a === b) return 1.0;
  const lenA = a.length;
  const lenB = b.length;
  if (lenA === 0 || lenB === 0) return 0.0;

  let prev = new Int32Array(lenA + 1);
  let curr = new Int32Array(lenA + 1);

  for (let j = 0; j <= lenA; j++) {
    prev[j] = j;
  }

  for (let i = 1; i <= lenB; i++) {
    curr[0] = i;
    const charB = b.charCodeAt(i - 1);
    for (let j = 1; j <= lenA; j++) {
      const cost = charB === a.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(
        prev[j - 1] + cost,
        curr[j - 1] + 1,
        prev[j] + 1,
      );
    }
    const temp = prev;
    prev = curr;
    curr = temp;
  }

  const maxLen = Math.max(lenA, lenB);
  return 1.0 - (prev[lenA] / maxLen);
}

/**
 * Combined similarity score.
 */
export function combinedSimilarity(a: string, b: string): number {
  return combinedSimilarityLower(a.toLowerCase(), b.toLowerCase());
}

/**
 * Optimized combined similarity score for pre-lowercased inputs.
 * Avoids redundant string lowercasing in hot loops.
 */
function combinedSimilarityLower(aLower: string, bLower: string): number {
  if (aLower === bLower) return 1.0;
  const jw = jaroWinklerSimilarity(aLower, bLower);
  const lv = levenshteinSimilarity(aLower, bLower);
  // Jaro-Winkler weights name matching more (prefix matters)
  // Levenshtein catches typographical errors
  return jw * 0.7 + lv * 0.3;
}

/**
 * Exact match check (case-insensitive).
 */
function exactMatch(a: string, b: string): boolean {
  return a.toLowerCase().trim() === b.toLowerCase().trim();
}

/**
 * Partial name match: checks if one name contains the other.
 */
function partialNameMatch(a: string, b: string): boolean {
  const aNorm = a.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const bNorm = b.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

  if (aNorm.includes(bNorm) || bNorm.includes(aNorm)) {
    const shorter = Math.min(aNorm.length, bNorm.length);
    const longer = Math.max(aNorm.length, bNorm.length);
    if (shorter > 3 && (shorter / longer) >= 0.7) return true;
  }
  return false;
}

/**
 * Screen a wallet address or identity against sanctions lists.
 *
 * @param target — The wallet address or identity name to screen
 * @param beneficialOwner — Optional beneficial owner name (if known)
 * @param lists — Map of sanctions list names to their entries
 * @param config — Optional screening config overrides
 */
export function screenSanctions(
  target: string,
  beneficialOwner?: string,
  lists: Record<string, SanctionedEntry[]> = {},
  config: Partial<ScreeningConfig> = {},
): ScreeningResult {
  const settings = { ...DEFAULT_CONFIG, ...config };
  const results: MatchedEntry[] = [];

  // Performance optimization: Pre-lowercase target string and beneficialOwner string once
  const targetLower = target.toLowerCase();
  const targetTrimmedLower = targetLower.trim();

  // Screen the wallet address itself (check nationalId fields)
  if (settings.matchNationalIds) {
    for (const [listName, entries] of Object.entries(lists)) {
      for (const entry of entries) {
        for (const natId of entry.nationalIds) {
          const natIdTrimmedLower = natId.toLowerCase().trim();
          if (targetTrimmedLower === natIdTrimmedLower) {
            results.push({
              sanctionedId: entry.id,
              name: entry.name,
              matchField: 'nationalId',
              matchScore: 1.0,
              program: entry.program,
              source: entry.source,
              reason: `Wallet address ${target} found in sanctions nationalId`,
            });
          } else if (settings.fuzzyMatch) {
            // Compute similarity once and reuse score instead of calling twice
            const score = combinedSimilarityLower(targetTrimmedLower, natIdTrimmedLower);
            if (score >= settings.fuzzyTolerance) {
              results.push({
                sanctionedId: entry.id,
                name: entry.name,
                matchField: 'nationalId',
                matchScore: score,
                program: entry.program,
                source: entry.source,
                reason: `Wallet address ${target} fuzzy-matches sanctions nationalId`,
              });
            }
          }
        }
      }
    }
  }

  // Screen the wallet address as a name
  if (settings.fuzzyMatch) {
    for (const [listName, entries] of Object.entries(lists)) {
      for (const entry of entries) {
        // Track best score and field directly to avoid array allocations & redundant calculations
        let bestScore = combinedSimilarityLower(targetLower, entry.name.toLowerCase());
        let bestField = 'name';

        // Compare against aliases
        if (settings.matchAliases) {
          for (const alias of entry.aliases) {
            const score = combinedSimilarityLower(targetLower, alias.toLowerCase());
            if (score > bestScore) {
              bestScore = score;
              bestField = 'alias';
            }
          }
        }

        // Compare against addresses
        if (settings.matchAddresses) {
          for (const addr of entry.addresses) {
            const score = combinedSimilarityLower(targetLower, addr.toLowerCase());
            if (score > bestScore) {
              bestScore = score;
              bestField = 'address';
            }
          }
        }

        if (bestScore >= settings.fuzzyTolerance) {
          results.push({
            sanctionedId: entry.id,
            name: entry.name,
            matchField: bestField,
            matchScore: bestScore,
            program: entry.program,
            source: entry.source,
            reason: `${target} fuzzy-matches sanctions data (${bestField})`,
          });
        }
      }
    }
  }

  // Screen beneficial owner name if provided
  if (beneficialOwner && beneficialOwner.trim()) {
    const boTrimmedLower = beneficialOwner.toLowerCase().trim();
    const boLower = beneficialOwner.toLowerCase();

    for (const [listName, entries] of Object.entries(lists)) {
      for (const entry of entries) {
        let score = 0;
        let matchField: string = 'name';
        const entryNameLower = entry.name.toLowerCase();

        if (boTrimmedLower === entryNameLower.trim()) {
          score = 1.0;
          matchField = 'name';
        } else if (settings.fuzzyMatch) {
          // Try Jaro-Winkler with lowercased inputs
          const jw = jaroWinklerSimilarity(boLower, entryNameLower);
          if (jw >= settings.fuzzyTolerance) {
            score = jw;
            matchField = 'name';
          }

          // Try alias matching
          if (settings.matchAliases && !score) {
            for (const alias of entry.aliases) {
              const aw = jaroWinklerSimilarity(boLower, alias.toLowerCase());
              if (aw >= settings.fuzzyTolerance && aw > score) {
                score = aw;
                matchField = 'alias';
              }
            }
          }

          // Try partial match
          if (!score && partialNameMatch(beneficialOwner, entry.name)) {
            score = 0.75;
            matchField = 'name';
          }
        }

        if (score >= settings.fuzzyTolerance) {
          results.push({
            sanctionedId: entry.id,
            name: entry.name,
            matchField,
            matchScore: score,
            program: entry.program,
            source: entry.source,
            reason: `Beneficial owner "${beneficialOwner}" matches sanctions entry "${entry.name}" (${matchField})`,
          });
        }
      }
    }
  }

  // Deduplicate and sort by score
  const seen = new Set<string>();
  const uniqueResults: MatchedEntry[] = [];
  for (const r of results) {
    const key = `${r.sanctionedId}:${r.matchField}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueResults.push(r);
    }
  }
  uniqueResults.sort((a, b) => b.matchScore - a.matchScore);

  // Take top N
  const topResults = uniqueResults.slice(0, settings.maxResults);

  // Determine overall decision
  const highestScore = topResults.length > 0 ? topResults[0].matchScore : 0;
  const matchedListNames = [...new Set(topResults.map(r => r.source))];

  let status: ScreeningResult['status'] = 'NO_MATCH_FOUND';
  if (highestScore >= settings.failThreshold) {
    status = 'POTENTIAL_MATCH';
  } else if (highestScore >= settings.flagThreshold) {
    status = 'MATCH_REQUIRES_REVIEW';
  }

  // Build matched list names from all entries
  const allListNames = new Set<string>();
  for (const r of topResults) {
    allListNames.add(r.source);
  }

  return {
    screened: target,
    match: status !== 'NO_MATCH_FOUND',
    status,
    confidence: highestScore,
    matchedEntries: topResults,
    matchedListNames: matchedListNames,
    details: topResults.length === 0
      ? 'No sanctions matches found'
      : `${topResults.length} match(es) found. Highest confidence: ${highestScore.toFixed(2)}. Lists: ${matchedListNames.join(', ')}`,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Bulk screen multiple targets.
 */
export function screenBulk(
  targets: { address: string; beneficialOwner?: string }[],
  lists: Record<string, SanctionedEntry[]> = {},
  config?: Partial<ScreeningConfig>,
): ScreeningResult[] {
  return targets.map(t => screenSanctions(t.address, t.beneficialOwner, lists, config));
}
