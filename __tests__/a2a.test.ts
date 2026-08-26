import { describe, it, expect, beforeEach } from 'vitest';
import { A2AService } from '../src/services/a2a.js';
import { KarmaService } from '../src/services/karma.js';
import { app } from '../src/app.js';
import { resetX402Receipts } from '../src/middleware/x402.js';

describe('A2A Pre-Flight Handshake & W3C VC Engine', () => {
  let karmaService: KarmaService;
  let a2aService: A2AService;

  beforeEach(() => {
    karmaService = new KarmaService();
    karmaService.clearInMemory();
    a2aService = new A2AService(karmaService);
    resetX402Receipts();
  });

  describe('A2AService Unit Tests', () => {
    it('should return PROCEED decision, W3C VC JSON-LD passport, and signature when Karma >= 600 & sanctions PASS', async () => {
      const targetAddress = 'A2A_TARGET_GOOD_1';

      // Set target karma score to 700 (>= 600)
      await karmaService.recordEvent({
        agentAddress: targetAddress,
        eventType: 'credit',
        amount: 600, // 100 base + 600 = 700 (Tier 2)
        reason: 'SLA Performance',
      });

      const response = await a2aService.executeHandshake({
        initiatorAddress: 'A2A_INITIATOR_1',
        targetAddress,
        minKarmaScore: 600,
      });

      expect(response.decision).toBe('PROCEED');
      expect(response.targetProfile?.karmaScore).toBe(700);
      expect(response.targetProfile?.sanctionsStatus).toBe('NO_MATCH_FOUND');
      expect(response.riskSummary.karmaPass).toBe(true);
      expect(response.riskSummary.noSanctionsMatch).toBe(true);
      expect(response.riskSummary.sanctionsStatus).toBe('NO_MATCH_FOUND');

      // Verify W3C VC structure
      expect(response.verifiableCredential).toBeDefined();
      const vc = response.verifiableCredential!;
      expect(vc['@context']).toContain('https://www.w3.org/2018/credentials/v1');
      expect(vc.type).toContain('VerifiableCredential');
      expect(vc.credentialSubject.agentAddress).toBe(targetAddress);
      expect(vc.credentialSubject.karmaScore).toBe(700);
      expect(vc.credentialSubject.sanctionsStatus).toBe('NO_MATCH_FOUND');
      expect(vc.proof?.type).toBe('Ed25519Signature2020');
      expect(response.signature).toBeDefined();

      // Verify Ed25519 signature validity over passport
      if (response.signature) {
        const isValid = await a2aService.verifyPassportSignature({
          walletAddress: targetAddress,
          identityHash: `karma:700|sanctions:NO_MATCH_FOUND`,
          verifiedAt: Math.floor(new Date(vc.issuanceDate).getTime() / 1000),
          signature: response.signature,
        });
        expect(isValid).toBe(true);
      }
    });

    it('should REJECT handshake when target Karma < 600', async () => {
      const targetAddress = 'A2A_TARGET_LOW_KARMA';

      // Default base karma is 100 (< 600)
      const response = await a2aService.executeHandshake({
        initiatorAddress: 'A2A_INITIATOR_1',
        targetAddress,
        minKarmaScore: 600,
      });

      expect(response.decision).toBe('REJECT');
      expect(response.targetProfile?.karmaScore).toBe(100);
      expect(response.riskSummary.karmaPass).toBe(false);
      expect(response.verifiableCredential).toBeUndefined();
      expect(response.signature).toBeUndefined();
    });

    it('should REJECT handshake when target fails sanctions screening', async () => {
      const targetAddress = 'SANCTIONED_TARGET_1';

      // Boost karma above 600
      await karmaService.recordEvent({
        agentAddress: targetAddress,
        eventType: 'credit',
        amount: 600,
        reason: 'Karma boost',
      });

      // Provide watchlist with sanctioned target
      const mockWatchlist = {
        OFAC: [
          {
            id: 'SANC-001',
            name: 'Sanctioned Entity',
            aliases: [],
            nationalIds: [targetAddress],
            addresses: [],
            program: 'OFAC',
            source: 'OFAC',
          },
        ],
      };

      const response = await a2aService.executeHandshake(
        {
          initiatorAddress: 'A2A_INITIATOR_1',
          targetAddress,
          minKarmaScore: 600,
        },
        mockWatchlist
      );

      expect(response.decision).toBe('REJECT');
      expect(response.targetProfile?.sanctionsStatus).toBe('POTENTIAL_MATCH');
      expect(response.riskSummary.noSanctionsMatch).toBe(false);
    });
  });

  describe('REST Endpoint POST /api/v1/a2a/handshake', () => {
    it('should return HTTP 402 Payment Required if X-Payment header is missing', async () => {
      const res = await app.request('/api/v1/a2a/handshake', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          initiatorAddress: 'INITIATOR_REST',
          targetAddress: 'TARGET_REST',
        }),
      });

      expect(res.status).toBe(402);
      const json = await res.json();
      expect(json.error).toBe('Payment Required');
    });

    it('should process A2A handshake request and return HTTP 200 with X-Payment header', async () => {
      const res = await app.request('/api/v1/a2a/handshake', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Payment': 'tx_a2a_handshake_123',
        },
        body: JSON.stringify({
          initiatorAddress: 'INITIATOR_REST',
          targetAddress: 'TARGET_REST',
          minKarmaScore: 100,
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.decision).toBe('PROCEED');
      expect(json.targetProfile.agentAddress).toBe('TARGET_REST');
      expect(json.verifiableCredential).toBeDefined();
    });

    it('should return HTTP 400 if required fields are missing', async () => {
      const res = await app.request('/api/v1/a2a/handshake', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Payment': 'tx_a2a_handshake_400',
        },
        body: JSON.stringify({
          initiatorAddress: 'INITIATOR_REST',
        }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('initiatorAddress and targetAddress are required');
    });

    it('should handle malformed JSON body gracefully and return HTTP 400', async () => {
      const res = await app.request('/api/v1/a2a/handshake', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Payment': 'tx_a2a_handshake_malformed',
        },
        body: '{ malformed_json: ',
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('initiatorAddress and targetAddress are required');
    });
  });
});
