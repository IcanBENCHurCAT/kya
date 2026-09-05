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

import { Hono } from "hono";
import { isValidAddress } from "algosdk";
import { AlgorandClient } from "../algorand/client.js";
import { TransactionHistoryService } from "../services/transactionHistory.js";
import { SiblingDiscoveryService } from "../services/siblingDiscovery.js";
import { WalletGraph } from "../graph/walletGraph.js";
import { InMemoryCache } from "../cache/inMemoryCache.js";
import type { AlgorandConfig } from "../types/index.js";

const app = new Hono();

// Shared instances (initialized lazily)
let _client: AlgorandClient | null = null;
let _history: TransactionHistoryService | null = null;
let _discovery: SiblingDiscoveryService | null = null;
let _graph: WalletGraph | null = null;
let _algorandCache: InMemoryCache<string, unknown> | null = null;

function getClient(): AlgorandClient {
  if (!_client) {
    _client = new AlgorandClient();
  }
  return _client;
}

function getHistory(): TransactionHistoryService {
  if (!_history) {
    _history = new TransactionHistoryService(getClient());
  }
  return _history;
}

function getDiscovery(): SiblingDiscoveryService {
  if (!_discovery) {
    _discovery = new SiblingDiscoveryService();
  }
  return _discovery;
}

function getGraph(): WalletGraph {
  if (!_graph) {
    _graph = new WalletGraph();
  }
  return _graph;
}

function getAlgorandCache(): InMemoryCache<string, unknown> {
  if (!_algorandCache) {
    _algorandCache = new InMemoryCache(300_000, 5_000);
  }
  return _algorandCache;
}

// ─── Health check ──────────────────────────────────────────────────

const handleWalletHealth = async (c: any) => {
  try {
    const client = getClient();
    const status = await client.getNetworkParams();
    return c.json({
      status: "ok",
      network: (client as any).network,
      lastRound: status.lastRound,
    });
  } catch (err) {
    return c.json(
      {
        status: "degraded",
        error: err instanceof Error ? err.message : String(err),
      },
      503,
    );
  }
};

app.get("/wallet/health", handleWalletHealth);
app.get("/api/v1/wallet/health", handleWalletHealth);

// ─── Wallet info (basic profile) ───────────────────────────────────

const handleWalletInfo = async (c: any) => {
  const address = c.req.param("address");
  if (!address || !isValidAddress(address)) {
    return c.json({ error: "Invalid Algorand address format" }, 400);
  }
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
      assets: ((info as any).assets || []).map(
        (a: Record<string, unknown>) => ({
          assetId: (a.assetIndex ?? 0) as number,
          amount: (a.amount ?? 0) as number,
        }),
      ),
    });
  } catch (err) {
    console.error(`Error fetching account info for ${address}:`, err);
    return c.json(
      {
        address,
        error: "Wallet information not found or unavailable",
      },
      404,
    );
  }
};

app.get("/wallet/:address", handleWalletInfo);
app.get("/api/v1/wallet/:address", handleWalletInfo);

// ─── Transaction history ───────────────────────────────────────────

const handleWalletTxs = async (c: any) => {
  const address = c.req.param("address");
  if (!address || !isValidAddress(address)) {
    return c.json({ error: "Invalid Algorand address format" }, 400);
  }
  const limit = parseInt(c.req.query("limit") || "100", 10);
  const force = c.req.query("force") === "true";

  try {
    const service = getHistory();
    const history = await service.getTransactionHistory(address, {
      limit: Math.min(limit, 1000),
      forceRefresh: force,
    });

    // Also refresh the graph with this address
    const graph = getGraph();
    graph.buildFromSiblings(
      address,
      getDiscovery().discoverSiblings(
        address,
        history.transactions,
        history.topCounterparties,
      ),
      history.topCounterparties,
    );

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
  } catch (err) {
    console.error(`Error fetching transaction history for ${address}:`, err);
    return c.json(
      {
        address,
        error: "Failed to retrieve transaction history",
      },
      500,
    );
  }
};

app.get("/wallet/:address/txs", handleWalletTxs);
app.get("/api/v1/wallet/:address/txs", handleWalletTxs);

// ─── Sibling discovery ─────────────────────────────────────────────

const handleWalletSiblings = async (c: any) => {
  const address = c.req.param("address");
  if (!address || !isValidAddress(address)) {
    return c.json({ error: "Invalid Algorand address format" }, 400);
  }
  try {
    // First get transaction history
    const service = getHistory();
    const history = await service.getTransactionHistory(address, {
      limit: 500,
    });

    // Discover siblings
    const discovery = getDiscovery();
    const siblings = discovery.discoverSiblings(
      address,
      history.transactions,
      history.topCounterparties,
    );

    // Add to graph
    const graph = getGraph();
    graph.buildFromSiblings(address, siblings, history.topCounterparties);

    return c.json({
      address,
      siblings,
      siblingCount: siblings.length,
    });
  } catch (err) {
    console.error(`Error discovering siblings for ${address}:`, err);
    return c.json(
      {
        address,
        error: "Failed to discover sibling wallets",
      },
      500,
    );
  }
};

app.get("/wallet/:address/siblings", handleWalletSiblings);
app.get("/api/v1/wallet/:address/siblings", handleWalletSiblings);

// ─── Wallet graph query ────────────────────────────────────────────

const handleWalletGraph = async (c: any) => {
  const address = c.req.param("address");
  if (!address || !isValidAddress(address)) {
    return c.json({ error: "Invalid Algorand address format" }, 400);
  }
  try {
    const graph = getGraph();
    const related = graph.getRelatedWallets(address);

    return c.json({
      address,
      relatedWallets: related,
      relationshipCount: related.length,
    });
  } catch (err) {
    console.error(`Error querying graph for ${address}:`, err);
    return c.json(
      {
        address,
        error: "Failed to query wallet graph",
      },
      500,
    );
  }
};

app.get("/wallet/:address/graph", handleWalletGraph);
app.get("/api/v1/wallet/:address/graph", handleWalletGraph);

const handleFullGraph = async (c: any) => {
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
  } catch (err) {
    return c.json(
      { error: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
};

app.get("/wallet/graph", handleFullGraph);
app.get("/api/v1/wallet/graph", handleFullGraph);

export default app;
