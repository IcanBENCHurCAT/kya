import { getState, getSummary } from './watchlist-updater.js';

export interface HealthCheckResult {
  status: 'healthy' | 'degraded';
  timestamp: string;
  checks: {
    supabase: {
      ok: boolean;
      latencyMs?: number;
      detail?: string;
    };
    watchlist: {
      ok: boolean;
      loaded: boolean;
      lastUpdate?: string;
      totalEntries: number;
    };
    algorand: {
      ok: boolean;
      latencyMs?: number;
      detail?: string;
    };
  };
}

/**
 * Executes a fetch request with a timeout using AbortController.
 */
async function fetchWithTimeout(resource: RequestInfo | URL, options: RequestInit & { timeout?: number } = {}) {
  const { timeout = 3000 } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  const response = await fetch(resource, {
    ...options,
    signal: controller.signal
  });
  clearTimeout(id);

  return response;
}

/**
 * Runs all health diagnostics and returns the combined status.
 */
export async function checkHealth(): Promise<HealthCheckResult> {
  const result: HealthCheckResult = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      supabase: { ok: true },
      watchlist: { ok: true, loaded: false, totalEntries: 0 },
      algorand: { ok: true },
    }
  };

  let isDegraded = false;

  const dbUrl = process.env.SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const algoUrl = process.env.ALGORAND_NETWORK_URL || "https://mainnet-api.algonode.cloud";

  // Run probes concurrently
  const [supabaseCheck, watchlistCheck, algorandCheck] = await Promise.all([
    // 1. Probe Supabase connectivity
    (async () => {
      if (!dbUrl || !serviceRoleKey) {
        return { ok: true, detail: "unconfigured" };
      }
      const start = Date.now();
      try {
        const res = await fetchWithTimeout(`${dbUrl}/rest/v1/`, {
          headers: {
            'apikey': serviceRoleKey,
            'Authorization': `Bearer ${serviceRoleKey}`
          },
          timeout: 3000
        });
        const latencyMs = Date.now() - start;

        if (!res.ok) {
          return { ok: false, latencyMs, detail: `HTTP ${res.status}` };
        }
        return { ok: true, latencyMs };
      } catch (err: any) {
        return {
          ok: false,
          detail: err.name === 'AbortError' ? 'timeout' : err.message
        };
      }
    })(),

    // 2. Probe Watchlist state
    (async () => {
      try {
        const state = getState();
        const summary = getSummary();
        const entries = state.totalEntries || summary.totalEntries || 0;
        const isLoaded = entries > 0;

        return {
          ok: isLoaded,
          loaded: isLoaded,
          lastUpdate: state.lastUpdate || summary.lastUpdated,
          totalEntries: entries,
        };
      } catch (err: any) {
        return { ok: false, loaded: false, totalEntries: 0 };
      }
    })(),

    // 3. Probe Algorand API reachability
    (async () => {
      const start = Date.now();
      try {
        const res = await fetchWithTimeout(`${algoUrl}/health`, {
          method: 'GET',
          timeout: 3000
        });
        const latencyMs = Date.now() - start;

        if (res.status >= 200 && res.status < 300) {
          return { ok: true, latencyMs };
        }
        return { ok: false, latencyMs, detail: `HTTP ${res.status}` };
      } catch (err: any) {
        return {
          ok: false,
          detail: err.name === 'AbortError' ? 'timeout' : err.message
        };
      }
    })()
  ]);

  result.checks.supabase = supabaseCheck;
  result.checks.watchlist = watchlistCheck;
  result.checks.algorand = algorandCheck;

  if (!supabaseCheck.ok || !watchlistCheck.ok || !algorandCheck.ok) {
    isDegraded = true;
  }

  if (isDegraded) {
    result.status = 'degraded';
  }

  return result;
}
