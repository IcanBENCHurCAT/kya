import { describe, it, expect, beforeEach } from 'vitest';
import { ZKPVerifierService } from '../src/services/zkp.js';
import { KarmaService } from '../src/services/karma.js';
import { app } from '../src/app.js';
import { resetX402Receipts } from '../src/middleware/x402.js';

describe('Groth16 ZK-KYC Proof Verifier & REST Routes', () => {
  let karmaService: KarmaService;
  let zkpService: ZKPVerifierService;

  beforeEach(() => {
    karmaService = new KarmaService();
    karmaService.clearInMemory();
    zkpService = new ZKPVerifierService(karmaService);
    resetX402Receipts();
  });

  const validProofPayload = {
    agentAddress: 'ZK_AGENT_ADDRESS_1',
    proof: {
      pi_a: ['0x12345678', '0x87654321'],
      pi_b: [
        ['0x1111', '0x2222'],
        ['0x3333', '0x4444'],
      ],
      pi_c: ['0x5555', '0x6666'],
    },
    publicSignals: ['0x0001', '0x0002'],
    claimType: 'KYC_AGE_18',
  };

  describe('ZKPVerifierService Unit Tests', () => {
    it('should verify valid ZK proof payload and upgrade verification tier via KarmaService', async () => {
      const result = await zkpService.verifyProof(validProofPayload);

      expect(result.valid).toBe(true);
      expect(result.verificationLevel).toBe('Tier 2');
      expect(result.agentAddress).toBe('ZK_AGENT_ADDRESS_1');
      expect(result.timestamp).toBeDefined();

      // Check KarmaService updated agent score (100 base + 150 boost)
      const profile = await karmaService.getProfile('ZK_AGENT_ADDRESS_1');
      expect(profile.score).toBe(250);
      expect(profile.totalEvents).toBe(1);
    });

    it('should reject proof payload with missing public signals', async () => {
      const invalidPayload = {
        ...validProofPayload,
        publicSignals: [],
      };
      const result = await zkpService.verifyProof(invalidPayload);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Missing public signals');
    });

    it('should reject proof payload with corrupt/invalid proof points or signals', async () => {
      const corruptPayload = {
        ...validProofPayload,
        publicSignals: ['invalid'],
      };
      const result = await zkpService.verifyProof(corruptPayload);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid ZK Proof');
    });
  });

  describe('REST Endpoint POST /api/v1/verify/zk-proof', () => {
    it('should return HTTP 402 Payment Required if X-Payment header is missing', async () => {
      const res = await app.request('/api/v1/verify/zk-proof', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validProofPayload),
      });

      expect(res.status).toBe(402);
      const json = await res.json();
      expect(json.error).toBe('Payment Required');
    });

    it('should process valid ZK proof and return HTTP 200 with X-Payment header', async () => {
      const validAddress = 'KBWP7FHVYOKPNQOH7X3MLL6BHRK33WUNPHP3ZLY4JWPEGNXLNB3SNPBY6E';
      const res = await app.request('/api/v1/verify/zk-proof', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Payment': 'tx_zk_proof_123',
        },
        body: JSON.stringify({
          ...validProofPayload,
          agentAddress: validAddress,
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.result.valid).toBe(true);
      expect(json.result.verificationLevel).toBe('Tier 2');
    });

    it('should return HTTP 400 if agentAddress has invalid Algorand address format', async () => {
      const res = await app.request('/api/v1/verify/zk-proof', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Payment': 'tx_zk_proof_invalid_addr',
        },
        body: JSON.stringify({
          ...validProofPayload,
          agentAddress: 'INVALID_ADDRESS',
        }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Invalid Algorand address format');
    });

    it('should return HTTP 400 when invalid ZK proof is submitted', async () => {
      const validAddress = 'KBWP7FHVYOKPNQOH7X3MLL6BHRK33WUNPHP3ZLY4JWPEGNXLNB3SNPBY6E';
      const res = await app.request('/api/v1/verify/zk-proof', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Payment': 'tx_zk_proof_invalid',
        },
        body: JSON.stringify({
          ...validProofPayload,
          agentAddress: validAddress,
          publicSignals: ['0x00'],
        }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('Invalid ZK Proof');
    });
  });
});
