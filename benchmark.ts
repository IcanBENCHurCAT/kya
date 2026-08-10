import { WalletGraph } from "./src/graph/walletGraph.js";

function runBenchmark() {
  const graph = new WalletGraph();
  const NUM_NODES = 2000;

  // Add nodes
  for (let i = 0; i < NUM_NODES; i++) {
    graph.addNode(`node_${i}`, 0, 0, 0, 0, 0);
  }

  // Add edges (sparse graph)
  for (let i = 0; i < NUM_NODES; i++) {
    for (let j = 1; j <= 20; j++) {
      const target = (i + j) % NUM_NODES;
      graph.addEdge(`node_${i}`, `node_${target}`, 1, 'transfer', 10, 0, 0);
    }
  }

  const start = performance.now();
  const centrality = graph.getDegreeCentrality();
  const end = performance.now();

  console.log(`Centrality calculated in ${end - start} ms`);
}

runBenchmark();
