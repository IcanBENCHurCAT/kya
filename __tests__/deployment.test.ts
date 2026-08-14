import { describe, it, expect, beforeEach } from 'vitest';
import { app } from '../src/app.js';
import { resetX402Receipts } from '../src/middleware/x402.js';

describe('Phase 4 Deployment & Gateway Ingress Tests', () => {
  beforeEach(() => {
    resetX402Receipts();
  });

  describe('Healthcheck Endpoint Status', () => {
    it('should return HTTP 200 OK for root /health', async () => {
      const res = await app.request('/health');
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('ok');
      expect(data.timestamp).toBeDefined();
      expect(new Date(data.timestamp).toString()).not.toBe('Invalid Date');
    });

    it('should return HTTP 200 OK for /api/v1/health', async () => {
      const res = await app.request('/api/v1/health');
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('ok');
      expect(data.timestamp).toBeDefined();
    });

    it('should allow health checks to bypass x402 payment gate without payment headers', async () => {
      const res = await app.request('/api/v1/health');
      expect(res.status).toBe(200);
      expect(res.headers.get('X-402-Payment-Required')).toBeNull();
    });
  });

  describe('x402 Merchant Metadata & Bazaar Discovery Endpoints', () => {
    it('should serve x402 merchant discovery metadata on /.well-known/x402.json', async () => {
      const res = await app.request('/.well-known/x402.json');
      expect(res.status).toBe(200);
      expect(res.headers.get('Cache-Control')).toContain('public');
      const data = await res.json();
      expect(data.merchant).toBeDefined();
      expect(data.merchant.name).toContain('KYA Service');
      expect(data.resources).toBeInstanceOf(Array);
      expect(data.resources.length).toBeGreaterThan(0);
      expect(data.resources[0].tag).toBe('x402-global-challenge');
    });

    it('should serve agent card metadata on /.well-known/agent-card.json', async () => {
      const res = await app.request('/.well-known/agent-card.json');
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.name).toContain('KYA Service');
      expect(data.skills).toBeInstanceOf(Array);
      expect(data.skills[0].tags).toContain('x402-global-challenge');
    });
  });

  describe('Environment Variable Validation & Defaults', () => {
    it('should validate default PORT environment configuration', () => {
      const port = parseInt(process.env.PORT || '3000', 10);
      expect(port).toBeGreaterThan(0);
      expect(port).toBeLessThanOrEqual(65535);
    });

    it('should validate screening threshold environment variable fallbacks', () => {
      const failThreshold = parseFloat(process.env.SCREENING_FAIL_THRESHOLD || '0.85');
      const flagThreshold = parseFloat(process.env.SCREENING_FLAG_THRESHOLD || '0.50');

      expect(failThreshold).toBeGreaterThan(0);
      expect(failThreshold).toBeLessThanOrEqual(1.0);
      expect(flagThreshold).toBeGreaterThan(0);
      expect(flagThreshold).toBeLessThan(failThreshold);
    });

    it('should default NODE_ENV to test or production safely', () => {
      const env = process.env.NODE_ENV || 'development';
      expect(['development', 'test', 'production']).toContain(env);
    });
  });

  describe('Caddy & x402 Header Forwardings', () => {
    it('should return 402 challenge when accessing protected API without payment header', async () => {
      const res = await app.request('/api/v1/karma/DEPL_AGENT_001', {
        headers: {
          'Host': 'kya-service.duckdns.org',
          'X-Forwarded-Proto': 'https',
          'X-Forwarded-For': '203.0.113.195',
        },
      });

      expect(res.status).toBe(402);
      const body = await res.json();
      expect(body.error).toBe('Payment Required');
      expect(body.paymentOffer).toBeDefined();
      expect(body.paymentOffer.priceMicroAlgo).toBe(1000);
      expect(body.paymentOffer.tag).toBe('x402-global-challenge');
    });

    it('should process reverse-proxy headers (Host, X-Forwarded-For, X-Forwarded-Proto) correctly', async () => {
      const res = await app.request('/api/v1/health', {
        headers: {
          'Host': 'kya-service.duckdns.org',
          'X-Real-IP': '198.51.100.42',
          'X-Forwarded-For': '198.51.100.42',
          'X-Forwarded-Proto': 'https',
        },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe('ok');
    });

    it('should honor X-Payment and return X-Payment-Receipt in response headers when valid', async () => {
      const paymentTx = 'tx_deploy_caddy_test_100';
      const res = await app.request('/api/v1/karma/DEPL_AGENT_002', {
        headers: {
          'Host': 'kya-service.duckdns.org',
          'X-Forwarded-Proto': 'https',
          'X-Payment': paymentTx,
        },
      });

      expect(res.status).toBe(200);
      expect(res.headers.get('X-Payment-Receipt')).toContain(`receipt_${paymentTx}`);
    });
  });
});
