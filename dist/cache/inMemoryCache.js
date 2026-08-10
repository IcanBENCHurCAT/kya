/**
 * In-Memory Cache Layer — reduces redundant blockchain queries
 * Supports TTL, size limits, and per-entry statistics
 */
export class InMemoryCache {
    store;
    defaultTTL; // milliseconds
    maxSize;
    stats = { hits: 0, misses: 0 };
    constructor(defaultTTL = 300_000, maxSize = 10_000) {
        this.store = new Map();
        this.defaultTTL = defaultTTL;
        this.maxSize = maxSize;
    }
    /**
     * Get a value from the cache
     */
    get(key) {
        const entry = this.store.get(key);
        if (!entry) {
            this.stats.misses++;
            return null;
        }
        // Check if expired
        if (Date.now() - entry.timestamp > entry.ttl) {
            this.store.delete(key);
            this.stats.misses++;
            return null;
        }
        entry.hitCount++;
        this.stats.hits++;
        return entry.value;
    }
    /**
     * Set a value in the cache with TTL
     */
    set(key, value, ttl) {
        // Evict if at capacity
        if (this.store.size >= this.maxSize) {
            this.evictOldest();
        }
        this.store.set(key, {
            value,
            timestamp: Date.now(),
            ttl: ttl ?? this.defaultTTL,
            hitCount: 0,
        });
    }
    /**
     * Delete a specific entry
     */
    delete(key) {
        return this.store.delete(key);
    }
    /**
     * Clear all entries
     */
    clear() {
        this.store.clear();
        this.stats = { hits: 0, misses: 0 };
    }
    /**
     * Get cache statistics
     */
    getStats() {
        const entries = {};
        const now = Date.now();
        for (const [key, entry] of this.store) {
            entries[key] = Math.max(0, (entry.timestamp + entry.ttl) - now);
        }
        return {
            hits: this.stats.hits,
            misses: this.stats.misses,
            size: this.store.size,
            entries,
        };
    }
    /**
     * Get hit rate
     */
    getHitRate() {
        const total = this.stats.hits + this.stats.misses;
        if (total === 0)
            return 0;
        return this.stats.hits / total;
    }
    /**
     * Remove expired entries
     */
    cleanup() {
        let removed = 0;
        const now = Date.now();
        for (const [key, entry] of this.store) {
            if (now - entry.timestamp > entry.ttl) {
                this.store.delete(key);
                removed++;
            }
        }
        return removed;
    }
    /**
     * Evict the oldest entry (to make room for new entries)
     */
    evictOldest() {
        if (this.store.size === 0)
            return;
        // Maps preserve insertion order, so the first key is the oldest
        const firstKey = this.store.keys().next().value;
        if (firstKey !== undefined) {
            this.store.delete(firstKey);
        }
    }
    /**
     * Get all keys
     */
    keys() {
        return Array.from(this.store.keys());
    }
    /**
     * Check if cache has a key (without checking expiration)
     */
    has(key) {
        return this.store.has(key);
    }
}
// Convenience: create a preconfigured cache for Algorand queries
export function createAlgorandCache() {
    return new InMemoryCache(300_000, // 5 minute TTL for transaction queries
    5_000 // max 5000 entries
    );
}
