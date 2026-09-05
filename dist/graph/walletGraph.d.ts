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
    private cache;
    private outgoingEdgesCache;
    private incomingEdgesCache;
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
     * Performance: O(E_out + E_in) map lookups using direct edge maps instead of O(V) full graph scan.
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
     * Get all nodes
     */
    getAllNodes(): WalletGraphNode[];
    /**
     * Get all edges
     */
    getAllEdges(): WalletGraphEdge[];
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
     */
    getConnectedComponents(): string[][];
    /**
     * Calculate degree centrality for all nodes
     * Performance: O(1) lookup per node using adjacency and incoming edge maps, avoiding full graph traversal.
     */
    getDegreeCentrality(): Map<string, number>;
    /**
     * Build the graph from sibling discovery results
     */
    buildFromSiblings(address: string, siblings: SiblingWallet[], counterpartyStats?: CounterpartyStats[]): void;
    /**
     * Get graph statistics
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
