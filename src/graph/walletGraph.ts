/**
 * Wallet Graph — a directed graph data structure linking related Algorand addresses
 * Supports queries like "what wallets are related to address X?" and
 * "what is the connection between wallet A and wallet B?"
 */

import type {
  WalletGraphEdge,
  WalletGraphNode,
  SiblingWallet,
  CounterpartyStats,
} from '../types/index.js';
import { InMemoryCache } from '../cache/inMemoryCache.js';

export class WalletGraph {
  private nodes: Map<string, WalletGraphNode>;
  private edges: Map<string, Map<string, WalletGraphEdge>>;
  // Reverse index for incoming edges: target -> (source -> edge)
  // Optimization: Allows O(1) lookup of incoming edges without full O(V) graph scans.
  private incomingEdges: Map<string, Map<string, WalletGraphEdge>>;
  private adjacencyList: Map<string, Set<string>>;
  private cache: InMemoryCache<string, string[]>;
  private outgoingEdgesCache: Map<string, WalletGraphEdge[]>;
  private incomingEdgesCache: Map<string, WalletGraphEdge[]>;

  constructor() {
    this.nodes = new Map();
    this.edges = new Map();
    this.incomingEdges = new Map();
    this.adjacencyList = new Map();
    this.cache = new InMemoryCache(600_000, 10_000);
    this.outgoingEdgesCache = new Map();
    this.incomingEdgesCache = new Map();
  }

  /**
   * Add or update a node in the graph
   */
  addNode(
    address: string,
    transactionCount: number,
    totalValueIn: number,
    totalValueOut: number,
    firstSeenRound: number,
    lastSeenRound: number
  ): void {
    const existing = this.nodes.get(address);
    if (existing) {
      // Update existing node
      existing.transactionCount = Math.max(
        existing.transactionCount,
        transactionCount
      );
      existing.totalValueIn = Math.max(existing.totalValueIn, totalValueIn);
      existing.totalValueOut = Math.max(
        existing.totalValueOut,
        totalValueOut
      );
      existing.firstSeenRound = Math.min(
        existing.firstSeenRound,
        firstSeenRound
      );
      existing.lastSeenRound = Math.max(
        existing.lastSeenRound,
        lastSeenRound
      );
    } else {
      this.nodes.set(address, {
        address,
        transactionCount,
        siblingCount: 0,
        totalValueIn,
        totalValueOut,
        firstSeenRound,
        lastSeenRound,
      });
    }

    // Ensure adjacency list entry exists
    if (!this.adjacencyList.has(address)) {
      this.adjacencyList.set(address, new Set());
    }

    // Update sibling count
    this.updateSiblingCount(address);
  }

  /**
   * Add or update an edge between two nodes
   */
  addEdge(
    source: string,
    target: string,
    weight: number,
    relationshipType: WalletGraphEdge['relationshipType'],
    totalValueTransferred: number,
    firstInteractionRound: number,
    lastInteractionRound: number,
    metadata?: Record<string, unknown>
  ): void {
    // Ensure both nodes exist
    if (!this.nodes.has(source)) {
      this.addNode(source, 0, 0, 0, firstInteractionRound, lastInteractionRound);
    }
    if (!this.nodes.has(target)) {
      this.addNode(target, 0, 0, 0, firstInteractionRound, lastInteractionRound);
    }

    // Get or create source outgoing edge map
    if (!this.edges.has(source)) {
      this.edges.set(source, new Map());
    }

    // Get or create target incoming edge map
    if (!this.incomingEdges.has(target)) {
      this.incomingEdges.set(target, new Map());
    }

    const sourceEdges = this.edges.get(source)!;
    const targetIncoming = this.incomingEdges.get(target)!;
    const existing = sourceEdges.get(target);

    if (existing) {
      // Update existing edge (increment weight if it's the same relationship)
      if (existing.relationshipType === relationshipType) {
        existing.weight = Math.max(existing.weight, weight);
        existing.totalValueTransferred = Math.max(
          existing.totalValueTransferred,
          totalValueTransferred
        );
        existing.lastInteractionRound = Math.max(
          existing.lastInteractionRound,
          lastInteractionRound
        );
        if (metadata) {
          existing.metadata = { ...existing.metadata, ...metadata };
        }
      } else {
        // Different relationship type — create a new edge or upgrade
        if (weight > existing.weight) {
          existing.weight = weight;
          existing.relationshipType = relationshipType;
          existing.totalValueTransferred = totalValueTransferred;
          existing.lastInteractionRound = lastInteractionRound;
          if (metadata) {
            existing.metadata = { ...metadata };
          }
        }
      }
    } else {
      const newEdge: WalletGraphEdge = {
        source,
        target,
        weight,
        relationshipType,
        firstInteractionRound,
        lastInteractionRound,
        totalValueTransferred,
        metadata,
      };

      sourceEdges.set(target, newEdge);
      targetIncoming.set(source, newEdge);

      // Update adjacency list
      this.adjacencyList.get(source)!.add(target);
    }

    this.outgoingEdgesCache.delete(source);
    this.incomingEdgesCache.delete(target);
    this.updateSiblingCount(source);
    this.updateSiblingCount(target);
  }

  /**
   * Query: what wallets are related to address X?
   * Performance: O(E_out + E_in) map lookups using direct edge maps instead of O(V) full graph scan.
   */
  getRelatedWallets(address: string): WalletGraphEdge[] {
    // Check cache first
    const cached = this.cache.get(address);
    if (cached) {
      // Return edges to cached addresses
      return cached
        .map((targetAddr) => this.getEdge(address, targetAddr))
        .filter((e): e is WalletGraphEdge => e !== null);
    }

    const edges: WalletGraphEdge[] = [];

    // Outgoing edges (address sent to these wallets)
    const outgoing = this.edges.get(address);
    if (outgoing) {
      for (const [, edge] of outgoing) {
        edges.push(edge);
      }
    }

    // Incoming edges (these wallets sent to address)
    const incoming = this.incomingEdges.get(address);
    if (incoming) {
      for (const [, edge] of incoming) {
        edges.push(edge);
      }
    }

    // Sort by weight (descending)
    edges.sort((a, b) => b.weight - a.weight);

    return edges;
  }

  /**
   * Get all edges from a specific address
   */
  getOutgoingEdges(address: string): WalletGraphEdge[] {
    const cached = this.outgoingEdgesCache.get(address);
    if (cached) return cached;

    const sourceEdges = this.edges.get(address);
    if (!sourceEdges) return [];

    const sorted = Array.from(sourceEdges.values()).sort(
      (a, b) => b.weight - a.weight
    );
    this.outgoingEdgesCache.set(address, sorted);
    return sorted;
  }

  /**
   * Get all edges to a specific address
   * Performance: O(1) map lookup + O(E_in log E_in) sort (cached),
   * replacing the previous O(V) scan across all nodes in the graph.
   */
  getIncomingEdges(address: string): WalletGraphEdge[] {
    const cached = this.incomingEdgesCache.get(address);
    if (cached) return cached;

    const targetIncoming = this.incomingEdges.get(address);
    if (!targetIncoming) return [];

    const sorted = Array.from(targetIncoming.values()).sort(
      (a, b) => b.weight - a.weight
    );
    this.incomingEdgesCache.set(address, sorted);
    return sorted;
  }

  /**
   * Get a specific edge between two addresses
   */
  getEdge(source: string, target: string): WalletGraphEdge | null {
    const sourceEdges = this.edges.get(source);
    if (!sourceEdges) return null;

    return sourceEdges.get(target) || null;
  }

  /**
   * Get a node by address
   */
  getNode(address: string): WalletGraphNode | null {
    return this.nodes.get(address) || null;
  }

  /**
   * Get all nodes
   */
  getAllNodes(): WalletGraphNode[] {
    return Array.from(this.nodes.values()).sort(
      (a, b) => b.transactionCount - a.transactionCount
    );
  }

  /**
   * Get all edges
   */
  getAllEdges(): WalletGraphEdge[] {
    const allEdges: WalletGraphEdge[] = [];

    for (const [, sourceEdges] of this.edges) {
      for (const [, edge] of sourceEdges) {
        allEdges.push(edge);
      }
    }

    return allEdges.sort((a, b) => b.weight - a.weight);
  }

  /**
   * Find paths between two addresses (BFS, limited depth)
   * Returns the shortest path and all paths up to maxDepth
   */
  findPath(
    from: string,
    to: string,
    maxDepth: number = 3
  ): {
    shortest: WalletGraphEdge[] | null;
    allPaths: WalletGraphEdge[][];
  } {
    const allPaths: WalletGraphEdge[][] = [];

    const bfs = (
      current: string,
      target: string,
      path: WalletGraphEdge[],
      visited: Set<string>,
      depth: number
    ) => {
      if (depth > maxDepth) return;

      if (current === target) {
        allPaths.push([...path]);
        return;
      }

      const neighbors = this.getOutgoingEdges(current);
      for (const edge of neighbors) {
        if (!visited.has(edge.target)) {
          visited.add(edge.target);
          path.push(edge);
          bfs(edge.target, target, path, visited, depth + 1);
          path.pop();
          visited.delete(edge.target);
        }
      }
    };

    const visited = new Set<string>();
    visited.add(from);
    bfs(from, to, [], visited, 0);

    // Find shortest path
    let shortest: WalletGraphEdge[] | null = null;
    if (allPaths.length > 0) {
      allPaths.sort((a, b) => a.length - b.length);
      shortest = allPaths[0];
    }

    return { shortest, allPaths };
  }

  /**
   * Get connected components (unconnected groups of wallets)
   */
  getConnectedComponents(): string[][] {
    const visited = new Set<string>();
    const components: string[][] = [];

    for (const address of this.nodes.keys()) {
      if (visited.has(address)) continue;

      // BFS to find all connected nodes
      const component: string[] = [];
      const queue: string[] = [address];

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current)) continue;

        visited.add(current);
        component.push(current);

        // Add outgoing neighbors
        const outgoing = this.adjacencyList.get(current);
        if (outgoing) {
          for (const neighbor of outgoing) {
            if (!visited.has(neighbor)) {
              queue.push(neighbor);
            }
          }
        }

        // Add incoming neighbors via reverse index
        const incoming = this.incomingEdges.get(current);
        if (incoming) {
          for (const sender of incoming.keys()) {
            if (!visited.has(sender)) {
              queue.push(sender);
            }
          }
        }
      }

      if (component.length > 0) {
        components.push(component);
      }
    }

    return components;
  }

  /**
   * Calculate degree centrality for all nodes
   * Performance: O(1) lookup per node using adjacency and incoming edge maps, avoiding full graph traversal.
   */
  getDegreeCentrality(): Map<string, number> {
    const centrality = new Map<string, number>();
    const n = this.nodes.size;

    if (n <= 1) return centrality;

    for (const [address] of this.nodes) {
      const outgoing = this.adjacencyList.get(address);
      const outgoingCount = outgoing ? outgoing.size : 0;

      const incoming = this.incomingEdges.get(address);
      const incomingCount = incoming ? incoming.size : 0;

      centrality.set(address, (outgoingCount + incomingCount) / (n - 1));
    }

    return centrality;
  }

  /**
   * Build the graph from sibling discovery results
   */
  buildFromSiblings(
    address: string,
    siblings: SiblingWallet[],
    counterpartyStats?: CounterpartyStats[]
  ): void {
    // Add the main node
    this.addNode(
      address,
      counterpartyStats?.reduce((sum, cs) => sum + cs.interactionCount, 0) ?? 0,
      0,
      0,
      0,
      0
    );

    // Add edges for each sibling
    for (const sibling of siblings) {
      this.addEdge(
        address,
        sibling.address,
        sibling.interactionCount,
        sibling.relationshipType,
        sibling.totalValueTransferred,
        sibling.firstSeenRound,
        sibling.lastSeenRound
      );
    }
  }

  /**
   * Get graph statistics
   */
  getStats(): {
    nodeCount: number;
    edgeCount: number;
    components: number;
    avgDegree: number;
  } {
    const edgeCount = this.getAllEdges().length;
    const nodeCount = this.nodes.size;
    const components = this.getConnectedComponents().length;

    let totalDegree = 0;
    for (const [, outgoing] of this.adjacencyList) {
      totalDegree += outgoing.size;
    }

    return {
      nodeCount,
      edgeCount,
      components,
      avgDegree: nodeCount > 0 ? totalDegree / nodeCount : 0,
    };
  }

  /**
   * Clear the graph
   */
  clear(): void {
    this.nodes.clear();
    this.edges.clear();
    this.incomingEdges.clear();
    this.adjacencyList.clear();
    this.cache.clear();
    this.outgoingEdgesCache.clear();
    this.incomingEdgesCache.clear();
  }

  private updateSiblingCount(address: string): void {
    const node = this.nodes.get(address);
    if (node) {
      // Performance optimization: Direct O(1) Map.size lookup for incoming edge count
      // avoids O(E_in log E_in) array allocations, sorting, and cache pollution in getIncomingEdges().
      node.siblingCount = (this.adjacencyList.get(address)?.size ?? 0) + 
        (this.incomingEdges.get(address)?.size ?? 0);
    }
  }
}
