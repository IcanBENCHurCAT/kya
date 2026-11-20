import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  KyaApiError,
  KyaClient,
  type A2AHandshakeResponse,
  type KarmaProfileResponse,
  type ScreeningResponse,
} from './index.js';

const BASE_URL = 'https://kya.example.com';
const SAMPLE_ADDRESS = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ';
const TARGET_ADDRESS = 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB555555';

describe('KyaClient', () => {
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

  beforeEach(() => {
    fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('configuration and headers', () => {
    it('normalizes trailing slashes on baseUrl', async () => {
      const karmaPayload: KarmaProfileResponse = {
        success: true,
        karma: {
          agentAddress: SAMPLE_ADDRESS,
          score: 750,
          tier: 'Tier 2',
          totalEvents: 1,
          lastUpdated: '2026-11-20T00:00:00.000Z',
          events: [],
        },
      };

      fetchMock.mockResolvedValue(
        new Response(JSON.stringify(karmaPayload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const client = new KyaClient({ baseUrl: `${BASE_URL}///` });
      await client.getKarma(SAMPLE_ADDRESS);

      expect(fetchMock).toHaveBeenCalledWith(
        `${BASE_URL}/api/v1/karma/${SAMPLE_ADDRESS}`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    });

    it('injects X-Payment header via constructor and setPaymentTxId', async () => {
      const screeningPayload: ScreeningResponse = {
        success: true,
        result: {
          screened: SAMPLE_ADDRESS,
          match: false,
          status: 'NO_MATCH_FOUND',
          confidence: 0,
          details: 'Clear',
        },
      };

      fetchMock.mockImplementation(
        async () =>
          new Response(JSON.stringify(screeningPayload), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
      );

      const client = new KyaClient({
        baseUrl: `${BASE_URL}/`,
        paymentTxId: 'initial-tx-1',
      });
      await client.screenWallet(SAMPLE_ADDRESS);

      expect(fetchMock).toHaveBeenNthCalledWith(1, `${BASE_URL}/api/v1/screen`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Payment': 'initial-tx-1',
        },
        body: JSON.stringify({ address: SAMPLE_ADDRESS, beneficialOwner: undefined }),
      });

      client.setPaymentTxId('updated-tx-2');
      await client.screenWallet(SAMPLE_ADDRESS, 'Acme Agent Corp');

      expect(fetchMock).toHaveBeenNthCalledWith(2, `${BASE_URL}/api/v1/screen`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Payment': 'updated-tx-2',
        },
        body: JSON.stringify({
          address: SAMPLE_ADDRESS,
          beneficialOwner: 'Acme Agent Corp',
        }),
      });
    });
  });

  describe('2xx success responses for all client methods', () => {
    it('getKarma returns KarmaProfileResponse on 200', async () => {
      const expected: KarmaProfileResponse = {
        success: true,
        karma: {
          agentAddress: SAMPLE_ADDRESS,
          score: 820,
          tier: 'Tier 3',
          totalEvents: 2,
          lastUpdated: '2026-11-20T12:00:00.000Z',
          events: [
            {
              id: 'evt-1',
              eventType: 'CREDIT',
              amount: 20,
              reason: 'Completed bounty',
              timestamp: '2026-11-20T12:00:00.000Z',
              txid: 'TX123',
            },
          ],
        },
      };

      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify(expected), { status: 200 })
      );

      const client = new KyaClient({ baseUrl: BASE_URL });
      const result = await client.getKarma(SAMPLE_ADDRESS);

      expect(result).toEqual(expected);
      expect(fetchMock).toHaveBeenCalledWith(
        `${BASE_URL}/api/v1/karma/${SAMPLE_ADDRESS}`,
        { headers: { 'Content-Type': 'application/json' } }
      );
    });

    it('recordKarmaEvent posts payload and returns KarmaProfileResponse on 200', async () => {
      const event = {
        agentAddress: SAMPLE_ADDRESS,
        eventType: 'credit' as const,
        amount: 50,
        reason: 'Verified milestone',
        txid: 'TX_MILESTONE',
      };
      const expected: KarmaProfileResponse = {
        success: true,
        karma: {
          agentAddress: SAMPLE_ADDRESS,
          score: 870,
          tier: 'Tier 3',
          totalEvents: 3,
          lastUpdated: '2026-11-20T12:05:00.000Z',
          events: [],
        },
      };

      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify(expected), { status: 201 })
      );

      const client = new KyaClient({ baseUrl: BASE_URL, paymentTxId: 'pay-1' });
      const result = await client.recordKarmaEvent(event);

      expect(result).toEqual(expected);
      expect(fetchMock).toHaveBeenCalledWith(`${BASE_URL}/api/v1/karma/event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Payment': 'pay-1',
        },
        body: JSON.stringify(event),
      });
    });

    it('executeA2AHandshake returns A2AHandshakeResponse with targetProfile.agentAddress', async () => {
      const request = {
        initiatorAddress: SAMPLE_ADDRESS,
        targetAddress: TARGET_ADDRESS,
        requiredVerificationLevel: 'Tier 2',
        minKarmaScore: 600,
      };
      const expected: A2AHandshakeResponse = {
        success: true,
        decision: 'PROCEED',
        targetProfile: {
          agentAddress: TARGET_ADDRESS,
          karmaScore: 790,
          tier: 'Tier 2',
          sanctionsStatus: 'NO_MATCH_FOUND',
        },
        signature: 'ed25519-sig-abc',
        timestamp: '2026-11-20T12:10:00.000Z',
      };

      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify(expected), { status: 200 })
      );

      const client = new KyaClient({ baseUrl: BASE_URL, paymentTxId: 'pay-2' });
      const result = await client.executeA2AHandshake(request);

      expect(result).toEqual(expected);
      expect(result.targetProfile.agentAddress).toBe(TARGET_ADDRESS);
      expect(fetchMock).toHaveBeenCalledWith(`${BASE_URL}/api/v1/a2a/handshake`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Payment': 'pay-2',
        },
        body: JSON.stringify(request),
      });
    });

    it('submitZKProof posts Groth16 proof payload and returns parsed response', async () => {
      const payload = {
        agentAddress: SAMPLE_ADDRESS,
        proof: {
          pi_a: ['1', '2', '1'],
          pi_b: [
            ['3', '4'],
            ['5', '6'],
          ],
          pi_c: ['7', '8', '1'],
        },
        publicSignals: ['100', '200'],
        claimType: 'KYC_TIER_3',
      };
      const expected = {
        success: true,
        verified: true,
        tier: 'Tier 3',
      };

      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify(expected), { status: 200 })
      );

      const client = new KyaClient({ baseUrl: BASE_URL, paymentTxId: 'pay-3' });
      const result = await client.submitZKProof(payload);

      expect(result).toEqual(expected);
      expect(fetchMock).toHaveBeenCalledWith(`${BASE_URL}/api/v1/verify/zk-proof`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Payment': 'pay-3',
        },
        body: JSON.stringify(payload),
      });
    });

    it('screenWallet posts address and returns ScreeningResponse on 200', async () => {
      const expected: ScreeningResponse = {
        success: true,
        result: {
          screened: TARGET_ADDRESS,
          match: false,
          status: 'NO_MATCH_FOUND',
          confidence: 0.01,
          details: 'No sanctions watchlist matches found',
        },
      };

      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify(expected), { status: 200 })
      );

      const client = new KyaClient({ baseUrl: BASE_URL });
      const result = await client.screenWallet(TARGET_ADDRESS);

      expect(result).toEqual(expected);
      expect(fetchMock).toHaveBeenCalledWith(`${BASE_URL}/api/v1/screen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: TARGET_ADDRESS, beneficialOwner: undefined }),
      });
    });
  });

  describe('402 Payment Required error handling', () => {
    it('throws KyaApiError with status 402 and paymentOffer from JSON body', async () => {
      const paymentOffer = {
        priceMicroAlgo: 1000,
        receiverAddress: 'TREASURY_ALGO_ADDR',
        expiresInSeconds: 300,
        tag: 'x402-global-challenge',
        instructions:
          'Submit payment transaction to receiverAddress and include transaction ID in X-Payment header.',
      };
      const body = {
        error: 'Payment Required',
        message: 'This endpoint requires an x402 microALGO payment.',
        paymentOffer,
      };

      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify(body), {
          status: 402,
          statusText: 'Payment Required',
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const client = new KyaClient({ baseUrl: BASE_URL });
      let caught: unknown;
      try {
        await client.getKarma(SAMPLE_ADDRESS);
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(Error);
      expect(caught).toBeInstanceOf(KyaApiError);
      const apiErr = caught as KyaApiError;
      expect(apiErr.name).toBe('KyaApiError');
      expect(apiErr.status).toBe(402);
      expect(apiErr.body).toEqual(body);
      expect(apiErr.paymentDetails).toEqual(paymentOffer);
      expect(apiErr.message).toContain('402');
      expect(apiErr.message).toContain('This endpoint requires an x402 microALGO payment.');
    });

    it('extracts paymentDetails from PAYMENT-REQUIRED JSON header', async () => {
      const headerOffer = {
        priceMicroAlgo: 2500,
        receiverAddress: 'MERCHANT_ADDR',
        network: 'algorand:mainnet',
      };

      fetchMock.mockResolvedValueOnce(
        new Response('', {
          status: 402,
          headers: {
            'PAYMENT-REQUIRED': JSON.stringify(headerOffer),
          },
        })
      );

      const client = new KyaClient({ baseUrl: BASE_URL });
      let caught: unknown;
      try {
        await client.screenWallet(SAMPLE_ADDRESS);
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(KyaApiError);
      const apiErr = caught as KyaApiError;
      expect(apiErr.status).toBe(402);
      expect(apiErr.paymentDetails).toEqual(headerOffer);
      expect(apiErr.message).toContain('402');
      expect(apiErr.message).toContain('Payment Required');
    });

    it('extracts paymentDetails from base64-encoded PAYMENT-REQUIRED header', async () => {
      const headerOffer = {
        x402Version: 2,
        accepts: [{ scheme: 'exact', amount: '1000', payTo: 'RECEIVER_1' }],
      };
      const encoded = Buffer.from(JSON.stringify(headerOffer), 'utf8').toString('base64');

      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Payment Required' }), {
          status: 402,
          headers: {
            'PAYMENT-REQUIRED': encoded,
          },
        })
      );

      const client = new KyaClient({ baseUrl: BASE_URL });
      let caught: unknown;
      try {
        await client.executeA2AHandshake({
          initiatorAddress: SAMPLE_ADDRESS,
          targetAddress: TARGET_ADDRESS,
        });
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(KyaApiError);
      const apiErr = caught as KyaApiError;
      expect(apiErr.status).toBe(402);
      expect(apiErr.paymentDetails).toEqual(headerOffer);
    });

    it('extracts paymentDetails from X-Payment-Required header', async () => {
      const headerOffer = {
        priceMicroAlgo: 500,
        receiverAddress: 'TREASURY_X',
      };

      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'x402 required' }), {
          status: 402,
          headers: {
            'X-Payment-Required': JSON.stringify(headerOffer),
          },
        })
      );

      const client = new KyaClient({ baseUrl: BASE_URL });
      let caught: unknown;
      try {
        await client.recordKarmaEvent({
          agentAddress: SAMPLE_ADDRESS,
          eventType: 'credit',
          amount: 10,
          reason: 'test',
        });
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(KyaApiError);
      const apiErr = caught as KyaApiError;
      expect(apiErr.status).toBe(402);
      expect(apiErr.paymentDetails).toEqual(headerOffer);
    });

    it('extracts paymentDetails from WWW-Authenticate header when no body offer exists', async () => {
      const wwwAuth = 'x402 realm="kya-service", price="1000", address="ALGO_TREASURY"';

      fetchMock.mockResolvedValueOnce(
        new Response('Payment Required', {
          status: 402,
          headers: {
            'WWW-Authenticate': wwwAuth,
          },
        })
      );

      const client = new KyaClient({ baseUrl: BASE_URL });
      let caught: unknown;
      try {
        await client.submitZKProof({
          agentAddress: SAMPLE_ADDRESS,
          proof: { pi_a: [], pi_b: [], pi_c: [] },
          publicSignals: [],
        });
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(KyaApiError);
      const apiErr = caught as KyaApiError;
      expect(apiErr.status).toBe(402);
      expect(apiErr.body).toBe('Payment Required');
      expect(apiErr.paymentDetails).toBe(wwwAuth);
    });
  });

  describe('400, 404, and 500 error handling', () => {
    it('throws KyaApiError on 400 with JSON error body', async () => {
      const errorBody = {
        success: false,
        error: 'Bad Request',
        message: 'Invalid Algorand address format',
      };

      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify(errorBody), {
          status: 400,
          statusText: 'Bad Request',
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const client = new KyaClient({ baseUrl: BASE_URL });
      let caught: unknown;
      try {
        await client.executeA2AHandshake({
          initiatorAddress: 'invalid',
          targetAddress: TARGET_ADDRESS,
        });
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(KyaApiError);
      const apiErr = caught as KyaApiError;
      expect(apiErr.status).toBe(400);
      expect(apiErr.body).toEqual(errorBody);
      expect(apiErr.paymentDetails).toBeUndefined();
      expect(apiErr.message).toContain('400');
      expect(apiErr.message).toContain('Invalid Algorand address format');
    });

    it('throws KyaApiError on 404 with JSON error body', async () => {
      const errorBody = {
        success: false,
        error: 'Agent profile not found',
      };

      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify(errorBody), {
          status: 404,
          statusText: 'Not Found',
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const client = new KyaClient({ baseUrl: BASE_URL });
      let caught: unknown;
      try {
        await client.getKarma(SAMPLE_ADDRESS);
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(KyaApiError);
      const apiErr = caught as KyaApiError;
      expect(apiErr.status).toBe(404);
      expect(apiErr.body).toEqual(errorBody);
      expect(apiErr.message).toContain('404');
      expect(apiErr.message).toContain('Agent profile not found');
    });

    it('throws KyaApiError on 500 with plain-text error body', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response('Upstream Algorand indexer timeout', {
          status: 500,
          statusText: 'Internal Server Error',
          headers: { 'Content-Type': 'text/plain' },
        })
      );

      const client = new KyaClient({ baseUrl: BASE_URL });
      let caught: unknown;
      try {
        await client.screenWallet(SAMPLE_ADDRESS);
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(KyaApiError);
      const apiErr = caught as KyaApiError;
      expect(apiErr.status).toBe(500);
      expect(apiErr.body).toBe('Upstream Algorand indexer timeout');
      expect(apiErr.paymentDetails).toBeUndefined();
      expect(apiErr.message).toContain('500');
      expect(apiErr.message).toContain('Upstream Algorand indexer timeout');
    });

    it('throws KyaApiError on 500 with JSON error body across remaining methods', async () => {
      const errorBody = { error: 'Internal Server Error', message: 'Circuit breaker open' };

      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify(errorBody), { status: 500 })
      );
      const client = new KyaClient({ baseUrl: BASE_URL });

      await expect(
        client.recordKarmaEvent({
          agentAddress: SAMPLE_ADDRESS,
          eventType: 'debit',
          amount: 5,
          reason: 'Penalty',
        })
      ).rejects.toMatchObject({
        name: 'KyaApiError',
        status: 500,
        body: errorBody,
      });

      fetchMock.mockResolvedValueOnce(
        new Response('Verification service crashed', {
          status: 500,
          statusText: 'Internal Server Error',
        })
      );

      await expect(
        client.submitZKProof({
          agentAddress: SAMPLE_ADDRESS,
          proof: { pi_a: [], pi_b: [], pi_c: [] },
          publicSignals: [],
        })
      ).rejects.toMatchObject({
        name: 'KyaApiError',
        status: 500,
        body: 'Verification service crashed',
      });
    });

    it('throws KyaApiError on 500 with empty body using statusText fallback', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response('', {
          status: 500,
          statusText: 'Internal Server Error',
        })
      );

      const client = new KyaClient({ baseUrl: BASE_URL });
      let caught: unknown;
      try {
        await client.getKarma(SAMPLE_ADDRESS);
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(KyaApiError);
      const apiErr = caught as KyaApiError;
      expect(apiErr.status).toBe(500);
      expect(apiErr.body).toBeUndefined();
      expect(apiErr.message).toBe('KYA API request failed (500 Internal Server Error)');
    });
  });
});
