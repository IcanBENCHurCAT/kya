/**
 * Transaction History Service — queries and structures wallet transaction data
 * Provides aggregated transaction history with counterparty analysis
 */
import { InMemoryCache } from '../cache/inMemoryCache.js';
export class TransactionHistoryService {
    client;
    cache;
    maxRetries;
    retryDelayMs;
    constructor(client, cache) {
        this.client = client;
        this.cache = cache ?? new InMemoryCache(300_000, 10_000);
        this.maxRetries = 3;
        this.retryDelayMs = 500;
    }
    /**
     * Get complete transaction history for an address
     * Aggregates incoming/outgoing transactions, computes counterparty stats
     */
    async getTransactionHistory(address, options) {
        // Check cache first (unless force refresh)
        if (!options?.forceRefresh) {
            const cached = this.cache.get(address);
            if (cached) {
                return cached;
            }
        }
        // Fetch transactions with pagination to get full history
        const allTransactions = [];
        let cursor = 0;
        const pageSize = options?.limit ?? 1000;
        for (let attempt = 0; attempt < this.maxRetries; attempt++) {
            try {
                const batch = await this.client.getTransactionsByAddress(address, {
                    limit: pageSize,
                    beforeRound: options?.beforeRound,
                    afterRound: options?.afterRound,
                });
                allTransactions.push(...batch);
                if (batch.length < pageSize) {
                    break; // No more transactions
                }
                cursor += batch.length;
            }
            catch (error) {
                if (attempt < this.maxRetries - 1) {
                    await this.delay(this.retryDelayMs * (attempt + 1));
                }
                else {
                    throw new Error(`Failed to fetch transactions for ${address} after ${this.maxRetries} retries: ${error}`);
                }
            }
        }
        // Aggregate into structured history
        const history = this.aggregateTransactions(address, allTransactions);
        // Cache the result
        this.cache.set(address, history);
        return history;
    }
    /**
     * Get just the incoming transactions (wallet received funds)
     */
    async getIncomingTransactions(address, options) {
        const history = await this.getTransactionHistory(address, {
            limit: options?.limit,
        });
        return history.transactions.filter((tx) => tx.type === 'received');
    }
    /**
     * Get just the outgoing transactions (wallet sent funds)
     */
    async getOutgoingTransactions(address, options) {
        const history = await this.getTransactionHistory(address, {
            limit: options?.limit,
        });
        return history.transactions.filter((tx) => tx.type === 'sent');
    }
    /**
     * Get top counterparties for an address
     */
    getTopCounterparties(address, limit = 10) {
        const history = this.cache.get(address);
        if (!history) {
            return [];
        }
        return history.topCounterparties.slice(0, limit);
    }
    /**
     * Clear cache for a specific address
     */
    invalidate(address) {
        this.cache.delete(address);
    }
    /**
     * Clear all cached data
     */
    clearCache() {
        this.cache.clear();
    }
    /**
     * Get cache stats
     */
    getCacheStats() {
        return this.cache.getStats();
    }
    // ===== Internal helpers =====
    aggregateTransactions(address, transactions) {
        const incoming = [];
        const outgoing = [];
        for (const tx of transactions) {
            if (tx.type === 'received') {
                incoming.push(tx);
            }
            else {
                outgoing.push(tx);
            }
        }
        const totalReceived = incoming.reduce((sum, tx) => sum + tx.amount, 0);
        const totalSent = outgoing.reduce((sum, tx) => sum + tx.amount, 0);
        // Compute counterparty stats
        const counterpartyMap = new Map();
        for (const tx of incoming) {
            const sender = tx.sender;
            if (sender === address)
                continue; // Skip self-transfers
            const existing = counterpartyMap.get(sender);
            if (existing) {
                existing.interactionCount++;
                existing.totalReceived += tx.amount;
                if (tx.round < existing.firstInteractionRound) {
                    existing.firstInteractionRound = tx.round;
                }
                if (tx.round > existing.lastInteractionRound) {
                    existing.lastInteractionRound = tx.round;
                }
                existing.interactionTypes.received++;
            }
            else {
                counterpartyMap.set(sender, {
                    address: sender,
                    interactionCount: 1,
                    totalReceived: tx.amount,
                    totalSent: 0,
                    netFlow: tx.amount,
                    firstInteractionRound: tx.round,
                    lastInteractionRound: tx.round,
                    interactionTypes: { sent: 0, received: 1, assetTransfer: 0 },
                });
            }
        }
        for (const tx of outgoing) {
            const receiver = tx.receiver || tx.assetTransfer?.receiver;
            if (!receiver || receiver === address)
                continue;
            const existing = counterpartyMap.get(receiver);
            if (existing) {
                existing.interactionCount++;
                existing.totalSent += tx.amount;
                if (tx.round < existing.firstInteractionRound) {
                    existing.firstInteractionRound = tx.round;
                }
                if (tx.round > existing.lastInteractionRound) {
                    existing.lastInteractionRound = tx.round;
                }
                existing.interactionTypes.sent++;
            }
            else {
                counterpartyMap.set(receiver, {
                    address: receiver,
                    interactionCount: 1,
                    totalReceived: 0,
                    totalSent: tx.amount,
                    netFlow: -tx.amount,
                    firstInteractionRound: tx.round,
                    lastInteractionRound: tx.round,
                    interactionTypes: { sent: 1, received: 0, assetTransfer: 0 },
                });
            }
        }
        // Sort by interaction count (descending)
        const topCounterparties = Array.from(counterpartyMap.values())
            .sort((a, b) => b.interactionCount - a.interactionCount);
        // Compute asset stats
        const assetMap = new Map();
        for (const tx of transactions) {
            if (tx.assetTransfer) {
                const assetId = tx.assetTransfer.assetId;
                const existing = assetMap.get(assetId);
                if (existing) {
                    existing.totalTransfers++;
                    existing.netBalance += tx.assetTransfer.amount;
                }
                else {
                    assetMap.set(assetId, {
                        assetId,
                        totalTransfers: 1,
                        netBalance: tx.assetTransfer.amount,
                    });
                }
            }
        }
        const topAssets = Array.from(assetMap.values()).sort((a, b) => b.totalTransfers - a.totalTransfers);
        return {
            address,
            totalTransactions: transactions.length,
            incomingTransactions: incoming.length,
            outgoingTransactions: outgoing.length,
            totalReceived,
            totalSent,
            netBalance: totalReceived - totalSent,
            firstSeenRound: transactions.length
                ? Math.min(...transactions.map((tx) => tx.round))
                : 0,
            lastSeenRound: transactions.length
                ? Math.max(...transactions.map((tx) => tx.round))
                : 0,
            transactions,
            topCounterparties,
            topAssets,
        };
    }
    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
