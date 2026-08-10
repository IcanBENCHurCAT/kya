/**
 * Sibling Wallet Discovery — identifies related wallets through transaction analysis
 * Uses heuristics to discover:
 * - Frequent counterparties (wallets that transact with each other often)
 * - Creator wallets (wallets that funded asset creation)
 * - Deployment wallets (wallets that deployed smart contracts)
 * - Associated wallets (wallets that share funding patterns)
 */
import { InMemoryCache } from "../cache/inMemoryCache.js";
export class SiblingDiscoveryService {
    cache;
    frequencyThreshold;
    confidenceDecay;
    constructor(frequencyThreshold = 3, confidenceDecay = 0.1, cache) {
        this.frequencyThreshold = frequencyThreshold;
        this.confidenceDecay = confidenceDecay;
        this.cache = cache ?? new InMemoryCache(600_000, 5_000);
    }
    /**
     * Discover sibling wallets for a given address
     * Returns a list of related wallets with relationship types and confidence scores
     */
    discoverSiblings(address, transactions, counterpartyStats) {
        // Check cache first
        const cached = this.cache.get(address);
        if (cached && counterpartyStats) {
            // Return cached if counterparty stats haven't changed
            return cached;
        }
        const siblings = [];
        // We will do a single pass over the transactions
        const counterpartyMap = new Map();
        const seenCreators = new Set();
        const seenDeployers = new Set();
        const senderToReceivers = new Map();
        const excludeSet = new Set([address]);
        for (const tx of transactions) {
            // 1. Frequent counterparties logic
            if (!counterpartyStats) {
                const counterparty = tx.type === "sent" ? tx.receiver : tx.sender;
                if (counterparty && counterparty !== address) {
                    const existing = counterpartyMap.get(counterparty);
                    if (existing) {
                        existing.count++;
                        existing.value += tx.amount;
                        if (tx.round < existing.firstRound)
                            existing.firstRound = tx.round;
                        if (tx.round > existing.lastRound)
                            existing.lastRound = tx.round;
                    }
                    else {
                        counterpartyMap.set(counterparty, {
                            count: 1,
                            firstRound: tx.round,
                            lastRound: tx.round,
                            value: tx.amount,
                        });
                    }
                }
            }
            // 2. Creator wallets logic
            if (tx.assetTransfer) {
                if (tx.assetTransfer.sender === address) {
                    if (tx.assetTransfer.receiver &&
                        tx.assetTransfer.receiver !== address) {
                        if (!seenCreators.has(tx.assetTransfer.receiver)) {
                            seenCreators.add(tx.assetTransfer.receiver);
                            siblings.push({
                                address: tx.assetTransfer.receiver,
                                relationshipType: "creator",
                                confidence: 0.85,
                                reason: "Asset creator wallet for a wallet created by this address",
                                interactionCount: 1,
                                firstSeenRound: tx.round,
                                lastSeenRound: tx.round,
                                totalValueTransferred: tx.amount,
                            });
                        }
                    }
                }
                else if (tx.assetTransfer.receiver === address) {
                    if (tx.assetTransfer.sender &&
                        tx.assetTransfer.sender !== address &&
                        !seenCreators.has(tx.assetTransfer.sender)) {
                        seenCreators.add(tx.assetTransfer.sender);
                        siblings.push({
                            address: tx.assetTransfer.sender,
                            relationshipType: "creator",
                            confidence: 0.6,
                            reason: "Wallet that transferred asset to this address (potential creator)",
                            interactionCount: 1,
                            firstSeenRound: tx.round,
                            lastSeenRound: tx.round,
                            totalValueTransferred: tx.assetTransfer.amount,
                        });
                    }
                }
            }
            // 3. Deployment wallets logic
            if (tx.applicationCall && tx.type === "application") {
                // (Currently stubbed out in the original code, but we keep the loop structure intact if there was any logic)
            }
            // 4. Associated wallets logic
            if (tx.type === "received") {
                const sender = tx.sender;
                if (sender && !excludeSet.has(sender)) {
                    const existing = senderToReceivers.get(sender);
                    if (existing) {
                        existing.receivers.add(address);
                        existing.count++;
                    }
                    else {
                        senderToReceivers.set(sender, {
                            receivers: new Set([address]),
                            count: 1,
                            round: tx.round,
                        });
                    }
                }
            }
        }
        // Process Frequent Counterparties
        const threshold = this.frequencyThreshold;
        if (counterpartyStats) {
            for (const cs of counterpartyStats) {
                if (cs.interactionCount >= threshold) {
                    siblings.push({
                        address: cs.address,
                        relationshipType: "frequent_counterparty",
                        confidence: this.calculateFrequentCounterpartyConfidence(cs.interactionCount, cs.netFlow, cs.totalReceived, cs.totalSent),
                        reason: `Frequent counterparty with ${cs.interactionCount} interactions`,
                        interactionCount: cs.interactionCount,
                        firstSeenRound: cs.firstInteractionRound,
                        lastSeenRound: cs.lastInteractionRound,
                        totalValueTransferred: cs.totalReceived + cs.totalSent,
                    });
                }
            }
        }
        else {
            for (const [addr, stats] of counterpartyMap) {
                if (stats.count >= threshold) {
                    siblings.push({
                        address: addr,
                        relationshipType: "frequent_counterparty",
                        confidence: this.calculateFrequentCounterpartyConfidence(stats.count, stats.value * -1, 0, 0),
                        reason: `Frequent counterparty with ${stats.count} interactions`,
                        interactionCount: stats.count,
                        firstSeenRound: stats.firstRound,
                        lastSeenRound: stats.lastRound,
                        totalValueTransferred: stats.value,
                    });
                }
            }
        }
        // Process Associated Wallets
        // In original code, it iterates over siblings to exclude them. Since siblings array was populated by other methods first, we should make sure we exclude them here.
        const fullExcludeSet = new Set([address]);
        for (const s of siblings) {
            fullExcludeSet.add(s.address);
        }
        const commonSenders = new Map();
        for (const [sender, data] of senderToReceivers) {
            if (data.count > 1 && !fullExcludeSet.has(sender)) {
                commonSenders.set(sender, data.count);
            }
        }
        // Remove duplicates by address
        const seen = new Set();
        const uniqueSiblings = [];
        for (const sibling of siblings) {
            if (!seen.has(sibling.address)) {
                seen.add(sibling.address);
                uniqueSiblings.push(sibling);
            }
        }
        // Sort by confidence (descending)
        uniqueSiblings.sort((a, b) => b.confidence - a.confidence);
        // Cache the result
        if (counterpartyStats) {
            this.cache.set(address, uniqueSiblings);
        }
        return uniqueSiblings;
    }
    /**
     * Calculate confidence score for a frequent counterparty
     * Based on interaction count, flow balance, and recency
     */
    calculateFrequentCounterpartyConfidence(interactionCount, netFlow, totalReceived, totalSent) {
        // Base confidence from interaction count
        let confidence = 0.3;
        // Scale by interaction count (diminishing returns)
        const countScore = Math.min(interactionCount / 10, 1);
        confidence += countScore * 0.4;
        // Bonus for bidirectional flow (both sent and received)
        if (totalReceived > 0 && totalSent > 0) {
            confidence += 0.2;
        }
        // Penalty for extreme net flow (one-sided)
        const totalFlow = totalReceived + totalSent;
        if (totalFlow > 0) {
            const ratio = Math.min(totalReceived, totalSent) / totalFlow;
            if (ratio < 0.3) {
                confidence -= 0.1; // One-sided relationship
            }
        }
        // Clamp to [0, 1]
        return Math.max(0, Math.min(1, confidence));
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
}
