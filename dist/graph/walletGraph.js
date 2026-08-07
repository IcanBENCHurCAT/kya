/**
 * Wallet Graph — a directed graph data structure linking related Algorand addresses
 * Supports queries like "what wallets are related to address X?" and
 * "what is the connection between wallet A and wallet B?"
 */
import { InMemoryCache } from '../cache/inMemoryCache.js';
export class WalletGraph {
    nodes;
    edges;
    adjacencyList;
    cache;
    constructor() {
        this.nodes = new Map();
        this.edges = new Map();
        this.adjacencyList = new Map();
        this.cache = new InMemoryCache(600_000, 10_000);
    }
    /**
     * Add or update a node in the graph
     */
    addNode(address, transactionCount, totalValueIn, totalValueOut, firstSeenRound, lastSeenRound) {
        const existing = this.nodes.get(address);
        if (existing) {
            // Update existing node
            existing.transactionCount = Math.max(existing.transactionCount, transactionCount);
            existing.totalValueIn = Math.max(existing.totalValueIn, totalValueIn);
            existing.totalValueOut = Math.max(existing.totalValueOut, totalValueOut);
            existing.firstSeenRound = Math.min(existing.firstSeenRound, firstSeenRound);
            existing.lastSeenRound = Math.max(existing.lastSeenRound, lastSeenRound);
        }
        else {
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
    addEdge(source, target, weight, relationshipType, totalValueTransferred, firstInteractionRound, lastInteractionRound, metadata) {
        // Ensure both nodes exist
        if (!this.nodes.has(source)) {
            this.addNode(source, 0, 0, 0, firstInteractionRound, lastInteractionRound);
        }
        if (!this.nodes.has(target)) {
            this.addNode(target, 0, 0, 0, firstInteractionRound, lastInteractionRound);
        }
        // Get or create the target's edge map
        if (!this.edges.has(source)) {
            this.edges.set(source, new Map());
        }
        const sourceEdges = this.edges.get(source);
        const existing = sourceEdges.get(target);
        if (existing) {
            // Update existing edge (increment weight if it's the same relationship)
            if (existing.relationshipType === relationshipType) {
                existing.weight = Math.max(existing.weight, weight);
                existing.totalValueTransferred = Math.max(existing.totalValueTransferred, totalValueTransferred);
                existing.lastInteractionRound = Math.max(existing.lastInteractionRound, lastInteractionRound);
                if (metadata) {
                    existing.metadata = { ...existing.metadata, ...metadata };
                }
            }
            else {
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
        }
        else {
            sourceEdges.set(target, {
                source,
                target,
                weight,
                relationshipType,
                firstInteractionRound,
                lastInteractionRound,
                totalValueTransferred,
                metadata,
            });
            // Update adjacency list
            this.adjacencyList.get(source).add(target);
        }
        this.updateSiblingCount(source);
    }
    /**
     * Query: what wallets are related to address X?
     */
    getRelatedWallets(address) {
        // Check cache first
        const cached = this.cache.get(address);
        if (cached) {
            // Return edges to cached addresses
            return cached
                .map((targetAddr) => this.getEdge(address, targetAddr))
                .filter((e) => e !== null);
        }
        const edges = [];
        // Outgoing edges (address sent to these wallets)
        const outgoing = this.edges.get(address);
        if (outgoing) {
            for (const [, edge] of outgoing) {
                edges.push(edge);
            }
        }
        // Incoming edges (these wallets sent to address)
        for (const [, targetEdges] of this.edges) {
            const incoming = targetEdges.get(address);
            if (incoming) {
                edges.push(incoming);
            }
        }
        // Sort by weight (descending)
        edges.sort((a, b) => b.weight - a.weight);
        return edges;
    }
    /**
     * Get all edges from a specific address
     */
    getOutgoingEdges(address) {
        const sourceEdges = this.edges.get(address);
        if (!sourceEdges)
            return [];
        return Array.from(sourceEdges.values()).sort((a, b) => b.weight - a.weight);
    }
    /**
     * Get all edges to a specific address
     */
    getIncomingEdges(address) {
        const edges = [];
        for (const [, targetEdges] of this.edges) {
            const incoming = targetEdges.get(address);
            if (incoming) {
                edges.push(incoming);
            }
        }
        edges.sort((a, b) => b.weight - a.weight);
        return edges;
    }
    /**
     * Get a specific edge between two addresses
     */
    getEdge(source, target) {
        const sourceEdges = this.edges.get(source);
        if (!sourceEdges)
            return null;
        return sourceEdges.get(target) || null;
    }
    /**
     * Get a node by address
     */
    getNode(address) {
        return this.nodes.get(address) || null;
    }
    /**
     * Get all nodes
     */
    getAllNodes() {
        return Array.from(this.nodes.values()).sort((a, b) => b.transactionCount - a.transactionCount);
    }
    /**
     * Get all edges
     */
    getAllEdges() {
        const allEdges = [];
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
    findPath(from, to, maxDepth = 3) {
        const allPaths = [];
        const bfs = (current, target, path, visited, depth) => {
            if (depth > maxDepth)
                return;
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
        const visited = new Set();
        visited.add(from);
        bfs(from, to, [], visited, 0);
        // Find shortest path
        let shortest = null;
        if (allPaths.length > 0) {
            allPaths.sort((a, b) => a.length - b.length);
            shortest = allPaths[0];
        }
        return { shortest, allPaths };
    }
    /**
     * Get connected components (unconnected groups of wallets)
     */
    getConnectedComponents() {
        const visited = new Set();
        const components = [];
        for (const address of this.nodes.keys()) {
            if (visited.has(address))
                continue;
            // BFS to find all connected nodes
            const component = [];
            const queue = [address];
            while (queue.length > 0) {
                const current = queue.shift();
                if (visited.has(current))
                    continue;
                visited.add(current);
                component.push(current);
                // Add neighbors
                const outgoing = this.adjacencyList.get(current);
                if (outgoing) {
                    for (const neighbor of outgoing) {
                        if (!visited.has(neighbor)) {
                            queue.push(neighbor);
                        }
                    }
                }
                // Also check incoming edges
                for (const [, targetEdges] of this.edges) {
                    if (targetEdges.has(current) && !visited.has(current)) {
                        // This is backwards — we need to find nodes that have edges TO current
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
     */
    getDegreeCentrality() {
        const centrality = new Map();
        const n = this.nodes.size;
        if (n <= 1)
            return centrality;
        for (const [address] of this.nodes) {
            const outgoing = this.adjacencyList.get(address);
            const outgoingCount = outgoing ? outgoing.size : 0;
            let incomingCount = 0;
            for (const [, targetEdges] of this.edges) {
                if (targetEdges.has(address)) {
                    incomingCount++;
                }
            }
            centrality.set(address, (outgoingCount + incomingCount) / (n - 1));
        }
        return centrality;
    }
    /**
     * Build the graph from sibling discovery results
     */
    buildFromSiblings(address, siblings, counterpartyStats) {
        // Add the main node
        this.addNode(address, counterpartyStats?.reduce((sum, cs) => sum + cs.interactionCount, 0) ?? 0, 0, 0, 0, 0);
        // Add edges for each sibling
        for (const sibling of siblings) {
            this.addEdge(address, sibling.address, sibling.interactionCount, sibling.relationshipType, sibling.totalValueTransferred, sibling.firstSeenRound, sibling.lastSeenRound);
        }
    }
    /**
     * Get graph statistics
     */
    getStats() {
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
    clear() {
        this.nodes.clear();
        this.edges.clear();
        this.adjacencyList.clear();
        this.cache.clear();
    }
    updateSiblingCount(address) {
        const node = this.nodes.get(address);
        if (node) {
            node.siblingCount = (this.adjacencyList.get(address)?.size ?? 0) +
                this.getIncomingEdges(address).length;
        }
    }
}
