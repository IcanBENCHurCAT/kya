/**
 * In-Memory Cache Layer — reduces redundant blockchain queries
 * Supports TTL, size limits, and per-entry statistics
 */
import type { CacheStats } from '../types/index.js';
export declare class InMemoryCache<K extends string, V> {
    private store;
    private defaultTTL;
    private maxSize;
    private stats;
    constructor(defaultTTL?: number, maxSize?: number);
    /**
     * Get a value from the cache
     */
    get(key: K): V | null;
    /**
     * Set a value in the cache with TTL
     */
    set(key: K, value: V, ttl?: number): void;
    /**
     * Delete a specific entry
     */
    delete(key: K): boolean;
    /**
     * Clear all entries
     */
    clear(): void;
    /**
     * Get cache statistics
     */
    getStats(): CacheStats;
    /**
     * Get hit rate
     */
    getHitRate(): number;
    /**
     * Remove expired entries
     */
    cleanup(): number;
    /**
     * Evict the oldest entry (to make room for new entries)
     *
     * Note: This relies on ES2015+ guarantees that Map iterates elements in insertion order.
     * Therefore, the first key returned by keys().next() is the oldest inserted key.
     */
    private evictOldest;
    /**
     * Get all keys
     */
    keys(): K[];
    /**
     * Check if cache has a key (without checking expiration)
     */
    has(key: K): boolean;
}
export declare function createAlgorandCache(): InMemoryCache<string, unknown>;
