/**
 * Sibling Wallet Discovery — identifies related wallets through transaction analysis
 * Uses heuristics to discover:
 * - Frequent counterparties (wallets that transact with each other often)
 * - Creator wallets (wallets that funded asset creation)
 * - Deployment wallets (wallets that deployed smart contracts)
 * - Associated wallets (wallets that share funding patterns)
 */
import type { AlgorandTransaction, SiblingWallet, CounterpartyStats } from "../types/index.js";
import { InMemoryCache } from "../cache/inMemoryCache.js";
export declare class SiblingDiscoveryService {
    private cache;
    private frequencyThreshold;
    private confidenceDecay;
    constructor(frequencyThreshold?: number, confidenceDecay?: number, cache?: InMemoryCache<string, SiblingWallet[]>);
    /**
     * Discover sibling wallets for a given address
     * Returns a list of related wallets with relationship types and confidence scores
     */
    discoverSiblings(address: string, transactions: AlgorandTransaction[], counterpartyStats?: CounterpartyStats[]): SiblingWallet[];
    /**
     * Calculate confidence score for a frequent counterparty
     * Based on interaction count, flow balance, and recency
     */
    private calculateFrequentCounterpartyConfidence;
    /**
     * Clear cache for a specific address
     */
    invalidate(address: string): void;
    /**
     * Clear all cached data
     */
    clearCache(): void;
    /**
     * Get cache stats
     */
    getCacheStats(): import("../types/index.js").CacheStats;
}
