/**
 * Screening Engine
 *
 * Core fuzzy-matching engine that compares wallet addresses and
 * beneficial owner identities against sanctions watchlists.
 *
 * Returns: pass/fail decision, confidence score, matched list details.
 */
const DEFAULT_CONFIG = {
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
function jaroWinklerSimilarity(a, b) {
    if (a === b)
        return 1.0;
    if (a.length === 0 || b.length === 0)
        return 0.0;
    const lenA = a.length;
    const lenB = b.length;
    const maxDist = Math.max(lenA, lenB) / 2 - 1;
    const charsA = new Array(lenA).fill(null);
    const charsB = new Array(lenB).fill(null);
    let matches = 0;
    const start = Math.min(4, Math.min(lenA, lenB));
    for (let i = 0; i < lenA; i++) {
        const lowerBound = Math.max(0, i - maxDist);
        const upperBound = Math.min(lenB - 1, i + maxDist);
        for (let j = lowerBound; j <= upperBound; j++) {
            if (charsB[j] !== null)
                continue;
            if (a[i] === b[j]) {
                charsA[i] = b[j];
                charsB[j] = a[i];
                matches++;
                break;
            }
        }
    }
    if (matches === 0)
        return 0.0;
    let transpositions = 0;
    let k = 0;
    for (let i = 0; i < lenA; i++) {
        while (charsA[i] === null)
            i++;
        while (charsB[k] === null)
            k++;
        if (a[i] !== b[k])
            transpositions++;
        k++;
    }
    const jaro = (matches / lenA +
        matches / lenB +
        (matches - transpositions / 2) / matches) / 3;
    // Winkler prefix bonus
    let prefix = 0;
    for (let i = 0; i < start; i++) {
        if (a[i] === b[i])
            prefix++;
        else
            break;
    }
    return Math.min(1.0, jaro + prefix * 0.1 * (1.0 - jaro));
}
/**
 * Normalized Levenshtein similarity.
 */
function levenshteinSimilarity(a, b) {
    if (a === b)
        return 1.0;
    if (a.length === 0 || b.length === 0)
        return 0.0;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b[i - 1] === a[j - 1]) {
                matrix[i][j] = matrix[i - 1][j - 1];
            }
            else {
                matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
            }
        }
    }
    const maxLen = Math.max(a.length, b.length);
    return 1.0 - (matrix[b.length][a.length] / maxLen);
}
/**
 * Combined similarity score.
 */
function combinedSimilarity(a, b) {
    const jw = jaroWinklerSimilarity(a.toLowerCase(), b.toLowerCase());
    const lv = levenshteinSimilarity(a.toLowerCase(), b.toLowerCase());
    // Jaro-Winkler weights name matching more (prefix matters)
    // Levenshtein catches typographical errors
    return jw * 0.7 + lv * 0.3;
}
/**
 * Exact match check (case-insensitive).
 */
function exactMatch(a, b) {
    return a.toLowerCase().trim() === b.toLowerCase().trim();
}
/**
 * Partial name match: checks if one name contains the other.
 */
function partialNameMatch(a, b) {
    const aNorm = a.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const bNorm = b.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    if (aNorm.includes(bNorm) || bNorm.includes(aNorm)) {
        const shorter = Math.min(aNorm.length, bNorm.length);
        const longer = Math.max(aNorm.length, bNorm.length);
        if (shorter > 3 && (shorter / longer) >= 0.7)
            return true;
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
export function screenSanctions(target, beneficialOwner, lists = {}, config = {}) {
    const settings = { ...DEFAULT_CONFIG, ...config };
    const results = [];
    // Screen the wallet address itself (check nationalId fields)
    if (settings.matchNationalIds) {
        for (const [listName, entries] of Object.entries(lists)) {
            for (const entry of entries) {
                for (const natId of entry.nationalIds) {
                    if (exactMatch(target, natId)) {
                        results.push({
                            sanctionedId: entry.id,
                            name: entry.name,
                            matchField: 'nationalId',
                            matchScore: 1.0,
                            program: entry.program,
                            source: entry.source,
                            reason: `Wallet address ${target} found in sanctions nationalId`,
                        });
                    }
                    else if (settings.fuzzyMatch && combinedSimilarity(target, natId) >= settings.fuzzyTolerance) {
                        results.push({
                            sanctionedId: entry.id,
                            name: entry.name,
                            matchField: 'nationalId',
                            matchScore: combinedSimilarity(target, natId),
                            program: entry.program,
                            source: entry.source,
                            reason: `Wallet address ${target} fuzzy-matches sanctions nationalId`,
                        });
                    }
                }
            }
        }
    }
    // Screen the wallet address as a name
    if (settings.fuzzyMatch) {
        for (const [listName, entries] of Object.entries(lists)) {
            for (const entry of entries) {
                const scores = [];
                // Compare against main name
                scores.push(combinedSimilarity(target, entry.name));
                // Compare against aliases
                if (settings.matchAliases) {
                    for (const alias of entry.aliases) {
                        scores.push(combinedSimilarity(target, alias));
                    }
                }
                // Compare against addresses
                if (settings.matchAddresses) {
                    for (const addr of entry.addresses) {
                        scores.push(combinedSimilarity(target, addr));
                    }
                }
                const maxScore = Math.max(...scores, 0);
                if (maxScore >= settings.fuzzyTolerance) {
                    const matchField = maxScore === combinedSimilarity(target, entry.name)
                        ? 'name'
                        : settings.matchAliases && scores.includes(maxScore)
                            ? 'alias'
                            : 'address';
                    results.push({
                        sanctionedId: entry.id,
                        name: entry.name,
                        matchField,
                        matchScore: maxScore,
                        program: entry.program,
                        source: entry.source,
                        reason: `${target} fuzzy-matches sanctions data (${matchField})`,
                    });
                }
            }
        }
    }
    // Screen beneficial owner name if provided
    if (beneficialOwner && beneficialOwner.trim()) {
        for (const [listName, entries] of Object.entries(lists)) {
            for (const entry of entries) {
                let score = 0;
                let matchField = 'name';
                if (exactMatch(beneficialOwner, entry.name)) {
                    score = 1.0;
                    matchField = 'name';
                }
                else if (settings.fuzzyMatch) {
                    // Try Jaro-Winkler
                    const jw = jaroWinklerSimilarity(beneficialOwner, entry.name);
                    if (jw >= settings.fuzzyTolerance) {
                        score = jw;
                        matchField = 'name';
                    }
                    // Try alias matching
                    if (settings.matchAliases && !score) {
                        for (const alias of entry.aliases) {
                            const aw = jaroWinklerSimilarity(beneficialOwner, alias);
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
    const seen = new Set();
    const uniqueResults = [];
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
    let status = 'PASS';
    if (highestScore >= settings.failThreshold) {
        status = 'FAIL';
    }
    else if (highestScore >= settings.flagThreshold) {
        status = 'FLAGGED';
    }
    // Build matched list names from all entries
    const allListNames = new Set();
    for (const r of topResults) {
        allListNames.add(r.source);
    }
    return {
        screened: target,
        match: status !== 'PASS',
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
export function screenBulk(targets, lists = {}, config) {
    return targets.map(t => screenSanctions(t.address, t.beneficialOwner, lists, config));
}
