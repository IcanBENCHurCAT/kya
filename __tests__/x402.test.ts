import { describe, it, expect, beforeEach } from 'vitest';
import { app } from '../src/app.js';
import { resetX402Receipts } from '../src/middleware/x402.js';

describe('x402 Payment Gate Middleware', () => {
  beforeEach(() => {
    resetX402Receipts();
  });

  describe('HTTP 402 Challenge Outputs', () => {
    it('should return HTTP 402 Payment Required when X-Payment header is missing', async () => {
      const res = await app.request('/api/v1/karma/SOME_AGENT');
      expect(res.status).toBe(402);
      const json = await res.json();
      expect(json.error).toBe('Payment Required');
      expect(json.paymentOffer).toBeDefined();
      expect(json.paymentOffer.priceMicroAlgo).toBe(1000);
      expect(json.paymentOffer.receiverAddress).toBeDefined();
      expect(json.paymentOffer.expiresInSeconds).toBe(300);
    });
  });

  describe('Exempt Path Filtering', () => {
    it('should bypass payment challenge for /health', async () => {
      const res = await app.request('/health');
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe('ok');
    });

    it('should bypass payment challenge for /api/v1/health', async () => {
      const res = await app.request('/api/v1/health');
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe('ok');
    });
  });

  describe('Payment Verification & Receipts', () => {
    it('should pass through gated routes and attach X-Payment-Receipt when X-Payment is valid', async () => {
      const res = await app.request('/api/v1/karma/AGENT_VERIFIED_123', {
        headers: {
          'X-Payment': 'tx_valid_verification_1001',
        },
      });

      expect(res.status).toBe(200);
      expect(res.headers.get('X-Payment-Receipt')).toContain('receipt_tx_valid_verification_1001');
    });
  });

  describe('Replay Protection', () => {
    it('should reject duplicate transaction ID with HTTP 400 Bad Request', async () => {
      const txid = 'tx_replay_test_9999';

      // First request should succeed
      const res1 = await app.request('/api/v1/karma/AGENT_REPLAY_TEST', {
        headers: {
          'X-Payment': txid,
        },
      });
      expect(res1.status).toBe(200);

      // Second request with same txid should be rejected
      const res2 = await app.request('/api/v1/karma/AGENT_REPLAY_TEST', {
        headers: {
          'X-Payment': txid,
        },
      });
      expect(res2.status).toBe(400);
      const json2 = await res2.json();
      expect(json2.error).toBe('Bad Request');
      expect(json2.message).toContain('already redeemed');
    });
  });
});
