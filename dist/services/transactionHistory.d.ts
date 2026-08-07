/**
 * Transaction History Service — queries and structures wallet transaction data
 * Provides aggregated transaction history with counterparty analysis
 */
import type { AlgorandTransaction, WalletTransactionHistory, CounterpartyStats } from '../types/index.js';
import { AlgorandClient } from '../algorand/client.js';
import { InMemoryCache } from '../cache/inMemoryCache.js';
export declare class TransactionHistoryService {
    private client;
    private cache;
    private maxRetries;
    private retryDelayMs;
    constructor(client: AlgorandClient, cache?: InMemoryCache<string, WalletTransactionHistory>);
    /**
     * Get complete transaction history for an address
     * Aggregates incoming/outgoing transactions, computes counterparty stats
     */
    getTransactionHistory(address: string, options?: {
        limit?: number;
        beforeRound?: number;
        afterRound?: number;
        forceRefresh?: boolean;
    }): Promise<WalletTransactionHistory>;
    /**
     * Get just the incoming transactions (wallet received funds)
     */
    getIncomingTransactions(address: string, options?: {
        limit?: number;
    }): Promise<AlgorandTransaction[]>;
    /**
     * Get just the outgoing transactions (wallet sent funds)
     */
    getOutgoingTransactions(address: string, options?: {
        limit?: number;
    }): Promise<AlgorandTransaction[]>;
    /**
     * Get top counterparties for an address
     */
    getTopCounterparties(address: string, limit?: number): CounterpartyStats[];
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
    private aggregateTransactions;
    private delay;
}
