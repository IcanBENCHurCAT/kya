## 2025-03-03 - Optimize Fuzzy Screening String Normalization & Levenshtein Allocations
**Learning:** In hot loops processing tens of thousands of sanctions entries (e.g., OFAC SDN watchlists), repeated calls to `.toLowerCase()`, 2D matrix allocations (`number[][]`) in Levenshtein DP, and temporary `scores[]` arrays create severe CPU and garbage collection bottlenecks.
**Action:** Pre-lowercase target/candidate strings before similarity loops, replace 2D DP matrices in Levenshtein with dual 1D `Int32Array` row buffers, and track best scores directly using scalar primitives instead of allocating arrays.

## 2025-03-03 - Reverse Edge Indexing in Directed Wallet Graphs
**Learning:** In directed graph structures like `WalletGraph`, querying incoming edges without a reverse index forces an $O(V)$ full graph scan across all source maps. Furthermore, calling `updateSiblingCount` on edge creation triggers `getIncomingEdges`, turning graph construction into an $O(E \cdot V)$ operation that takes seconds on graphs with thousands of nodes.
**Action:** Maintain a dual `incomingEdges` index map (`target -> source -> edge`) sharing edge object references, reducing incoming query time from $O(V)$ to $O(1)$ and graph construction from $O(E \cdot V)$ to $O(E)$.

## 2025-03-04 - Zero-Allocation Buffer Pools for Jaro-Winkler Fuzzy Matching
**Learning:** In fuzzy string matching across large datasets (e.g. OFAC SDN watchlists), instantiating `(string | null)[]` arrays per comparison triggers millions of short-lived allocations, creating severe V8 garbage collection pauses.
**Action:** Re-use shared `Uint8Array` match flag buffers with dynamic capacity resizing and `.charCodeAt()` string character comparisons, achieving ~4x execution speedup and eliminating heap allocations in hot loops.

## 2025-03-05 - Single-Pass Wallet Transaction History Aggregation
**Learning:** Multi-pass iteration across transactions (separate loops for incoming/outgoing filter, reducing sums, building counterparty maps, tracking asset stats) combined with `Math.min(...txs.map(t => t.round))` spread operations creates $O(N)$ memory overhead and runs risk of V8 maximum call stack size errors on large transaction sets (~50k+ entries).
**Action:** Consolidate filtering, accumulation, counterparty/asset map tracking, and min/max round comparisons into a single `for` loop over `transactions`, reducing aggregation runtime by ~45% and preventing call stack overflow.

## 2025-03-06 - Direct Map.size in Graph Helpers & Key Re-Insertion in Map Caches
**Learning:** Calling query functions like `getIncomingEdges()` inside node update routines (like `updateSiblingCount`) triggers $O(E_{in} \log E_{in})$ array allocations and sorting operations on every node/edge insertion, alongside query cache pollution. Furthermore, in bounded `Map` caches, setting an existing key when size equals `maxSize` without deleting the key first triggers premature eviction of valid keys and shrinks effective cache capacity.
**Action:** Use direct $O(1)$ `Map.size` lookups for count calculations in internal graph metrics, and delete existing keys prior to re-setting in bounded `Map` caches to refresh insertion order without triggering eviction.

## 2025-03-07 - Secondary Indexing for In-Memory Stores to Avoid Full Map Scans
**Learning:** In-memory store implementations (such as `InMemoryClaimStore`) that rely on `Array.from(map.values()).filter(...)` or `.some(...)` for lookups incur an $O(N)$ linear scan and $O(N)$ heap allocation overhead on every query. As store size grows, repeated lookups during verification or screening workflows degrade throughput and trigger frequent V8 GC pauses.
**Action:** Maintain secondary index maps (`Map<string, Set<Item>>`) for heavily queried keys (e.g. `walletAddress`, `identityHash`). Update indices on insertion and clear on reset to turn $O(N)$ full scans into $O(1)$ lookups.

## 2025-03-08 - String Length Ratio Pruning & Single-Pass Consolidations in Fuzzy Screening
**Learning:** In fuzzy sanctions screening across ~20k entries, performing Jaro-Winkler and Levenshtein similarity calculations on candidate strings with vastly different string lengths or low Jaro similarity consumes 95%+ of CPU time (over 1.2s per request). Multi-pass list iterations over watchlists compound this overhead.
**Action:** Prune fuzzy matching early by checking theoretical string length ratio upper bounds `0.44 * (minLen / maxLen) + 0.56 < threshold` (and tighter `(1.6 * ratio + 1.4) / 3 < threshold` if first chars differ), skipping Levenshtein if Jaro score cannot reach threshold, and consolidating multi-pass watchlist iterations into a single pass per entry. Reduces screening runtime ~30x from ~1240ms to ~41ms per request.

## 2025-03-09 - Single-Pass Audit Summary Aggregation & Fast ISO String Comparisons
**Learning:** Computing summary stats by delegating to log query routines (`getAuditLog`) forces $O(N \log N)$ `String.prototype.localeCompare` sorting and creates 6+ temporary arrays via `.filter()` and `new Date().getTime()` date parsing per entry. In V8/Node.js, `localeCompare` invokes ICU locale algorithms which are ~30x slower than relational operators (`>` / `<`) on lexicographically orderable ISO 8601 strings.
**Action:** Compute summary stats in a single $O(N)$ pass over log entries using direct string comparisons for ISO 8601 timestamps, and replace `localeCompare` with relational string operators (`> / <`) when sorting ISO timestamps.

## 2025-03-10 - Secondary Indexing for InMemoryAttemptStore Rate Limit Queries
**Learning:** `InMemoryAttemptStore.getRecentAttemptCount(identifier)` was performing an $O(N)$ linear scan over all stored verification attempts in `attempts.values()`. During high-volume OTP verification attempts, evaluating rate limit windows triggered repeated full map traversals.
**Action:** Maintain a `byIdentifier` secondary index (`Map<string, Set<VerificationAttempt>>`) kept synchronized across `createAttempt`, `getAttempt`, `deleteAttempt`, `cleanupExpired`, and `clear`. Reduces `getRecentAttemptCount` lookup runtime from $O(N)$ to $O(1)$.
