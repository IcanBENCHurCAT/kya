/**
 * Sibling Wallet Discovery — identifies related wallets through transaction analysis
 * Uses heuristics to discover:
 * - Frequent counterparties (wallets that transact with each other often)
 * - Creator wallets (wallets that funded asset creation)
 * - Deployment wallets (wallets that deployed smart contracts)
 * - Associated wallets (wallets that share funding patterns)
 */
import { InMemoryCache } from '../cache/inMemoryCache.js';
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
        // 1. Discover frequent counterparties
        const frequent = this.discoverFrequentCounterparties(address, transactions, counterpartyStats);
        siblings.push(...frequent);
        // 2. Discover creator wallets
        const creators = this.discoverCreatorWallets(address, transactions);
        siblings.push(...creators);
        // 3. Discover deployment wallets
        const deployers = this.discoverDeploymentWallets(address, transactions);
        siblings.push(...deployers);
        // 4. Discover associated wallets (shared funding sources)
        const associated = this.discoverAssociatedWallets(address, transactions, siblings.map((s) => s.address));
        siblings.push(...associated);
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
     * Find frequent counterparties based on transaction frequency
     * Heuristic: wallets that have interacted >= threshold times are "frequent"
     */
    discoverFrequentCounterparties(address, transactions, counterpartyStats) {
        const siblings = [];
        const threshold = this.frequencyThreshold;
        // Use counterparty stats if provided (more efficient)
        if (counterpartyStats) {
            for (const cs of counterpartyStats) {
                if (cs.interactionCount >= threshold) {
                    siblings.push({
                        address: cs.address,
                        relationshipType: 'frequent_counterparty',
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
            // Fall back to counting from raw transactions
            const counterpartyMap = new Map();
            for (const tx of transactions) {
                const counterparty = tx.type === 'sent' ? tx.receiver : tx.sender;
                if (!counterparty || counterparty === address)
                    continue;
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
            for (const [addr, stats] of counterpartyMap) {
                if (stats.count >= threshold) {
                    siblings.push({
                        address: addr,
                        relationshipType: 'frequent_counterparty',
                        confidence: this.calculateFrequentCounterpartyConfidence(stats.count, stats.value * -1, // No flow direction info from raw tx
                        0, 0),
                        reason: `Frequent counterparty with ${stats.count} interactions`,
                        interactionCount: stats.count,
                        firstSeenRound: stats.firstRound,
                        lastSeenRound: stats.lastRound,
                        totalValueTransferred: stats.value,
                    });
                }
            }
        }
        return siblings;
    }
    /**
     * Find creator wallets — wallets that funded the creation of assets
     * Heuristic: look for asset creation transactions where this wallet was the funder
     */
    discoverCreatorWallets(address, transactions) {
        const siblings = [];
        const seenCreators = new Set();
        for (const tx of transactions) {
            // Look for asset creation or opt-in transactions
            if (tx.assetTransfer) {
                // Check if this wallet funded the creation
                if (tx.assetTransfer.sender === address) {
                    // This wallet funded the asset creation
                    // The receiver would be the creator wallet (or they're the same)
                    if (tx.assetTransfer.receiver &&
                        tx.assetTransfer.receiver !== address) {
                        if (!seenCreators.has(tx.assetTransfer.receiver)) {
                            seenCreators.add(tx.assetTransfer.receiver);
                            siblings.push({
                                address: tx.assetTransfer.receiver,
                                relationshipType: 'creator',
                                confidence: 0.85,
                                reason: 'Asset creator wallet for a wallet created by this address',
                                interactionCount: 1,
                                firstSeenRound: tx.round,
                                lastSeenRound: tx.round,
                                totalValueTransferred: tx.amount,
                            });
                        }
                    }
                }
            }
            // Check for creator transactions (asset creation)
            if (tx.assetTransfer) {
                // If we see this wallet opt-in to an asset, the creator might be related
                if (tx.assetTransfer.receiver === address) {
                    // This wallet received an asset, check if the sender is a creator
                    if (tx.assetTransfer.sender &&
                        tx.assetTransfer.sender !== address &&
                        !seenCreators.has(tx.assetTransfer.sender)) {
                        // Could be a creator - lower confidence since we need more context
                        seenCreators.add(tx.assetTransfer.sender);
                        siblings.push({
                            address: tx.assetTransfer.sender,
                            relationshipType: 'creator',
                            confidence: 0.6,
                            reason: 'Wallet that transferred asset to this address (potential creator)',
                            interactionCount: 1,
                            firstSeenRound: tx.round,
                            lastSeenRound: tx.round,
                            totalValueTransferred: tx.assetTransfer.amount,
                        });
                    }
                }
            }
        }
        return siblings;
    }
    /**
     * Find deployment wallets — wallets that deployed smart contracts
     * Heuristic: look for application creation/creation transactions
     */
    discoverDeploymentWallets(address, transactions) {
        const siblings = [];
        const seenDeployers = new Set();
        for (const tx of transactions) {
            if (tx.applicationCall) {
                // Look for contract creation/interaction patterns
                if (tx.type === 'application') {
                    // Check if this wallet created the contract
                    // In Algorand, the sender of the creation transaction is the creator
                    if (tx.sender === address) {
                        // This wallet deployed a smart contract
                        // Look for other wallets that interacted with the same contract
                        // For now, we mark this as a deployer wallet
                        // (the deployer IS the address itself, but we track it)
                    }
                    // Check if the app ID is relevant
                    if (tx.applicationCall.applicationId) {
                        // This is an interaction with a deployed contract
                        // Other wallets that interacted with the same contract could be related
                    }
                }
            }
        }
        // For now, deployment wallet discovery is limited without full context
        // In a production system, this would cross-reference with all transactions
        // that created or interacted with the same application ID
        return siblings;
    }
    /**
     * Find associated wallets — wallets that share common funding sources
     * Heuristic: if wallet A and wallet B both receive from the same sender,
     * they may be associated
     */
    discoverAssociatedWallets(address, transactions, excludeAddresses) {
        const siblings = [];
        const excludeSet = new Set([...excludeAddresses, address]);
        // Build a map of sender -> list of receivers
        const senderToReceivers = new Map();
        for (const tx of transactions) {
            if (tx.type === 'received') {
                const sender = tx.sender;
                if (!sender || excludeSet.has(sender))
                    continue;
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
        // Find other wallets that share senders with this address
        const commonSenders = new Map();
        for (const [sender, data] of senderToReceivers) {
            if (data.count > 1 && !excludeSet.has(sender)) {
                commonSenders.set(sender, data.count);
            }
        }
        // For now, we just note the common senders
        // In a full implementation, we'd also query the blockchain to find
        // all receivers of these senders and correlate them
        return siblings;
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
