/**
 * Algorand Client — connects to Algorand nodes and indexers
 * Provides methods to query transactions, accounts, and asset data
 *
 * Compatible with algosdk v2.7.x (uses the builder-pattern indexer/algod API)
 */
import type { AlgorandConfig, AlgorandTransaction } from '../types/index.js';
export declare class AlgorandClient {
    private algod;
    private indexer;
    private config;
    private network;
    constructor(config?: Partial<AlgorandConfig>);
    /**
     * Get current network parameters (node status)
     */
    getNetworkParams(): Promise<{
        lastRound: number;
        version: string;
        timeSinceRound: number;
        caughtUp: boolean;
    }>;
    /**
     * Get account information including balance and assets
     */
    getAccountInfo(address: string): Promise<Record<string, unknown>>;
    /**
     * Get transaction by ID
     */
    getTransactionByID(txID: string): Promise<Record<string, unknown>>;
    /**
     * Query all transactions for an address (incoming and outgoing)
     * Uses the Algorand Indexer API with builder-style query params
     */
    getTransactionsByAddress(address: string, options?: {
        limit?: number;
        beforeRound?: number;
        afterRound?: number;
        startTime?: number;
        endTime?: number;
        minAmount?: number;
        maxAmount?: number;
        assetId?: number;
    }): Promise<AlgorandTransaction[]>;
    /**
     * Query pending transactions for an address
     */
    getPendingTransactionsByAddress(address: string): Promise<Record<string, unknown>[]>;
    /**
     * Query transactions by application ID (smart contract interactions)
     * Uses the generic searchForTransactions with application-id filter
     */
    getTransactionsByApplication(appID: number, options?: {
        limit?: number;
        beforeRound?: number;
        afterRound?: number;
    }): Promise<AlgorandTransaction[]>;
    /**
     * Query asset transactions (opt-in, transfer, opt-out)
     */
    getAssetTransactions(assetId: number, options?: {
        limit?: number;
    }): Promise<AlgorandTransaction[]>;
    /**
     * Get current round number
     */
    getCurrentRound(): Promise<number>;
    /**
     * Search for accounts by asset balance
     */
    searchAccountsByAsset(assetId: number): Promise<Record<string, unknown>>;
    /**
     * Search for accounts by min balance (uses currencyGreaterThan as proxy)
     */
    searchAccountsByMinBalance(minBalance: number): Promise<Record<string, unknown>>;
    /**
     * Look up asset by ID
     */
    getAssetByID(assetId: number): Promise<Record<string, unknown>>;
    /**
     * Look up block by round
     */
    getBlockByRound(round: number): Promise<Record<string, unknown>>;
    /**
     * Internal: Parse raw transaction results into our structured format
     *
     * The algosdk v2.x indexer returns transactions in a nested structure:
     * { transactions: [ { tx: { ... }, ...confirmedRound, ...block-time }, ... ] }
     */
    private parseTransactions;
    private mapOnCompletion;
}
