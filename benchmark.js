import { InMemoryCache } from './dist/cache/inMemoryCache.js';

function runBenchmark() {
  const cache = new InMemoryCache(300000, 100000); // 100k

  // Fill cache to capacity
  for (let i = 0; i < 100000; i++) {
    cache.set(`key-${i}`, i);
  }

  const start = performance.now();

  // These insertions will trigger eviction
  for (let i = 100000; i < 100100; i++) {
    cache.set(`key-${i}`, i);
  }

  const end = performance.now();

  console.log(`Time taken to insert 100 items with eviction (100k size): ${(end - start).toFixed(2)} ms`);
}

runBenchmark();
