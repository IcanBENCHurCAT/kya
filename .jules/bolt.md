## 2025-03-03 - Optimize Fuzzy Screening String Normalization & Levenshtein Allocations
**Learning:** In hot loops processing tens of thousands of sanctions entries (e.g., OFAC SDN watchlists), repeated calls to `.toLowerCase()`, 2D matrix allocations (`number[][]`) in Levenshtein DP, and temporary `scores[]` arrays create severe CPU and garbage collection bottlenecks.
**Action:** Pre-lowercase target/candidate strings before similarity loops, replace 2D DP matrices in Levenshtein with dual 1D `Int32Array` row buffers, and track best scores directly using scalar primitives instead of allocating arrays.

## 2025-03-03 - Reverse Edge Indexing in Directed Wallet Graphs
**Learning:** In directed graph structures like `WalletGraph`, querying incoming edges without a reverse index forces an $O(V)$ full graph scan across all source maps. Furthermore, calling `updateSiblingCount` on edge creation triggers `getIncomingEdges`, turning graph construction into an $O(E \cdot V)$ operation that takes seconds on graphs with thousands of nodes.
**Action:** Maintain a dual `incomingEdges` index map (`target -> source -> edge`) sharing edge object references, reducing incoming query time from $O(V)$ to $O(1)$ and graph construction from $O(E \cdot V)$ to $O(E)$.

## 2025-03-04 - Zero-Allocation Buffer Pools for Jaro-Winkler Fuzzy Matching
**Learning:** In fuzzy string matching across large datasets (e.g. OFAC SDN watchlists), instantiating `(string | null)[]` arrays per comparison triggers millions of short-lived allocations, creating severe V8 garbage collection pauses.
**Action:** Re-use shared `Uint8Array` match flag buffers with dynamic capacity resizing and `.charCodeAt()` string character comparisons, achieving ~4x execution speedup and eliminating heap allocations in hot loops.
