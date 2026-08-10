import { InMemoryCache } from './src/cache/inMemoryCache.js';

function runBenchmark() {
  const cache = new InMemoryCache<string, number>(300000, 10000);

  // Fill cache to capacity
  for (let i = 0; i < 10000; i++) {
    cache.set(`key-${i}`, i);
  }

  const start = performance.now();

  // These insertions will trigger eviction
  for (let i = 10000; i < 20000; i++) {
    cache.set(`key-${i}`, i);
  }

  const end = performance.now();

  console.log(`Time taken to insert 10,000 items with eviction: ${(end - start).toFixed(2)} ms`);
}

runBenchmark();
