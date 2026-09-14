/**
 * Sibling Wallet Discovery — identifies related wallets through transaction analysis
 * Uses heuristics to discover:
 * - Frequent counterparties (wallets that transact with each other often)
 * - Creator wallets (wallets that funded asset creation)
 * - Deployment wallets (wallets that deployed smart contracts)
 * - Associated wallets (wallets that share funding patterns)
 */

import type {
  AlgorandTransaction,
  SiblingWallet,
  CounterpartyStats,
} from "../types/index.js";
import { InMemoryCache } from "../cache/inMemoryCache.js";

export class SiblingDiscoveryService {
  private cache: InMemoryCache<string, SiblingWallet[]>;
  private frequencyThreshold: number;
  private confidenceDecay: number;

  constructor(
    frequencyThreshold: number = 3,
    confidenceDecay: number = 0.1,
    cache?: InMemoryCache<string, SiblingWallet[]>,
  ) {
    this.frequencyThreshold = frequencyThreshold;
    this.confidenceDecay = confidenceDecay;
    this.cache = cache ?? new InMemoryCache(600_000, 5_000);
  }

  /**
   * Discover sibling wallets for a given address
   * Returns a list of related wallets with relationship types and confidence scores
   */
  discoverSiblings(
    address: string,
    transactions: AlgorandTransaction[],
    counterpartyStats?: CounterpartyStats[],
  ): SiblingWallet[] {
    // Check cache first
    const cached = this.cache.get(address);
    if (cached && counterpartyStats) {
      // Return cached if counterparty stats haven't changed
      return cached;
    }

    const uniqueSiblings: SiblingWallet[] = [];

    // Optimization: Maintain a single seenAddresses set initialized with the target address.
    // Prevents duplicate allocations (Objects, Maps, Sets) and avoids extra deduplication passes.
    const seenAddresses = new Set<string>([address]);

    const counterpartyMap = counterpartyStats
      ? null
      : new Map<
          string,
          { count: number; firstRound: number; lastRound: number; value: number }
        >();

    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i];

      // 1. Frequent counterparties aggregation (if not pre-calculated)
      if (counterpartyMap) {
        const counterparty = tx.type === "sent" ? tx.receiver : tx.sender;
        if (counterparty && counterparty !== address) {
          const existing = counterpartyMap.get(counterparty);
          if (existing) {
            existing.count++;
            existing.value += tx.amount;
            if (tx.round < existing.firstRound) existing.firstRound = tx.round;
            if (tx.round > existing.lastRound) existing.lastRound = tx.round;
          } else {
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
          const receiver = tx.assetTransfer.receiver;
          if (receiver && !seenAddresses.has(receiver)) {
            seenAddresses.add(receiver);
            uniqueSiblings.push({
              address: receiver,
              relationshipType: "creator",
              confidence: 0.85,
              reason:
                "Asset creator wallet for a wallet created by this address",
              interactionCount: 1,
              firstSeenRound: tx.round,
              lastSeenRound: tx.round,
              totalValueTransferred: tx.amount,
            });
          }
        } else if (tx.assetTransfer.receiver === address) {
          const sender = tx.assetTransfer.sender;
          if (sender && !seenAddresses.has(sender)) {
            seenAddresses.add(sender);
            uniqueSiblings.push({
              address: sender,
              relationshipType: "creator",
              confidence: 0.6,
              reason:
                "Wallet that transferred asset to this address (potential creator)",
              interactionCount: 1,
              firstSeenRound: tx.round,
              lastSeenRound: tx.round,
              totalValueTransferred: tx.assetTransfer.amount,
            });
          }
        }
      }
    }

    // Process Frequent Counterparties
    const threshold = this.frequencyThreshold;
    if (counterpartyStats) {
      for (let i = 0; i < counterpartyStats.length; i++) {
        const cs = counterpartyStats[i];
        if (cs.interactionCount >= threshold && !seenAddresses.has(cs.address)) {
          seenAddresses.add(cs.address);
          uniqueSiblings.push({
            address: cs.address,
            relationshipType: "frequent_counterparty",
            confidence: this.calculateFrequentCounterpartyConfidence(
              cs.interactionCount,
              cs.netFlow,
              cs.totalReceived,
              cs.totalSent,
            ),
            reason: `Frequent counterparty with ${cs.interactionCount} interactions`,
            interactionCount: cs.interactionCount,
            firstSeenRound: cs.firstInteractionRound,
            lastSeenRound: cs.lastInteractionRound,
            totalValueTransferred: cs.totalReceived + cs.totalSent,
          });
        }
      }
    } else if (counterpartyMap) {
      for (const [addr, stats] of counterpartyMap) {
        if (stats.count >= threshold && !seenAddresses.has(addr)) {
          seenAddresses.add(addr);
          uniqueSiblings.push({
            address: addr,
            relationshipType: "frequent_counterparty",
            confidence: this.calculateFrequentCounterpartyConfidence(
              stats.count,
              stats.value * -1,
              0,
              0,
            ),
            reason: `Frequent counterparty with ${stats.count} interactions`,
            interactionCount: stats.count,
            firstSeenRound: stats.firstRound,
            lastSeenRound: stats.lastRound,
            totalValueTransferred: stats.value,
          });
        }
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
  private calculateFrequentCounterpartyConfidence(
    interactionCount: number,
    netFlow: number,
    totalReceived: number,
    totalSent: number,
  ): number {
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
  invalidate(address: string): void {
    this.cache.delete(address);
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache stats
   */
  getCacheStats() {
    return this.cache.getStats();
  }
}
