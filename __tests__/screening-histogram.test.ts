import { describe, it, expect } from 'vitest';
import { screenSanctions } from '../src/services/screening.js';
import type { SanctionedEntry } from '../src/services/ofac.js';

function entry(over: Partial<SanctionedEntry> & { name: string }): SanctionedEntry {
  return {
    id: over.id ?? 'test-1',
    name: over.name,
    type: 'individual',
    source: 'TEST',
    program: 'SDN',
    addresses: over.addresses ?? [],
    aliases: over.aliases ?? [],
    nationalities: [],
    nationalIds: over.nationalIds ?? [],
    birthdates: [],
    lastUpdated: '2026-01-01',
  };
}

const lists = {
  test: [
    entry({ id: '1', name: 'Alexander Petrov' }),
    entry({ id: '2', name: 'Maria Garcia Lopez', aliases: ['Maria G. Lopez'] }),
    entry({ id: '3', name: 'Chen Wei', addresses: ['123 Harbor Road Shanghai'] }),
  ],
};

describe('screenSanctions histogram pre-filter (no over-pruning)', () => {
  it('still finds exact name matches at 1.0', () => {
    const r = screenSanctions('Alexander Petrov', undefined, lists);
    expect(r.match).toBe(true);
    expect(r.matchedEntries[0].matchScore).toBe(1.0);
    expect(r.matchedEntries[0].sanctionedId).toBe('1');
  });

  it('still finds fuzzy typo matches above threshold', () => {
    // single substitution: high character overlap, must not be pruned
    const r = screenSanctions('Alexander Petrof', undefined, lists);
    expect(r.match).toBe(true);
    expect(r.matchedEntries[0].sanctionedId).toBe('1');
  });

  it('still finds alias matches', () => {
    const r = screenSanctions('Maria G. Lopez', undefined, lists);
    expect(r.match).toBe(true);
    expect(r.matchedEntries.some(e => e.sanctionedId === '2')).toBe(true);
  });

  it('still finds address matches', () => {
    const r = screenSanctions('123 Harbor Road Shanghai', undefined, lists);
    expect(r.match).toBe(true);
    expect(r.matchedEntries.some(e => e.sanctionedId === '3')).toBe(true);
  });

  it('still finds beneficial owner matches', () => {
    const r = screenSanctions('W5IRXJWPSXNUJVSN2MOEJGTDGKUGFKUDVPTR5ZQVMDG5O4KYD5M3QPG3TE', 'Chen Wei', lists);
    expect(r.matchedEntries.some(e => e.sanctionedId === '3')).toBe(true);
  });

  it('still reports clean for unrelated input', () => {
    const r = screenSanctions('W5IRXJWPSXNUJVSN2MOEJGTDGKUGFKUDVPTR5ZQVMDG5O4KYD5M3QPG3TE', undefined, lists);
    expect(r.match).toBe(false);
    expect(r.status).toBe('NO_MATCH_FOUND');
  });

  it('is deterministic across repeated calls (shared histogram buffer reuse)', () => {
    const a = screenSanctions('Alexander Petrof', undefined, lists);
    const b = screenSanctions('W5IRXJWPSXNUJVSN2MOEJGTDGKUGFKUDVPTR5ZQVMDG5O4KYD5M3QPG3TE', undefined, lists);
    const c = screenSanctions('Alexander Petrof', undefined, lists);
    expect(JSON.stringify({ ...a, timestamp: '' })).toBe(JSON.stringify({ ...c, timestamp: '' }));
    expect(b.match).toBe(false);
  });
});
