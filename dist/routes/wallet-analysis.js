/**
 * Algorand Wallet Analysis Routes
 *
 * Endpoints:
 *   GET    /api/v1/wallet/<address>          — Wallet info + transaction summary
 *   GET    /api/v1/wallet/<address>/txs      — Transaction history
 *   GET    /api/v1/wallet/<address>/siblings — Sibling wallet discovery
 *   GET    /api/v1/wallet/<address>/graph    — Related wallets (graph query)
 *   GET    /api/v1/wallet/graph              — Full graph stats
 *   GET    /api/v1/wallet/health             — Algorand RPC health
 */
import { Hono } from 'hono';
import { AlgorandClient } from '../algorand/client.js';
import { TransactionHistoryService } from '../services/transactionHistory.js';
import { SiblingDiscoveryService } from '../services/siblingDiscovery.js';
import { WalletGraph } from '../graph/walletGraph.js';
import { InMemoryCache } from '../cache/inMemoryCache.js';
const app = new Hono();
// Shared instances (initialized lazily)
let _client = null;
let _history = null;
let _discovery = null;
let _graph = null;
let _algorandCache = null;
function getClient() {
    if (!_client) {
        _client = new AlgorandClient();
    }
    return _client;
}
function getHistory() {
    if (!_history) {
        _history = new TransactionHistoryService(getClient());
    }
    return _history;
}
function getDiscovery() {
    if (!_discovery) {
        _discovery = new SiblingDiscoveryService();
    }
    return _discovery;
}
function getGraph() {
    if (!_graph) {
        _graph = new WalletGraph();
    }
    return _graph;
}
function getAlgorandCache() {
    if (!_algorandCache) {
        _algorandCache = new InMemoryCache(300_000, 5_000);
    }
    return _algorandCache;
}
// ─── Health check ──────────────────────────────────────────────────
app.get('/api/v1/wallet/health', async (c) => {
    try {
        const client = getClient();
        const status = await client.getNetworkParams();
        return c.json({
            status: 'ok',
            network: client.network,
            lastRound: status.lastRound,
        });
    }
    catch (err) {
        return c.json({
            status: 'degraded',
            error: err instanceof Error ? err.message : String(err),
        }, 503);
    }
});
// ─── Wallet info (basic profile) ───────────────────────────────────
app.get('/api/v1/wallet/:address', async (c) => {
    const address = c.req.param('address');
    try {
        const client = getClient();
        const info = await client.getAccountInfo(address);
        return c.json({
            address,
            balance: info.amount,
            minBalance: info.minBalance,
            totalApps: info.totalAppsCreated,
            totalAssets: info.totalAssetsCreated,
            totalTxn: info.totalTxn,
            assets: (info.assets || []).map((a) => ({
                assetId: (a.assetIndex ?? 0),
                amount: (a.amount ?? 0),
            })),
        });
    }
    catch (err) {
        return c.json({
            address,
            error: err instanceof Error ? err.message : String(err),
        }, 404);
    }
});
// ─── Transaction history ───────────────────────────────────────────
app.get('/api/v1/wallet/:address/txs', async (c) => {
    const address = c.req.param('address');
    const limit = parseInt(c.req.query('limit') || '100', 10);
    const force = c.req.query('force') === 'true';
    try {
        const service = getHistory();
        const history = await service.getTransactionHistory(address, {
            limit: Math.min(limit, 1000),
            forceRefresh: force,
        });
        // Also refresh the graph with this address
        const graph = getGraph();
        graph.buildFromSiblings(address, getDiscovery().discoverSiblings(address, history.transactions, history.topCounterparties), history.topCounterparties);
        return c.json({
            address: history.address,
            totalTransactions: history.totalTransactions,
            incomingTransactions: history.incomingTransactions,
            outgoingTransactions: history.outgoingTransactions,
            totalReceived: history.totalReceived,
            totalSent: history.totalSent,
            netBalance: history.netBalance,
            firstSeenRound: history.firstSeenRound,
            lastSeenRound: history.lastSeenRound,
            topCounterparties: history.topCounterparties,
            topAssets: history.topAssets,
            transactions: history.transactions,
        });
    }
    catch (err) {
        return c.json({
            address,
            error: err instanceof Error ? err.message : String(err),
        }, 500);
    }
});
// ─── Sibling discovery ─────────────────────────────────────────────
app.get('/api/v1/wallet/:address/siblings', async (c) => {
    const address = c.req.param('address');
    try {
        // First get transaction history
        const service = getHistory();
        const history = await service.getTransactionHistory(address, { limit: 500 });
        // Discover siblings
        const discovery = getDiscovery();
        const siblings = discovery.discoverSiblings(address, history.transactions, history.topCounterparties);
        // Add to graph
        const graph = getGraph();
        graph.buildFromSiblings(address, siblings, history.topCounterparties);
        return c.json({
            address,
            siblings,
            siblingCount: siblings.length,
        });
    }
    catch (err) {
        return c.json({
            address,
            error: err instanceof Error ? err.message : String(err),
        }, 500);
    }
});
// ─── Wallet graph query ────────────────────────────────────────────
app.get('/api/v1/wallet/:address/graph', async (c) => {
    const address = c.req.param('address');
    try {
        const graph = getGraph();
        const related = graph.getRelatedWallets(address);
        return c.json({
            address,
            relatedWallets: related,
            relationshipCount: related.length,
        });
    }
    catch (err) {
        return c.json({
            address,
            error: err instanceof Error ? err.message : String(err),
        }, 500);
    }
});
app.get('/api/v1/wallet/graph', async (c) => {
    try {
        const graph = getGraph();
        const stats = graph.getStats();
        return c.json({
            nodeCount: stats.nodeCount,
            edgeCount: stats.edgeCount,
            components: stats.components,
            avgDegree: stats.avgDegree,
            topNodes: graph.getAllNodes().slice(0, 20),
            topEdges: graph.getAllEdges().slice(0, 20),
        });
    }
    catch (err) {
        return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
    }
});
export default app;
