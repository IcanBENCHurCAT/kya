import { describe, it, expect, beforeEach } from "vitest";
import { app } from "../src/app.js";
import { resetX402Receipts } from "../src/middleware/x402.js";

describe("Algorand Wallet Analysis REST API Security Tests", () => {
  beforeEach(() => {
    resetX402Receipts();
  });

  const validAddress =
    "KBWP7FHVYOKPNQOH7X3MLL6BHRK33WUNPHP3ZLY4JWPEGNXLNB3SNPBY6E";
  const invalidAddress = "invalid_algo_address_string";

  describe("Input Validation on :address Parameter", () => {
    it("should return HTTP 400 for invalid address in /api/v1/wallet/:address", async () => {
      const res = await app.request(`/api/v1/wallet/${invalidAddress}`, {
        method: "GET",
        headers: { "X-Payment": "tx_wallet_test_1" },
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Invalid Algorand address format");
    });

    it("should return HTTP 400 for invalid address in /api/v1/wallet/:address/txs", async () => {
      const res = await app.request(`/api/v1/wallet/${invalidAddress}/txs`, {
        method: "GET",
        headers: { "X-Payment": "tx_wallet_test_2" },
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Invalid Algorand address format");
    });

    it("should return HTTP 400 for invalid address in /api/v1/wallet/:address/siblings", async () => {
      const res = await app.request(
        `/api/v1/wallet/${invalidAddress}/siblings`,
        {
          method: "GET",
          headers: { "X-Payment": "tx_wallet_test_3" },
        },
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Invalid Algorand address format");
    });

    it("should return HTTP 400 for invalid address in /api/v1/wallet/:address/graph", async () => {
      const res = await app.request(`/api/v1/wallet/${invalidAddress}/graph`, {
        method: "GET",
        headers: { "X-Payment": "tx_wallet_test_4" },
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Invalid Algorand address format");
    });

    it("should accept valid Algorand address format for /api/v1/wallet/:address/graph", async () => {
      const res = await app.request(`/api/v1/wallet/${validAddress}/graph`, {
        method: "GET",
        headers: { "X-Payment": "tx_wallet_test_5" },
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.address).toBe(validAddress);
    });
  });
});
