import { describe, it, expect, beforeEach, vi } from "vitest";
import { Hono } from "hono";
import { app } from "../src/app.js";
import {
  resetX402Receipts,
  getX402Receipts,
  MAX_RECEIPTS_CAP,
  x402PaymentGate,
  verifyPaymentTransaction,
} from "../src/middleware/x402.js";
import { AlgorandClient } from "../src/algorand/client.js";

describe("x402 Payment Gate Middleware", () => {
  beforeEach(() => {
    resetX402Receipts();
  });

  describe("HTTP 402 Challenge Outputs", () => {
    it("should return HTTP 402 Payment Required when X-Payment header is missing", async () => {
      const res = await app.request("/api/v1/karma/SOME_AGENT");
      expect(res.status).toBe(402);
      const json = await res.json();
      expect(json.error).toBe("Payment Required");
      expect(json.paymentOffer).toBeDefined();
      expect(json.paymentOffer.priceMicroAlgo).toBe(1000);
      expect(json.paymentOffer.receiverAddress).toBeDefined();
      expect(json.paymentOffer.expiresInSeconds).toBe(300);
    });
  });

  describe("Exempt Path Filtering", () => {
    it("should bypass payment challenge for /health", async () => {
      const res = await app.request("/health");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe("healthy");
    });

    it("should bypass payment challenge for /api/v1/health", async () => {
      const res = await app.request("/api/v1/health");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe("healthy");
    });
  });

  describe("Payment Verification & Receipts", () => {
    it("should pass through gated routes and attach X-Payment-Receipt when X-Payment is valid", async () => {
      const validAddress =
        "KBWP7FHVYOKPNQOH7X3MLL6BHRK33WUNPHP3ZLY4JWPEGNXLNB3SNPBY6E";
      const res = await app.request(`/api/v1/karma/${validAddress}`, {
        headers: {
          "X-Payment": "tx_valid_verification_1001",
        },
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("X-Payment-Receipt")).toContain(
        "receipt_tx_valid_verification_1001",
      );
    });

    it("should return HTTP 400 when X-Payment header is malformed or exceeds max length", async () => {
      const validAddress =
        "KBWP7FHVYOKPNQOH7X3MLL6BHRK33WUNPHP3ZLY4JWPEGNXLNB3SNPBY6E";

      // Invalid characters
      const res1 = await app.request(`/api/v1/karma/${validAddress}`, {
        headers: {
          "X-Payment": "tx_invalid_<script>alert(1)</script>",
        },
      });
      expect(res1.status).toBe(400);
      const json1 = await res1.json();
      expect(json1.error).toBe("Bad Request");
      expect(json1.message).toBe("Invalid transaction ID format");

      // Exceeds max length of 128 chars
      const res2 = await app.request(`/api/v1/karma/${validAddress}`, {
        headers: {
          "X-Payment": "a".repeat(129),
        },
      });
      expect(res2.status).toBe(400);
      const json2 = await res2.json();
      expect(json2.error).toBe("Bad Request");
      expect(json2.message).toBe("Invalid transaction ID format");
    });
  });

  describe("On-Chain Payment Verification", () => {
    const receiver = "W5IRXJWPSXNUJVSN2MOEJGTDGKUGFKUDVPTR5ZQVMDG5O4KYD5M3QPG3TE";
    const price = 1000;

    it("should return valid result for confirmed, matching payment transaction", async () => {
      const mockClient = {
        getTransactionByID: vi.fn().mockResolvedValue({
          transaction: {
            "confirmed-round": 12345,
            "tx-type": "pay",
            sender: "KBWP7FHVYOKPNQOH7X3MLL6BHRK33WUNPHP3ZLY4JWPEGNXLNB3SNPBY6E",
            "payment-transaction": {
              receiver,
              amount: 1000,
            },
          },
        }),
      } as unknown as AlgorandClient;

      const res = await verifyPaymentTransaction("tx_valid_1", receiver, price, mockClient);
      expect(res.valid).toBe(true);
      expect(res.payerAddress).toBe("KBWP7FHVYOKPNQOH7X3MLL6BHRK33WUNPHP3ZLY4JWPEGNXLNB3SNPBY6E");
    });

    it("should return invalid when transaction is not found on network", async () => {
      const mockClient = {
        getTransactionByID: vi.fn().mockResolvedValue(null),
      } as unknown as AlgorandClient;

      const res = await verifyPaymentTransaction("tx_missing", receiver, price, mockClient);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("Transaction not found");
    });

    it("should return invalid when transaction is unconfirmed", async () => {
      const mockClient = {
        getTransactionByID: vi.fn().mockResolvedValue({
          transaction: {
            "confirmed-round": 0,
            "tx-type": "pay",
            sender: "KBWP7FHVYOKPNQOH7X3MLL6BHRK33WUNPHP3ZLY4JWPEGNXLNB3SNPBY6E",
            "payment-transaction": { receiver, amount: 1000 },
          },
        }),
      } as unknown as AlgorandClient;

      const res = await verifyPaymentTransaction("tx_unconfirmed", receiver, price, mockClient);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("not confirmed");
    });

    it("should return invalid when transaction type is not 'pay'", async () => {
      const mockClient = {
        getTransactionByID: vi.fn().mockResolvedValue({
          transaction: {
            "confirmed-round": 123,
            "tx-type": "appl",
            sender: "KBWP7FHVYOKPNQOH7X3MLL6BHRK33WUNPHP3ZLY4JWPEGNXLNB3SNPBY6E",
          },
        }),
      } as unknown as AlgorandClient;

      const res = await verifyPaymentTransaction("tx_appl", receiver, price, mockClient);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("Invalid transaction type 'appl'");
    });

    it("should return invalid when receiver address does not match", async () => {
      const mockClient = {
        getTransactionByID: vi.fn().mockResolvedValue({
          transaction: {
            "confirmed-round": 123,
            "tx-type": "pay",
            sender: "KBWP7FHVYOKPNQOH7X3MLL6BHRK33WUNPHP3ZLY4JWPEGNXLNB3SNPBY6E",
            "payment-transaction": {
              receiver: "WRONG_RECEIVER_ADDRESS_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
              amount: 1000,
            },
          },
        }),
      } as unknown as AlgorandClient;

      const res = await verifyPaymentTransaction("tx_wrong_rcv", receiver, price, mockClient);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("Transaction receiver");
    });

    it("should return invalid when payment amount is less than required price", async () => {
      const mockClient = {
        getTransactionByID: vi.fn().mockResolvedValue({
          transaction: {
            "confirmed-round": 123,
            "tx-type": "pay",
            sender: "KBWP7FHVYOKPNQOH7X3MLL6BHRK33WUNPHP3ZLY4JWPEGNXLNB3SNPBY6E",
            "payment-transaction": {
              receiver,
              amount: 500, // required is 1000
            },
          },
        }),
      } as unknown as AlgorandClient;

      const res = await verifyPaymentTransaction("tx_low_amt", receiver, price, mockClient);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("less than required");
    });

    it("should handle indexer exception gracefully", async () => {
      const mockClient = {
        getTransactionByID: vi.fn().mockRejectedValue(new Error("Indexer timeout")),
      } as unknown as AlgorandClient;

      const res = await verifyPaymentTransaction("tx_err", receiver, price, mockClient);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("Indexer timeout");
    });

    it("should enforce on-chain verification in x402PaymentGate when client provided", async () => {
      const mockClient = {
        getTransactionByID: vi.fn().mockResolvedValue({
          transaction: {
            "confirmed-round": 100,
            "tx-type": "pay",
            sender: "SENDER_ADDRESS",
            "payment-transaction": {
              receiver,
              amount: 1000,
            },
          },
        }),
      } as unknown as AlgorandClient;

      const gatedApp = new Hono();
      gatedApp.use(
        "/api/*",
        x402PaymentGate({
          priceMicroAlgo: 1000,
          receiverAddress: receiver,
          algorandClient: mockClient,
        })
      );
      gatedApp.get("/api/data", (c) => c.json({ ok: true }));

      const validRes = await gatedApp.request("/api/data", {
        headers: { "X-Payment": "tx_verified_ok" },
      });
      expect(validRes.status).toBe(200);

      const invalidClient = {
        getTransactionByID: vi.fn().mockResolvedValue(null),
      } as unknown as AlgorandClient;

      const gatedAppFailing = new Hono();
      gatedAppFailing.use(
        "/api/*",
        x402PaymentGate({
          priceMicroAlgo: 1000,
          receiverAddress: receiver,
          algorandClient: invalidClient,
        })
      );
      gatedAppFailing.get("/api/data", (c) => c.json({ ok: true }));

      const invalidRes = await gatedAppFailing.request("/api/data", {
        headers: { "X-Payment": "tx_unverified" },
      });
      expect(invalidRes.status).toBe(402);
      const json = await invalidRes.json();
      expect(json.error).toBe("Payment Required");
      expect(json.message).toContain("Transaction not found");
    });
  });

  describe("Replay Protection", () => {
    it("should reject duplicate transaction ID with HTTP 400 Bad Request", async () => {
      const txid = "tx_replay_test_9999";
      const validAddress =
        "KBWP7FHVYOKPNQOH7X3MLL6BHRK33WUNPHP3ZLY4JWPEGNXLNB3SNPBY6E";

      // First request should succeed
      const res1 = await app.request(`/api/v1/karma/${validAddress}`, {
        headers: {
          "X-Payment": txid,
        },
      });
      expect(res1.status).toBe(200);

      // Second request with same txid should be rejected
      const res2 = await app.request(`/api/v1/karma/${validAddress}`, {
        headers: {
          "X-Payment": txid,
        },
      });
      expect(res2.status).toBe(400);
      const json2 = await res2.json();
      expect(json2.error).toBe("Bad Request");
      expect(json2.message).toContain("already redeemed");
    });

    it("should bound receipt cache size and perform FIFO eviction when capacity is reached", async () => {
      const validAddress =
        "KBWP7FHVYOKPNQOH7X3MLL6BHRK33WUNPHP3ZLY4JWPEGNXLNB3SNPBY6E";

      // Fill receipt store up to capacity
      for (let i = 0; i < MAX_RECEIPTS_CAP; i++) {
        const res = await app.request(`/api/v1/karma/${validAddress}`, {
          headers: {
            "X-Payment": `tx_batch_${i}`,
          },
        });
        expect(res.status).toBe(200);
      }

      expect(getX402Receipts().length).toBe(MAX_RECEIPTS_CAP);

      // Overflow by 1 entry to trigger FIFO eviction of tx_batch_0
      const overflowRes = await app.request(`/api/v1/karma/${validAddress}`, {
        headers: {
          "X-Payment": "tx_overflow_entry",
        },
      });
      expect(overflowRes.status).toBe(200);

      // Receipt store size should remain bounded at MAX_RECEIPTS_CAP
      const receipts = getX402Receipts();
      expect(receipts.length).toBe(MAX_RECEIPTS_CAP);
      expect(receipts.some((r) => r.txid === "tx_batch_0")).toBe(false);
      expect(receipts.some((r) => r.txid === "tx_overflow_entry")).toBe(true);
    });
  });
});
