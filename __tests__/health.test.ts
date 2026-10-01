import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkHealth } from '../src/services/health.js';
import * as watchlistUpdater from '../src/services/watchlist-updater.js';
import { app } from '../src/app.js';

// Mock the dependencies
vi.mock('../src/services/watchlist-updater.js', () => ({
  getState: vi.fn(),
  getSummary: vi.fn(),
}));

describe('Health Checks', () => {
  let originalFetch: typeof fetch;
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    originalFetch = global.fetch;
    global.fetch = mockFetch as any;

    // Set standard env variables
    process.env.SUPABASE_URL = 'http://mock-supabase.local';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-key';
    process.env.ALGORAND_NETWORK_URL = 'http://mock-algorand.local';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.ALGORAND_NETWORK_URL;
  });

  it('should return healthy when all probes pass', async () => {
    // Mock Supabase passing
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 } as any);

    // Mock Watchlist passing
    vi.mocked(watchlistUpdater.getState).mockReturnValue({
      totalEntries: 100,
      lastUpdate: '2023-01-01',
      lastUpdateSource: 'mock',
      version: '1',
      running: false,
    });
    vi.mocked(watchlistUpdater.getSummary).mockReturnValue({
      totalEntries: 100,
      lastUpdated: '2023-01-01',
      name: 'mock',
      version: '1',
      source: 'mock',
      cached: true,
    });

    // Mock Algorand passing
    mockFetch.mockResolvedValueOnce({ ok: true, status: 204 } as any);

    const result = await checkHealth();

    expect(result.status).toBe('healthy');
    expect(result.checks.supabase.ok).toBe(true);
    expect(result.checks.watchlist.ok).toBe(true);
    expect(result.checks.algorand.ok).toBe(true);
  });

  it('should report unconfigured for Supabase when env vars are missing', async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Mock Watchlist passing
    vi.mocked(watchlistUpdater.getState).mockReturnValue({
      totalEntries: 100,
      lastUpdate: '2023-01-01',
      lastUpdateSource: 'mock',
      version: '1',
      running: false,
    });
    vi.mocked(watchlistUpdater.getSummary).mockReturnValue({
      totalEntries: 100,
      lastUpdated: '2023-01-01',
      name: 'mock',
      version: '1',
      source: 'mock',
      cached: true,
    });

    // Mock Algorand passing
    mockFetch.mockResolvedValueOnce({ ok: true, status: 204 } as any);

    const result = await checkHealth();

    // It's still healthy, just unconfigured
    expect(result.status).toBe('healthy');
    expect(result.checks.supabase.ok).toBe(true);
    expect(result.checks.supabase.detail).toBe('unconfigured');
  });

  it('should return degraded when Supabase probe fails', async () => {
    // Mock Supabase failing
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 } as any);

    // Mock Watchlist passing
    vi.mocked(watchlistUpdater.getState).mockReturnValue({
      totalEntries: 100,
      lastUpdate: '2023-01-01',
      lastUpdateSource: 'mock',
      version: '1',
      running: false,
    });
    vi.mocked(watchlistUpdater.getSummary).mockReturnValue({
      totalEntries: 100,
      lastUpdated: '2023-01-01',
      name: 'mock',
      version: '1',
      source: 'mock',
      cached: true,
    });

    // Mock Algorand passing
    mockFetch.mockResolvedValueOnce({ ok: true, status: 204 } as any);

    const result = await checkHealth();

    expect(result.status).toBe('degraded');
    expect(result.checks.supabase.ok).toBe(false);
    expect(result.checks.supabase.detail).toBe('HTTP 500');
  });

  it('should return degraded when Watchlist probe fails', async () => {
    // Mock Supabase passing
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 } as any);

    // Mock Watchlist failing (0 entries)
    vi.mocked(watchlistUpdater.getState).mockReturnValue({
      totalEntries: 0,
      lastUpdate: '',
      lastUpdateSource: '',
      version: '',
      running: false,
    });
    vi.mocked(watchlistUpdater.getSummary).mockReturnValue({
      totalEntries: 0,
      lastUpdated: '',
      name: '',
      version: '',
      source: '',
      cached: false,
    });

    // Mock Algorand passing
    mockFetch.mockResolvedValueOnce({ ok: true, status: 204 } as any);

    const result = await checkHealth();

    expect(result.status).toBe('degraded');
    expect(result.checks.watchlist.ok).toBe(false);
  });

  it('should return degraded when Algorand probe fails', async () => {
    // Mock Supabase passing
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 } as any);

    // Mock Watchlist passing
    vi.mocked(watchlistUpdater.getState).mockReturnValue({
      totalEntries: 100,
      lastUpdate: '2023-01-01',
      lastUpdateSource: 'mock',
      version: '1',
      running: false,
    });
    vi.mocked(watchlistUpdater.getSummary).mockReturnValue({
      totalEntries: 100,
      lastUpdated: '2023-01-01',
      name: 'mock',
      version: '1',
      source: 'mock',
      cached: true,
    });

    // Mock Algorand failing
    mockFetch.mockResolvedValueOnce({ ok: false, status: 503 } as any);

    const result = await checkHealth();

    expect(result.status).toBe('degraded');
    expect(result.checks.algorand.ok).toBe(false);
    expect(result.checks.algorand.detail).toBe('HTTP 503');
  });

  it('should return degraded when fetch times out (AbortError)', async () => {
    // Mock Supabase throwing AbortError
    const abortError = new Error('abort');
    abortError.name = 'AbortError';
    mockFetch.mockRejectedValueOnce(abortError);

    // Mock Watchlist passing
    vi.mocked(watchlistUpdater.getState).mockReturnValue({
      totalEntries: 100,
      lastUpdate: '2023-01-01',
      lastUpdateSource: 'mock',
      version: '1',
      running: false,
    });
    vi.mocked(watchlistUpdater.getSummary).mockReturnValue({
      totalEntries: 100,
      lastUpdated: '2023-01-01',
      name: 'mock',
      version: '1',
      source: 'mock',
      cached: true,
    });

    // Mock Algorand passing
    mockFetch.mockResolvedValueOnce({ ok: true, status: 204 } as any);

    const result = await checkHealth();

    expect(result.status).toBe('degraded');
    expect(result.checks.supabase.ok).toBe(false);
    expect(result.checks.supabase.detail).toBe('timeout');
  });

  describe('Integration with Hono endpoints', () => {
    it('should return 200 for /health when healthy', async () => {
      // Mock Supabase passing
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 } as any);

      // Mock Watchlist passing
      vi.mocked(watchlistUpdater.getState).mockReturnValue({
        totalEntries: 100,
        lastUpdate: '2023-01-01',
        lastUpdateSource: 'mock',
        version: '1',
        running: false,
      });
      vi.mocked(watchlistUpdater.getSummary).mockReturnValue({
        totalEntries: 100,
        lastUpdated: '2023-01-01',
        name: 'mock',
        version: '1',
        source: 'mock',
        cached: true,
      });

      // Mock Algorand passing
      mockFetch.mockResolvedValueOnce({ ok: true, status: 204 } as any);

      const res = await app.request('/health');
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('healthy');
    });

    it('should return 503 for /api/v1/health when degraded', async () => {
      // Mock Supabase failing
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 } as any);

      // Mock Watchlist passing
      vi.mocked(watchlistUpdater.getState).mockReturnValue({
        totalEntries: 100,
        lastUpdate: '2023-01-01',
        lastUpdateSource: 'mock',
        version: '1',
        running: false,
      });
      vi.mocked(watchlistUpdater.getSummary).mockReturnValue({
        totalEntries: 100,
        lastUpdated: '2023-01-01',
        name: 'mock',
        version: '1',
        source: 'mock',
        cached: true,
      });

      // Mock Algorand passing
      mockFetch.mockResolvedValueOnce({ ok: true, status: 204 } as any);

      const res = await app.request('/api/v1/health');
      expect(res.status).toBe(503);
      const data = await res.json();
      expect(data.status).toBe('degraded');
    });
  });
});
