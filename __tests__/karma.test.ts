import { describe, it, expect, beforeEach } from 'vitest';
import { KarmaService } from '../src/services/karma.js';
import { app } from '../src/app.js';
import { resetX402Receipts } from '../src/middleware/x402.js';

describe('Karma Ledger & KarmaService', () => {
  let karmaService: KarmaService;

  beforeEach(() => {
    karmaService = new KarmaService();
    karmaService.clearInMemory();
    resetX402Receipts();
  });

  describe('Tier Calculations', () => {
    it('should assign Tier 0 for scores < 300', () => {
      expect(karmaService.calculateTier(0)).toBe('Tier 0 (Unscored)');
      expect(karmaService.calculateTier(100)).toBe('Tier 0 (Unscored)');
      expect(karmaService.calculateTier(299)).toBe('Tier 0 (Unscored)');
    });

    it('should assign Tier 1 for scores 300 - 599', () => {
      expect(karmaService.calculateTier(300)).toBe('Tier 1 (Emerging)');
      expect(karmaService.calculateTier(450)).toBe('Tier 1 (Emerging)');
      expect(karmaService.calculateTier(599)).toBe('Tier 1 (Emerging)');
    });

    it('should assign Tier 2 for scores 600 - 849', () => {
      expect(karmaService.calculateTier(600)).toBe('Tier 2 (Established)');
      expect(karmaService.calculateTier(750)).toBe('Tier 2 (Established)');
      expect(karmaService.calculateTier(849)).toBe('Tier 2 (Established)');
    });

    it('should assign Tier 3 for scores >= 850', () => {
      expect(karmaService.calculateTier(850)).toBe('Tier 3 (Seasoned)');
      expect(karmaService.calculateTier(1000)).toBe('Tier 3 (Seasoned)');
    });
  });

  describe('Profile & Score Management', () => {
    it('should return initial profile for new agent address', async () => {
      const profile = await karmaService.getProfile('TEST_AGENT_ADDRESS_1');
      expect(profile.agentAddress).toBe('TEST_AGENT_ADDRESS_1');
      expect(profile.score).toBe(100);
      expect(profile.tier).toBe('Tier 0 (Unscored)');
      expect(profile.totalEvents).toBe(0);
      expect(profile.events).toEqual([]);
    });

    it('should credit agent score and record event', async () => {
      const record = await karmaService.recordEvent({
        agentAddress: 'TEST_AGENT_ADDRESS_1',
        eventType: 'credit',
        amount: 250,
        reason: 'Completed transaction SLA',
      });

      expect(record.score).toBe(350);
      expect(record.tier).toBe('Tier 1 (Emerging)');
      expect(record.totalEvents).toBe(1);
      expect(record.events.length).toBe(1);
      expect(record.events[0].amount).toBe(250);
      expect(record.events[0].eventType).toBe('credit');
      expect(record.events[0].reason).toBe('Completed transaction SLA');
    });

    it('should debit agent score and enforce non-negative floor', async () => {
      await karmaService.recordEvent({
        agentAddress: 'TEST_AGENT_ADDRESS_2',
        eventType: 'credit',
        amount: 50,
        reason: 'Initial boost',
      });

      const afterDebit = await karmaService.recordEvent({
        agentAddress: 'TEST_AGENT_ADDRESS_2',
        eventType: 'debit',
        amount: 200,
        reason: 'SLA violation',
      });

      expect(afterDebit.score).toBe(0);
      expect(afterDebit.tier).toBe('Tier 0 (Unscored)');
      expect(afterDebit.totalEvents).toBe(2);
    });

    it('should query chronological event history', async () => {
      await karmaService.recordEvent({
        agentAddress: 'AGENT_HISTORY_1',
        eventType: 'credit',
        amount: 100,
        reason: 'Event 1',
      });
      await karmaService.recordEvent({
        agentAddress: 'AGENT_HISTORY_1',
        eventType: 'debit',
        amount: 50,
        reason: 'Event 2',
      });

      const history = await karmaService.getHistory('AGENT_HISTORY_1');
      expect(history.length).toBe(2);
      expect(history[0].reason).toBe('Event 1');
      expect(history[1].reason).toBe('Event 2');
    });

    it('should fallback gracefully to InMemoryKarmaStore when Supabase missing', async () => {
      const service = new KarmaService('https://invalid.supabase.co', 'invalid-key');
      const profile = await service.getProfile('FALLBACK_AGENT');
      expect(profile.score).toBe(100);
      expect(profile.agentAddress).toBe('FALLBACK_AGENT');
    });
  });

  describe('Karma REST Endpoints', () => {
    it('should return HTTP 402 on GET /api/v1/karma/:address when X-Payment is missing', async () => {
      const res = await app.request('/api/v1/karma/TEST_AGENT_REST_1');
      expect(res.status).toBe(402);
      const json = await res.json();
      expect(json.error).toBe('Payment Required');
    });

    it('should retrieve profile on GET /api/v1/karma/:address with valid X-Payment header', async () => {
      const validAddress = 'KBWP7FHVYOKPNQOH7X3MLL6BHRK33WUNPHP3ZLY4JWPEGNXLNB3SNPBY6E';
      const res = await app.request(`/api/v1/karma/${validAddress}`, {
        headers: {
          'X-Payment': 'tx_karma_get_123',
        },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.karma.agentAddress).toBe(validAddress);
      expect(json.score).toBe(100);
    });

    it('should return HTTP 400 on GET /api/v1/karma/:address for invalid address format', async () => {
      const res = await app.request('/api/v1/karma/INVALID_ALGORAND_ADDRESS', {
        headers: {
          'X-Payment': 'tx_karma_get_invalid',
        },
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Invalid Algorand address format');
    });

    it('should record event on POST /api/v1/karma/event with valid X-Payment header', async () => {
      const validAddress = 'KBWP7FHVYOKPNQOH7X3MLL6BHRK33WUNPHP3ZLY4JWPEGNXLNB3SNPBY6E';
      const res = await app.request('/api/v1/karma/event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Payment': 'tx_karma_post_123',
        },
        body: JSON.stringify({
          agentAddress: validAddress,
          eventType: 'credit',
          amount: 500,
          reason: 'Rest event test',
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.score).toBe(600);
      expect(json.tier).toBe('Tier 2 (Established)');
    });

    it('should reject invalid payload on POST /api/v1/karma/event', async () => {
      const res = await app.request('/api/v1/karma/event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Payment': 'tx_karma_invalid_payload_123',
        },
        body: JSON.stringify({
          agentAddress: 'TEST_AGENT_REST_POST',
        }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Invalid parameters');
    });
  });
});
