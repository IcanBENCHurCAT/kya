/**
 * Screening Engine
 *
 * Core fuzzy-matching engine that compares wallet addresses and
 * beneficial owner identities against sanctions watchlists.
 *
 * Returns: pass/fail decision, confidence score, matched list details.
 */
import { SanctionedEntry } from './ofac.js';
export interface ScreeningResult {
    screened: string;
    match: boolean;
    status: 'PASS' | 'FAIL' | 'FLAGGED';
    confidence: number;
    matchedEntries: MatchedEntry[];
    matchedListNames: string[];
    details: string;
    timestamp: string;
}
export interface MatchedEntry {
    sanctionedId: string;
    name: string;
    matchField: string;
    matchScore: number;
    program: string;
    source: string;
    reason: string;
}
/**
 * Screening configuration.
 */
export interface ScreeningConfig {
    /** Confidence threshold for FAIL (default: 0.85) */
    failThreshold: number;
    /** Confidence threshold for FLAG (default: 0.5) */
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
/**
 * Screen a wallet address or identity against sanctions lists.
 *
 * @param target — The wallet address or identity name to screen
 * @param beneficialOwner — Optional beneficial owner name (if known)
 * @param lists — Map of sanctions list names to their entries
 * @param config — Optional screening config overrides
 */
export declare function screenSanctions(target: string, beneficialOwner?: string, lists?: Record<string, SanctionedEntry[]>, config?: Partial<ScreeningConfig>): ScreeningResult;
/**
 * Bulk screen multiple targets.
 */
export declare function screenBulk(targets: {
    address: string;
    beneficialOwner?: string;
}[], lists?: Record<string, SanctionedEntry[]>, config?: Partial<ScreeningConfig>): ScreeningResult[];
