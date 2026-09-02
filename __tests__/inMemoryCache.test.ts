import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { InMemoryCache, createAlgorandCache } from "../src/cache/inMemoryCache.js";

describe("InMemoryCache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Constructor & Initialization", () => {
    it("should initialize with default parameters", () => {
      const cache = new InMemoryCache();
      expect(cache.getStats()).toEqual({
        hits: 0,
        misses: 0,
        size: 0,
        entries: {},
      });
      expect(cache.getHitRate()).toBe(0);
    });

    it("should accept custom defaultTTL and maxSize parameters", () => {
      const cache = new InMemoryCache(1000, 2);
      cache.set("a", 1);
      cache.set("b", 2);
      cache.set("c", 3); // should evict "a" due to maxSize = 2

      expect(cache.has("a")).toBe(false);
      expect(cache.has("b")).toBe(true);
      expect(cache.has("c")).toBe(true);
    });
  });

  describe("get & set", () => {
    it("should return null on cache miss and update stats", () => {
      const cache = new InMemoryCache<string, string>();
      expect(cache.get("missing")).toBeNull();

      const stats = cache.getStats();
      expect(stats.misses).toBe(1);
      expect(stats.hits).toBe(0);
      expect(cache.getHitRate()).toBe(0);
    });

    it("should return cached value on cache hit and update stats", () => {
      const cache = new InMemoryCache<string, string>();
      cache.set("key1", "val1");

      const val = cache.get("key1");
      expect(val).toBe("val1");

      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(0);
      expect(cache.getHitRate()).toBe(1);
    });

    it("should update existing key value when set again", () => {
      const cache = new InMemoryCache<string, string>();
      cache.set("key1", "val1");
      cache.set("key1", "val2");

      expect(cache.get("key1")).toBe("val2");
      expect(cache.getStats().size).toBe(1);
    });

    it("should respect default TTL and expire entries", () => {
      const cache = new InMemoryCache<string, string>(1000);
      cache.set("key1", "val1");

      vi.advanceTimersByTime(500);
      expect(cache.get("key1")).toBe("val1");

      vi.advanceTimersByTime(501); // past 1000ms total
      expect(cache.get("key1")).toBeNull();
      expect(cache.has("key1")).toBe(false);
      expect(cache.getStats().misses).toBe(1);
    });

    it("should respect per-entry TTL overrides", () => {
      const cache = new InMemoryCache<string, string>(10000); // 10s default
      cache.set("short", "v1", 500); // 0.5s custom TTL
      cache.set("long", "v2"); // 10s default TTL

      vi.advanceTimersByTime(600);
      expect(cache.get("short")).toBeNull();
      expect(cache.get("long")).toBe("v2");
    });
  });

  describe("delete", () => {
    it("should delete existing key and return true", () => {
      const cache = new InMemoryCache<string, string>();
      cache.set("key1", "val1");

      expect(cache.delete("key1")).toBe(true);
      expect(cache.has("key1")).toBe(false);
      expect(cache.get("key1")).toBeNull();
    });

    it("should return false when deleting non-existent key", () => {
      const cache = new InMemoryCache<string, string>();
      expect(cache.delete("nonexistent")).toBe(false);
    });
  });

  describe("has & keys", () => {
    it("should accurately report key existence with has()", () => {
      const cache = new InMemoryCache<string, string>();
      expect(cache.has("key1")).toBe(false);

      cache.set("key1", "val1");
      expect(cache.has("key1")).toBe(true);
    });

    it("should return all keys with keys()", () => {
      const cache = new InMemoryCache<string, number>();
      cache.set("a", 1);
      cache.set("b", 2);
      cache.set("c", 3);

      expect(cache.keys()).toEqual(["a", "b", "c"]);
    });
  });

  describe("Eviction Policy (maxSize)", () => {
    it("should evict oldest inserted key when capacity is reached", () => {
      const cache = new InMemoryCache<string, number>(10000, 3);
      cache.set("k1", 1);
      cache.set("k2", 2);
      cache.set("k3", 3);

      expect(cache.keys()).toEqual(["k1", "k2", "k3"]);

      cache.set("k4", 4); // triggers eviction of "k1"
      expect(cache.has("k1")).toBe(false);
      expect(cache.keys()).toEqual(["k2", "k3", "k4"]);
      expect(cache.getStats().size).toBe(3);
    });
  });

  describe("cleanup", () => {
    it("should remove all expired entries and return the count", () => {
      const cache = new InMemoryCache<string, string>(1000);
      cache.set("k1", "v1", 500);
      cache.set("k2", "v2", 1500);
      cache.set("k3", "v3", 500);

      vi.advanceTimersByTime(1000);

      const removed = cache.cleanup();
      expect(removed).toBe(2);
      expect(cache.has("k1")).toBe(false);
      expect(cache.has("k3")).toBe(false);
      expect(cache.get("k2")).toBe("v2");
    });
  });

  describe("clear", () => {
    it("should reset cache store and statistics", () => {
      const cache = new InMemoryCache<string, string>();
      cache.set("k1", "v1");
      cache.get("k1");
      cache.get("missing");

      expect(cache.getStats().hits).toBe(1);
      expect(cache.getStats().misses).toBe(1);

      cache.clear();

      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.size).toBe(0);
      expect(cache.has("k1")).toBe(false);
    });
  });

  describe("getStats & getHitRate", () => {
    it("should calculate hit rate correctly", () => {
      const cache = new InMemoryCache<string, string>();
      expect(cache.getHitRate()).toBe(0);

      cache.set("k1", "v1");
      cache.get("k1"); // 1 hit
      expect(cache.getHitRate()).toBe(1); // 1/1 = 1.0

      cache.get("missing"); // 1 miss
      expect(cache.getHitRate()).toBe(0.5); // 1/2 = 0.5
    });

    it("should report remaining TTL in entries record of getStats()", () => {
      const cache = new InMemoryCache<string, string>(1000);
      cache.set("k1", "v1", 1000);

      vi.advanceTimersByTime(300);

      const stats = cache.getStats();
      expect(stats.entries["k1"]).toBe(700);
    });

    it("should cap remaining TTL in getStats() at 0 for expired entries that were not yet fetched", () => {
      const cache = new InMemoryCache<string, string>(1000);
      cache.set("k1", "v1", 500);

      vi.advanceTimersByTime(600);

      const stats = cache.getStats();
      expect(stats.entries["k1"]).toBe(0);
    });
  });

  describe("createAlgorandCache", () => {
    it("should create preconfigured cache for Algorand queries", () => {
      const algorandCache = createAlgorandCache();
      expect(algorandCache).toBeInstanceOf(InMemoryCache);

      algorandCache.set("tx1", { amount: 100 });
      expect(algorandCache.get("tx1")).toEqual({ amount: 100 });
    });
  });
});
