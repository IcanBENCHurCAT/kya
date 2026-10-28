/**
 * Wallet Graph — a directed graph data structure linking related Algorand addresses
 * Supports queries like "what wallets are related to address X?" and
 * "what is the connection between wallet A and wallet B?"
 */
import type { WalletGraphEdge, WalletGraphNode, SiblingWallet, CounterpartyStats } from '../types/index.js';
export declare class WalletGraph {
    private nodes;
    private edges;
    private incomingEdges;
    private adjacencyList;
    private relatedEdgesCache;
    private outgoingEdgesCache;
    private incomingEdgesCache;
    private connectedComponentsCache;
    private degreeCentralityCache;
    constructor();
    /**
     * Add or update a node in the graph
     */
    addNode(address: string, transactionCount: number, totalValueIn: number, totalValueOut: number, firstSeenRound: number, lastSeenRound: number): void;
    /**
     * Add or update an edge between two nodes
     */
    addEdge(source: string, target: string, weight: number, relationshipType: WalletGraphEdge['relationshipType'], totalValueTransferred: number, firstInteractionRound: number, lastInteractionRound: number, metadata?: Record<string, unknown>): void;
    /**
     * Query: what wallets are related to address X?
     *
     * Performance optimization:
     * Uses a dedicated `relatedEdgesCache` Map to cache aggregated and sorted related edges
     * (both outgoing and incoming). Subsequent queries return the cached edge array in O(1) time
     * without re-aggregating edge maps or re-executing O(E log E) array sorts.
     */
    getRelatedWallets(address: string): WalletGraphEdge[];
    /**
     * Get all edges from a specific address
     */
    getOutgoingEdges(address: string): WalletGraphEdge[];
    /**
     * Get all edges to a specific address
     * Performance: O(1) map lookup + O(E_in log E_in) sort (cached),
     * replacing the previous O(V) scan across all nodes in the graph.
     */
    getIncomingEdges(address: string): WalletGraphEdge[];
    /**
     * Get a specific edge between two addresses
     */
    getEdge(source: string, target: string): WalletGraphEdge | null;
    /**
     * Get a node by address
     */
    getNode(address: string): WalletGraphNode | null;
    /**
     * Get all nodes, optionally bounded to top K items.
     *
     * Performance optimization:
     * When `limit` is provided and smaller than total nodes, extracts top K items directly
     * using a bounded insertion-sorted array. Reduces time complexity from O(V log V) to O(V)
     * and minimizes memory allocations.
     */
    getAllNodes(limit?: number): WalletGraphNode[];
    /**
     * Get all edges, optionally bounded to top K items.
     *
     * Performance optimization:
     * When `limit` is provided, streams edges directly from inner maps into a bounded
     * insertion-sorted array of size `limit`. Eliminates constructing a temporary flat array
     * of all graph edges (saving O(E) allocations) and reduces sort complexity from O(E log E) to O(E).
     */
    getAllEdges(limit?: number): WalletGraphEdge[];
    /**
     * Find paths between two addresses (BFS, limited depth)
     * Returns the shortest path and all paths up to maxDepth
     */
    findPath(from: string, to: string, maxDepth?: number): {
        shortest: WalletGraphEdge[] | null;
        allPaths: WalletGraphEdge[][];
    };
    /**
     * Get connected components (unconnected groups of wallets)
     *
     * Performance optimization:
     * 1. Caches calculated connected components in `connectedComponentsCache`, invalidating on graph mutation
     *    (`addNode` for new nodes, `addEdge`, `clear`). Subsequent `getConnectedComponents()` and `getStats()` queries run in O(1) time.
     * 2. Uses an index pointer (`head`) instead of `queue.shift()` to eliminate $O(K)$ array re-indexing per pop,
     *    and marks nodes visited immediately upon enqueueing to prevent duplicate node insertions into the BFS queue.
     * Reduces BFS time complexity from $O(V^2 + E \cdot V)$ down to $O(V + E)$ with zero duplicate allocations.
     */
    getConnectedComponents(): string[][];
    /**
     * Calculate degree centrality for all nodes
     *
     * Performance optimization:
     * Caches calculated degree centrality in `degreeCentralityCache` and invalidates on graph mutations
     * (`addNode` when adding a new node, `addEdge`, `clear`). Subsequent `getDegreeCentrality()` calls run in O(1) time
     * without re-iterating all graph nodes or recalculating Map size properties.
     */
    getDegreeCentrality(): Map<string, number>;
    /**
     * Build the graph from sibling discovery results
     */
    buildFromSiblings(address: string, siblings: SiblingWallet[], counterpartyStats?: CounterpartyStats[]): void;
    /**
     * Get graph statistics
     *
     * Performance optimization:
     * Direct O(V_sources) Map size summation for edge counting avoids constructing a flat array of all
     * edges and performing an O(E log E) sort in getAllEdges(). Eliminates redundant second iteration
     * over adjacencyList by reusing edgeCount for average degree calculation.
     */
    getStats(): {
        nodeCount: number;
        edgeCount: number;
        components: number;
        avgDegree: number;
    };
    /**
     * Clear the graph
     */
    clear(): void;
    private updateSiblingCount;
}
