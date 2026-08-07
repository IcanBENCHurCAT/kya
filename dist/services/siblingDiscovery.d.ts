/**
 * Sibling Wallet Discovery — identifies related wallets through transaction analysis
 * Uses heuristics to discover:
 * - Frequent counterparties (wallets that transact with each other often)
 * - Creator wallets (wallets that funded asset creation)
 * - Deployment wallets (wallets that deployed smart contracts)
 * - Associated wallets (wallets that share funding patterns)
 */
import type { AlgorandTransaction, SiblingWallet, CounterpartyStats } from '../types/index.js';
import { InMemoryCache } from '../cache/inMemoryCache.js';
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
     * Find frequent counterparties based on transaction frequency
     * Heuristic: wallets that have interacted >= threshold times are "frequent"
     */
    private discoverFrequentCounterparties;
    /**
     * Find creator wallets — wallets that funded the creation of assets
     * Heuristic: look for asset creation transactions where this wallet was the funder
     */
    private discoverCreatorWallets;
    /**
     * Find deployment wallets — wallets that deployed smart contracts
     * Heuristic: look for application creation/creation transactions
     */
    private discoverDeploymentWallets;
    /**
     * Find associated wallets — wallets that share common funding sources
     * Heuristic: if wallet A and wallet B both receive from the same sender,
     * they may be associated
     */
    private discoverAssociatedWallets;
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
