/**
 * Represents a single Algorand transaction
 */
export interface AlgorandTransaction {
    txid: string;
    round: number;
    timestamp: number;
    sender: string;
    receiver: string;
    amount: number;
    fee: number;
    type: 'sent' | 'received' | 'application';
    note?: string;
    closeRemainderTo?: string;
    assetTransfer?: {
        assetId: number;
        amount: number;
        receiver: string;
        sender: string;
        closeTo?: string;
    };
    applicationCall?: {
        type: 'NoOp' | 'OptIn' | 'CloseOut' | 'ClearState' | 'UpdateApplication' | 'DeleteApplication';
        applicationId?: number;
        onCompletion: string;
    };
    blockHash?: string;
    confirmations: number;
}
/**
 * Aggregated transaction history for a wallet
 */
export interface WalletTransactionHistory {
    address: string;
    totalTransactions: number;
    incomingTransactions: number;
    outgoingTransactions: number;
    totalReceived: number;
    totalSent: number;
    netBalance: number;
    firstSeenRound: number;
    lastSeenRound: number;
    transactions: AlgorandTransaction[];
    topCounterparties: CounterpartyStats[];
    topAssets: AssetStats[];
}
/**
 * Statistics about a counterparty wallet
 */
export interface CounterpartyStats {
    address: string;
    interactionCount: number;
    totalReceived: number;
    totalSent: number;
    netFlow: number;
    firstInteractionRound: number;
    lastInteractionRound: number;
    interactionTypes: {
        sent: number;
        received: number;
        assetTransfer: number;
    };
}
/**
 * Statistics about an asset
 */
export interface AssetStats {
    assetId: number;
    name?: string;
    totalTransfers: number;
    netBalance: number;
}
/**
 * A sibling wallet that has been discovered through analysis
 */
export interface SiblingWallet {
    address: string;
    relationshipType: 'frequent_counterparty' | 'creator' | 'deployer' | 'associated';
    confidence: number;
    reason: string;
    interactionCount: number;
    firstSeenRound: number;
    lastSeenRound: number;
    totalValueTransferred: number;
}
/**
 * Wallet graph edge
 */
export interface WalletGraphEdge {
    source: string;
    target: string;
    weight: number;
    relationshipType: 'frequent_counterparty' | 'creator' | 'deployer' | 'associated';
    firstInteractionRound: number;
    lastInteractionRound: number;
    totalValueTransferred: number;
    metadata?: Record<string, unknown>;
}
/**
 * Wallet graph node
 */
export interface WalletGraphNode {
    address: string;
    transactionCount: number;
    siblingCount: number;
    totalValueIn: number;
    totalValueOut: number;
    firstSeenRound: number;
    lastSeenRound: number;
}
/**
 * Configuration for the Algorand client
 */
export interface AlgorandConfig {
    network: 'mainnet' | 'testnet' | 'betanet' | 'devnet';
    nodeURL: string;
    port?: number | string;
    token?: string;
    indexerURL?: string;
    indexerPort?: number | string;
    indexerToken?: string;
}
/**
 * Default configuration
 */
export declare const DEFAULT_CONFIG: AlgorandConfig;
/**
 * Cache entry with TTL
 */
export interface CacheEntry<T> {
    value: T;
    timestamp: number;
    ttl: number;
    hitCount: number;
}
/**
 * Cache statistics
 */
export interface CacheStats {
    hits: number;
    misses: number;
    size: number;
    entries: Record<string, number>;
}
