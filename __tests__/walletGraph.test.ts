import { describe, it, expect, beforeEach } from 'vitest';
import { WalletGraph } from '../src/graph/walletGraph.js';
import type { SiblingWallet, CounterpartyStats } from '../src/types/index.js';

describe('WalletGraph', () => {
  let graph: WalletGraph;

  beforeEach(() => {
    graph = new WalletGraph();
  });

  describe('Node Operations', () => {
    it('should add a new node with correct initial properties', () => {
      graph.addNode('ADDR_1', 10, 500, 200, 1000, 2000);
      const node = graph.getNode('ADDR_1');

      expect(node).not.toBeNull();
      expect(node).toEqual({
        address: 'ADDR_1',
        transactionCount: 10,
        siblingCount: 0,
        totalValueIn: 500,
        totalValueOut: 200,
        firstSeenRound: 1000,
        lastSeenRound: 2000,
      });
    });

    it('should update an existing node with min/max aggregates', () => {
      graph.addNode('ADDR_1', 10, 500, 200, 1000, 2000);
      graph.addNode('ADDR_1', 15, 400, 300, 800, 2500);

      const node = graph.getNode('ADDR_1');
      expect(node).not.toBeNull();
      expect(node?.transactionCount).toBe(15); // Math.max(10, 15)
      expect(node?.totalValueIn).toBe(500); // Math.max(500, 400)
      expect(node?.totalValueOut).toBe(300); // Math.max(200, 300)
      expect(node?.firstSeenRound).toBe(800); // Math.min(1000, 800)
      expect(node?.lastSeenRound).toBe(2500); // Math.max(2000, 2500)
    });

    it('should return null for non-existent node', () => {
      expect(graph.getNode('NON_EXISTENT')).toBeNull();
    });

    it('should return all nodes sorted by transactionCount descending', () => {
      graph.addNode('ADDR_1', 5, 100, 100, 10, 20);
      graph.addNode('ADDR_2', 20, 100, 100, 10, 20);
      graph.addNode('ADDR_3', 10, 100, 100, 10, 20);

      const nodes = graph.getAllNodes();
      expect(nodes.map((n) => n.address)).toEqual(['ADDR_2', 'ADDR_3', 'ADDR_1']);
    });
  });

  describe('Edge Operations', () => {
    it('should auto-create source and target nodes when adding an edge', () => {
      graph.addEdge('ADDR_1', 'ADDR_2', 5, 'frequent_counterparty', 1000, 100, 200);

      const node1 = graph.getNode('ADDR_1');
      const node2 = graph.getNode('ADDR_2');

      expect(node1).not.toBeNull();
      expect(node2).not.toBeNull();
      expect(node1?.siblingCount).toBe(1);
    });

    it('should add an edge and retrieve it via getEdge', () => {
      graph.addEdge('ADDR_1', 'ADDR_2', 5, 'frequent_counterparty', 1000, 100, 200, { note: 'test' });
      const edge = graph.getEdge('ADDR_1', 'ADDR_2');

      expect(edge).not.toBeNull();
      expect(edge).toEqual({
        source: 'ADDR_1',
        target: 'ADDR_2',
        weight: 5,
        relationshipType: 'frequent_counterparty',
        firstInteractionRound: 100,
        lastInteractionRound: 200,
        totalValueTransferred: 1000,
        metadata: { note: 'test' },
      });
    });

    it('should return null when retrieving a non-existent edge', () => {
      graph.addNode('ADDR_1', 1, 0, 0, 1, 2);
      expect(graph.getEdge('ADDR_1', 'ADDR_2')).toBeNull();
      expect(graph.getEdge('NON_EXISTENT_1', 'NON_EXISTENT_2')).toBeNull();
    });

    it('should update an existing edge with same relationship type', () => {
      graph.addEdge('ADDR_1', 'ADDR_2', 5, 'frequent_counterparty', 1000, 100, 200, { key1: 'v1' });
      graph.addEdge('ADDR_1', 'ADDR_2', 8, 'frequent_counterparty', 2000, 100, 300, { key2: 'v2' });

      const edge = graph.getEdge('ADDR_1', 'ADDR_2');
      expect(edge?.weight).toBe(8); // Math.max(5, 8)
      expect(edge?.totalValueTransferred).toBe(2000); // Math.max(1000, 2000)
      expect(edge?.lastInteractionRound).toBe(300); // Math.max(200, 300)
      expect(edge?.metadata).toEqual({ key1: 'v1', key2: 'v2' });
    });

    it('should upgrade existing edge when new edge has higher weight with different relationship type', () => {
      graph.addEdge('ADDR_1', 'ADDR_2', 5, 'associated', 1000, 100, 200, { role: 'low' });
      graph.addEdge('ADDR_1', 'ADDR_2', 10, 'frequent_counterparty', 2000, 100, 300, { role: 'high' });

      const edge = graph.getEdge('ADDR_1', 'ADDR_2');
      expect(edge?.relationshipType).toBe('frequent_counterparty');
      expect(edge?.weight).toBe(10);
      expect(edge?.totalValueTransferred).toBe(2000);
      expect(edge?.metadata).toEqual({ role: 'high' });
    });

    it('should ignore edge update when new edge has lower weight with different relationship type', () => {
      graph.addEdge('ADDR_1', 'ADDR_2', 10, 'frequent_counterparty', 2000, 100, 300, { role: 'high' });
      graph.addEdge('ADDR_1', 'ADDR_2', 5, 'associated', 1000, 100, 200, { role: 'low' });

      const edge = graph.getEdge('ADDR_1', 'ADDR_2');
      expect(edge?.relationshipType).toBe('frequent_counterparty');
      expect(edge?.weight).toBe(10);
      expect(edge?.totalValueTransferred).toBe(2000);
      expect(edge?.metadata).toEqual({ role: 'high' });
    });

    it('should return all edges sorted by weight descending', () => {
      graph.addEdge('A', 'B', 2, 'associated', 100, 1, 2);
      graph.addEdge('B', 'C', 10, 'frequent_counterparty', 500, 1, 2);
      graph.addEdge('A', 'C', 5, 'funding_source', 300, 1, 2);

      const allEdges = graph.getAllEdges();
      expect(allEdges.map((e) => e.weight)).toEqual([10, 5, 2]);
    });
  });

  describe('Edge Querying (Outgoing, Incoming, Related)', () => {
    beforeEach(() => {
      graph.addEdge('ADDR_1', 'ADDR_2', 5, 'frequent_counterparty', 1000, 1, 10);
      graph.addEdge('ADDR_1', 'ADDR_3', 10, 'funding_source', 2000, 1, 10);
      graph.addEdge('ADDR_4', 'ADDR_1', 7, 'associated', 1500, 1, 10);
    });

    it('should return outgoing edges sorted by weight descending', () => {
      const outgoing = graph.getOutgoingEdges('ADDR_1');
      expect(outgoing.length).toBe(2);
      expect(outgoing[0].target).toBe('ADDR_3');
      expect(outgoing[0].weight).toBe(10);
      expect(outgoing[1].target).toBe('ADDR_2');
      expect(outgoing[1].weight).toBe(5);
    });

    it('should return empty array for outgoing edges of unknown or edge-less address', () => {
      expect(graph.getOutgoingEdges('ADDR_2')).toEqual([]);
      expect(graph.getOutgoingEdges('UNKNOWN')).toEqual([]);
    });

    it('should return incoming edges sorted by weight descending', () => {
      const incoming = graph.getIncomingEdges('ADDR_1');
      expect(incoming.length).toBe(1);
      expect(incoming[0].source).toBe('ADDR_4');
      expect(incoming[0].weight).toBe(7);
    });

    it('should return related wallets (both outgoing and incoming) sorted by weight descending', () => {
      const related = graph.getRelatedWallets('ADDR_1');
      expect(related.length).toBe(3);
      expect(related.map((e) => e.weight)).toEqual([10, 7, 5]);
    });

    it('should serve related wallets from cache on subsequent calls if cached', () => {
      // Access cache internal property to populate cache manually to test branch
      const cache = (graph as any).cache;
      cache.set('ADDR_1', ['ADDR_3', 'ADDR_2']);

      const related = graph.getRelatedWallets('ADDR_1');
      expect(related.length).toBe(2);
      expect(related.map((e) => e.target)).toEqual(['ADDR_3', 'ADDR_2']);
    });
  });

  describe('Path Finding (findPath)', () => {
    beforeEach(() => {
      // A -> B (weight 5)
      // B -> C (weight 3)
      // A -> D (weight 2)
      // D -> C (weight 4)
      // C -> E (weight 1)
      graph.addEdge('A', 'B', 5, 'associated', 100, 1, 10);
      graph.addEdge('B', 'C', 3, 'associated', 100, 1, 10);
      graph.addEdge('A', 'D', 2, 'associated', 100, 1, 10);
      graph.addEdge('D', 'C', 4, 'associated', 100, 1, 10);
      graph.addEdge('C', 'E', 1, 'associated', 100, 1, 10);
    });

    it('should find shortest path and all paths within depth limit', () => {
      const result = graph.findPath('A', 'C', 3);

      expect(result.shortest).not.toBeNull();
      expect(result.shortest?.length).toBe(2); // A -> B -> C or A -> D -> C
      expect(result.allPaths.length).toBe(2);
    });

    it('should return null shortest path and empty allPaths when target unreachable', () => {
      const result = graph.findPath('E', 'A', 3);

      expect(result.shortest).toBeNull();
      expect(result.allPaths).toEqual([]);
    });

    it('should respect maxDepth parameter', () => {
      // Path A -> B -> C -> E requires depth 3 (edges count)
      const shallowResult = graph.findPath('A', 'E', 2);
      expect(shallowResult.shortest).toBeNull();

      const deepResult = graph.findPath('A', 'E', 3);
      expect(deepResult.shortest).not.toBeNull();
      expect(deepResult.shortest?.length).toBe(3);
    });
  });

  describe('Graph Structure & Metrics', () => {
    it('should identify connected components in disjoint graph', () => {
      // Component 1: A <-> B
      graph.addEdge('A', 'B', 1, 'associated', 100, 1, 2);
      // Component 2: C <-> D
      graph.addEdge('C', 'D', 1, 'associated', 100, 1, 2);
      // Component 3: Isolated node E
      graph.addNode('E', 1, 0, 0, 1, 2);

      const components = graph.getConnectedComponents();
      expect(components.length).toBe(3);

      const addressesInComponents = components.map((c) => c.sort());
      expect(addressesInComponents).toContainEqual(['A', 'B']);
      expect(addressesInComponents).toContainEqual(['C', 'D']);
      expect(addressesInComponents).toContainEqual(['E']);
    });

    it('should calculate degree centrality correctly', () => {
      // Graph with 3 nodes: A -> B, A -> C
      graph.addEdge('A', 'B', 1, 'associated', 100, 1, 2);
      graph.addEdge('A', 'C', 1, 'associated', 100, 1, 2);

      const centrality = graph.getDegreeCentrality();
      expect(centrality.get('A')).toBe((2 + 0) / (3 - 1)); // 2 outgoing, 0 incoming -> 1.0
      expect(centrality.get('B')).toBe((0 + 1) / (3 - 1)); // 0 outgoing, 1 incoming -> 0.5
      expect(centrality.get('C')).toBe((0 + 1) / (3 - 1)); // 0 outgoing, 1 incoming -> 0.5
    });

    it('should handle degree centrality for 0 or 1 node', () => {
      expect(graph.getDegreeCentrality().size).toBe(0);

      graph.addNode('A', 1, 0, 0, 1, 2);
      expect(graph.getDegreeCentrality().size).toBe(0);
    });

    it('should calculate graph stats accurately', () => {
      graph.addEdge('A', 'B', 1, 'associated', 100, 1, 2);
      graph.addEdge('A', 'C', 1, 'associated', 100, 1, 2);

      const stats = graph.getStats();
      expect(stats.nodeCount).toBe(3);
      expect(stats.edgeCount).toBe(2);
      expect(stats.components).toBe(1);
      expect(stats.avgDegree).toBe(2 / 3);
    });

    it('should build graph from sibling discovery results and counterparty stats', () => {
      const siblings: SiblingWallet[] = [
        {
          address: 'SIBLING_1',
          relationshipType: 'frequent_counterparty',
          confidence: 0.9,
          reason: 'high interaction',
          interactionCount: 10,
          firstSeenRound: 100,
          lastSeenRound: 500,
          totalValueTransferred: 50000,
        },
      ];

      const counterpartyStats: CounterpartyStats[] = [
        {
          address: 'SIBLING_1',
          interactionCount: 10,
          totalReceived: 30000,
          totalSent: 20000,
          netFlow: 10000,
          firstInteractionRound: 100,
          lastInteractionRound: 500,
          interactionTypes: { sent: 5, received: 5, assetTransfer: 0 },
        },
      ];

      graph.buildFromSiblings('MAIN_WALLET', siblings, counterpartyStats);

      const mainNode = graph.getNode('MAIN_WALLET');
      expect(mainNode).not.toBeNull();
      expect(mainNode?.transactionCount).toBe(10);

      const edge = graph.getEdge('MAIN_WALLET', 'SIBLING_1');
      expect(edge).not.toBeNull();
      expect(edge?.weight).toBe(10);
      expect(edge?.relationshipType).toBe('frequent_counterparty');
    });

    it('should clear all nodes, edges, adjacency list, and cache when clear() is called', () => {
      graph.addEdge('A', 'B', 1, 'associated', 100, 1, 2);
      expect(graph.getStats().nodeCount).toBe(2);

      graph.clear();

      expect(graph.getStats().nodeCount).toBe(0);
      expect(graph.getStats().edgeCount).toBe(0);
      expect(graph.getNode('A')).toBeNull();
      expect(graph.getEdge('A', 'B')).toBeNull();
    });
  });
});
