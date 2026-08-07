/**
 * Comprehensive tests for the Algorand Wallet Analysis data layer
 * Tests:
 * 1. InMemoryCache — TTL, eviction, stats, hit rate
 * 2. AlgorandClient — configuration and type checks (mocked blockchain)
 * 3. TransactionHistoryService — aggregated history, counterparty stats
 * 4. SiblingDiscoveryService — frequent counterparties, creator wallets
 * 5. WalletGraph — nodes, edges, path finding, degree centrality
 * 
 * Run with: npm test (via vitest)
 */

import assert from 'node:assert';
import { setTimeout as sleep } from 'node:timers/promises';

// ============================================================
// 1. In-Memory Cache Tests
// ============================================================
console.log('\n🧪 Testing InMemoryCache...');

const { InMemoryCache, createAlgorandCache } = await import('../src/cache/inMemoryCache.js');
const { TransactionHistoryService } = await import('../src/services/transactionHistory.js');
const { SiblingDiscoveryService } = await import('../src/services/siblingDiscovery.js');
const { WalletGraph } = await import('../src/graph/walletGraph.js');
const { AlgorandClient, DEFAULT_CONFIG } = await import('../src/algorand/client.js');

// Simple mock client that returns controlled test data — no network needed
class MockAlgorandClient {
  private _mockTxs: any[] = [];

  setMockTransactions(txns: any[]) {
    this._mockTxs = txns;
  }

  async getTransactionsByAddress() {
    return this._mockTxs;
  }

  async getNetworkParams() {
    return { lastRound: 100 };
  }
}

// Mock Algorand client that exposes internal methods for testing
class TestAlgorandClient extends MockAlgorandClient {
  async getTransactionsByAddress() {
    return this._mockTxs;
  }
}

async function testCache() {
  console.log('  Testing basic cache operations...');
  const cache = new InMemoryCache(1000, 100);

  // Test set and get
  cache.set('key1', 'value1');
  assert.strictEqual(cache.get('key1'), 'value1');
  assert.strictEqual(cache.get('nonexistent'), null);

  // Test delete
  cache.delete('key1');
  assert.strictEqual(cache.get('key1'), null);

  // Test TTL
  cache.set('ttl_key', 'ttl_value', 50);
  assert.strictEqual(cache.get('ttl_key'), 'ttl_value');
  await sleep(60);
  assert.strictEqual(cache.get('ttl_key'), null);

  // Test size limit and eviction
  const smallCache = new InMemoryCache(60000, 3);
  smallCache.set('a', 1);
  smallCache.set('b', 2);
  smallCache.set('c', 3);
  assert.strictEqual(smallCache.keys().length, 3);
  smallCache.set('d', 4); // Should evict oldest ('a')
  assert.strictEqual(smallCache.get('a'), null);
  assert.strictEqual(smallCache.get('d'), 4);

  // Test stats
  const statsCache = new InMemoryCache(60000, 10);
  statsCache.set('hit', 'value');
  statsCache.get('hit'); // hit
  statsCache.get('hit'); // hit
  statsCache.get('miss'); // miss
  const stats = statsCache.getStats();
  assert.strictEqual(stats.hits, 2);
  assert.strictEqual(stats.misses, 1);
  assert.strictEqual(stats.size, 1);
  assert.ok(statsCache.getHitRate() > 0);

  // Test cleanup
  const cleanupCache = new InMemoryCache(50, 10);
  cleanupCache.set('expire1', 'v1', 50);
  cleanupCache.set('expire2', 'v2', 50);
  cleanupCache.set('stay', 'v3', 60000);
  await sleep(60);
  const removed = cleanupCache.cleanup();
  assert.strictEqual(removed, 2);
  assert.strictEqual(cleanupCache.get('stay'), 'v3');

  // Test clear
  statsCache.clear();
  assert.strictEqual(statsCache.getStats().hits, 0);
  assert.strictEqual(statsCache.getStats().size, 0);

  console.log('  ✅ InMemoryCache tests passed');
}

// ============================================================
// 2. AlgorandClient Tests (config only, no network)
// ============================================================
async function testAlgorandClient() {
  console.log('  Testing AlgorandClient configuration...');
  
  // Test client instantiation (won't actually connect — we verify it creates without error)
  const client = new AlgorandClient();
  assert.ok(client);

  // Test custom config
  const customClient = new AlgorandClient({
    network: 'mainnet',
    nodeURL: 'https://mainnet-api.algonode.cloud',
    indexerURL: 'https://mainnet-indexer.algonode.cloud',
  });
  assert.ok(customClient);

  console.log('  ✅ AlgorandClient tests passed');
}

// ============================================================
// 3. TransactionHistoryService Tests (mocked blockchain)
// ============================================================
async function testTransactionHistory() {
  console.log('  Testing TransactionHistoryService with mock data...');

  // Create a mock client instance that we control
  const mockClient = new MockAlgorandClient();
  mockClient.setMockTransactions([
    {
      txid: 'TEST001',
      round: 100,
      timestamp: Date.now() - 100000,
      sender: 'ADDR_SENDER_A',
      receiver: 'ADDR_TARGET',
      amount: 5000000, // 5 ALGO in microAlgos
      fee: 1000,
      type: 'received',
      confirmations: 1000,
    },
    {
      txid: 'TEST002',
      round: 200,
      timestamp: Date.now() - 90000,
      sender: 'ADDR_TARGET',
      receiver: 'ADDR_COUNTERPARTY_1',
      amount: 2000000, // 2 ALGO
      fee: 1000,
      type: 'sent',
      confirmations: 900,
    },
    {
      txid: 'TEST003',
      round: 300,
      timestamp: Date.now() - 80000,
      sender: 'ADDR_TARGET',
      receiver: 'ADDR_COUNTERPARTY_1',
      amount: 3000000, // 3 ALGO
      fee: 1000,
      type: 'sent',
      confirmations: 800,
    },
    {
      txid: 'TEST004',
      round: 400,
      timestamp: Date.now() - 70000,
      sender: 'ADDR_COUNTERPARTY_2',
      receiver: 'ADDR_TARGET',
      amount: 1000000, // 1 ALGO
      fee: 1000,
      type: 'received',
      confirmations: 700,
    },
  ]);

  // TransactionHistoryService takes an AlgorandClient. We pass the mock.
  // Since TransactionHistoryService calls client.getTransactionsByAddress(),
  // the mock will return our controlled data.
  // We need to cast the mock to satisfy TypeScript's AlgorandClient type.
  // The real AlgorandClient has the same method signature, so this is safe.
  const service = new TransactionHistoryService(mockClient as any);

  // Test getting transaction history
  const history = await service.getTransactionHistory('ADDR_TARGET');

  assert.strictEqual(history.address, 'ADDR_TARGET');
  assert.strictEqual(history.totalTransactions, 4);
  assert.strictEqual(history.incomingTransactions, 2);
  assert.strictEqual(history.outgoingTransactions, 2);
  assert.strictEqual(history.totalReceived, 6000000); // 5M + 1M
  assert.strictEqual(history.totalSent, 5000000); // 2M + 3M
  assert.strictEqual(history.netBalance, 1000000); // 6M - 5M

  // Test counterparty stats
  assert.strictEqual(history.topCounterparties.length, 3);
  const counterparty1 = history.topCounterparties.find(
    (c) => c.address === 'ADDR_COUNTERPARTY_1'
  );
  assert.ok(counterparty1);
  assert.strictEqual(counterparty1.interactionCount, 2);
  assert.strictEqual(counterparty1.totalSent, 5000000);

  // Test cache (second call should use cache)
  const history2 = await service.getTransactionHistory('ADDR_TARGET');
  assert.strictEqual(history2.totalTransactions, 4);
  assert.strictEqual(history2.totalReceived, 6000000);

  // Test cache stats
  const cacheStats = service.getCacheStats();
  assert.strictEqual(cacheStats.size, 1);

  // Test invalidation
  service.invalidate('ADDR_TARGET');
  const afterInvalidate = service.getCacheStats();
  assert.strictEqual(afterInvalidate.size, 0);

  console.log('  ✅ TransactionHistoryService tests passed');
}

// ============================================================
// 4. SiblingDiscoveryService Tests
// ============================================================
async function testSiblingDiscovery() {
  console.log('  Testing SiblingDiscoveryService...');

  const service = new SiblingDiscoveryService(2, 0.1);

  const mockTransactions = [
    {
      txid: 'TX001',
      round: 100,
      timestamp: Date.now(),
      sender: 'ADDR_A',
      receiver: 'ADDR_B',
      amount: 1000000,
      fee: 1000,
      type: 'received',
      confirmations: 100,
    },
    {
      txid: 'TX002',
      round: 200,
      timestamp: Date.now(),
      sender: 'ADDR_B',
      receiver: 'ADDR_A',
      amount: 500000,
      fee: 1000,
      type: 'sent',
      confirmations: 99,
    },
    {
      txid: 'TX003',
      round: 300,
      timestamp: Date.now(),
      sender: 'ADDR_A',
      receiver: 'ADDR_B',
      amount: 2000000,
      fee: 1000,
      type: 'received',
      confirmations: 98,
    },
    {
      txid: 'TX004',
      round: 400,
      timestamp: Date.now(),
      sender: 'ADDR_A',
      receiver: 'ADDR_C',
      amount: 3000000,
      fee: 1000,
      type: 'received',
      confirmations: 97,
    },
  ];

  const mockCounterparties = [
    {
      address: 'ADDR_B',
      interactionCount: 3,
      totalReceived: 3000000,
      totalSent: 500000,
      netFlow: 2500000,
      firstInteractionRound: 100,
      lastInteractionRound: 400,
      interactionTypes: { sent: 1, received: 2, assetTransfer: 0 },
    },
    {
      address: 'ADDR_C',
      interactionCount: 1,
      totalReceived: 0,
      totalSent: 3000000,
      netFlow: -3000000,
      firstInteractionRound: 400,
      lastInteractionRound: 400,
      interactionTypes: { sent: 1, received: 0, assetTransfer: 0 },
    },
  ];

  // Test discovery with threshold=2
  const siblings = service.discoverSiblings(
    'ADDR_A',
    mockTransactions,
    mockCounterparties
  );

  // ADDR_B should be discovered (3 interactions >= threshold of 2)
  const siblingB = siblings.find((s) => s.address === 'ADDR_B');
  assert.ok(siblingB);
  assert.strictEqual(siblingB.relationshipType, 'frequent_counterparty');
  assert.strictEqual(siblingB.interactionCount, 3);
  assert.ok(siblingB.confidence > 0);

  // ADDR_C should NOT be discovered (only 1 interaction < threshold)
  const siblingC = siblings.find((s) => s.address === 'ADDR_C');
  assert.ok(!siblingC);

  // Test confidence scoring
  assert.ok(siblingB.confidence >= 0);
  assert.ok(siblingB.confidence <= 1);

  // Test cache stats
  const cacheStats = service.getCacheStats();
  assert.ok(cacheStats.size >= 0);

  console.log('  ✅ SiblingDiscoveryService tests passed');
}

// ============================================================
// 5. WalletGraph Tests
// ============================================================
async function testWalletGraph() {
  console.log('  Testing WalletGraph...');

  const graph = new WalletGraph();

  // Add nodes
  graph.addNode('ADDR_A', 10, 10000000, 5000000, 100, 1000);
  graph.addNode('ADDR_B', 5, 3000000, 2000000, 200, 800);
  graph.addNode('ADDR_C', 3, 1000000, 500000, 300, 700);

  // Verify nodes were added
  assert.ok(graph.getNode('ADDR_A'));
  assert.ok(graph.getNode('ADDR_B'));
  assert.ok(graph.getNode('ADDR_C'));

  // Add edges
  graph.addEdge('ADDR_A', 'ADDR_B', 3, 'frequent_counterparty', 5000000, 100, 500);
  graph.addEdge('ADDR_A', 'ADDR_C', 1, 'frequent_counterparty', 3000000, 400, 700);
  graph.addEdge('ADDR_B', 'ADDR_C', 2, 'associated', 2000000, 300, 600);

  // Test getRelatedWallets
  const relatedToA = graph.getRelatedWallets('ADDR_A');
  assert.strictEqual(relatedToA.length, 2);

  // Test getOutgoingEdges
  const outgoingA = graph.getOutgoingEdges('ADDR_A');
  assert.strictEqual(outgoingA.length, 2);

  // Test getIncomingEdges
  const incomingB = graph.getIncomingEdges('ADDR_B');
  assert.strictEqual(incomingB.length, 1);
  assert.strictEqual(incomingB[0].source, 'ADDR_A');

  // Test getEdge
  const edgeAB = graph.getEdge('ADDR_A', 'ADDR_B');
  assert.ok(edgeAB);
  assert.strictEqual(edgeAB!.weight, 3);

  // Test getAllEdges
  const allEdges = graph.getAllEdges();
  assert.strictEqual(allEdges.length, 3);

  // Test graph stats
  const stats = graph.getStats();
  assert.strictEqual(stats.nodeCount, 3);
  assert.strictEqual(stats.edgeCount, 3);
  assert.ok(stats.components > 0);

  // Test buildFromSiblings
  const graph2 = new WalletGraph();
  const mockSiblings = [
    {
      address: 'ADDR_X',
      relationshipType: 'frequent_counterparty' as const,
      confidence: 0.9,
      reason: 'test',
      interactionCount: 5,
      firstSeenRound: 100,
      lastSeenRound: 500,
      totalValueTransferred: 10000000,
    },
    {
      address: 'ADDR_Y',
      relationshipType: 'associated' as const,
      confidence: 0.5,
      reason: 'test',
      interactionCount: 2,
      firstSeenRound: 200,
      lastSeenRound: 400,
      totalValueTransferred: 5000000,
    },
  ];

  graph2.buildFromSiblings('ADDR_MAIN', mockSiblings);
  assert.ok(graph2.getNode('ADDR_MAIN'));
  assert.ok(graph2.getNode('ADDR_X'));
  assert.ok(graph2.getNode('ADDR_Y'));
  assert.strictEqual(graph2.getAllEdges().length, 2);

  // Test findPath
  const pathResult = graph.findPath('ADDR_A', 'ADDR_C');
  assert.ok(pathResult.shortest !== null);
  assert.ok(pathResult.allPaths.length > 0);

  // Test degree centrality
  const centrality = graph.getDegreeCentrality();
  assert.ok(centrality.has('ADDR_A'));
  assert.ok(centrality.has('ADDR_B'));
  assert.ok(centrality.has('ADDR_C'));
  // ADDR_A has the most connections, so highest centrality
  assert.ok(centrality.get('ADDR_A')! >= centrality.get('ADDR_B')!);

  // Test clear
  graph.clear();
  assert.strictEqual(graph.getStats().nodeCount, 0);
  assert.strictEqual(graph.getStats().edgeCount, 0);

  console.log('  ✅ WalletGraph tests passed');
}

import { describe, it } from 'vitest';

describe('Algorand Wallet Analysis', () => {
  it('should run cache tests', async () => {
    await testCache();
  });

  it('should run algorand client tests', async () => {
    await testAlgorandClient();
  });

  it('should run transaction history tests', async () => {
    await testTransactionHistory();
  });

  it('should run sibling discovery tests', async () => {
    await testSiblingDiscovery();
  });

  it('should run wallet graph tests', async () => {
    await testWalletGraph();
  });
});
