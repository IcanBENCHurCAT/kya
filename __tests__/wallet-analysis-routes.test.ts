import { describe, it, expect, beforeEach, vi } from "vitest";
import { app } from "../src/app.js";
import { resetX402Receipts } from "../src/middleware/x402.js";

describe("Algorand Wallet Analysis REST API Security Tests", () => {
  beforeEach(() => {
    resetX402Receipts();
  });

  const validAddress =
    "KBWP7FHVYOKPNQOH7X3MLL6BHRK33WUNPHP3ZLY4JWPEGNXLNB3SNPBY6E";
  const invalidAddress = "invalid_algo_address_string";
  const overlyLongAddress = "A".repeat(300);

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

    it("should return HTTP 400 for overly long address exceeding max length limit", async () => {
      const res = await app.request(`/api/v1/wallet/${overlyLongAddress}`, {
        method: "GET",
        headers: { "X-Payment": "tx_wallet_test_long_1" },
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Invalid Algorand address format");
    });
  });

  describe("Query Parameter Validation on /api/v1/wallet/:address/txs", () => {
    it("should return HTTP 400 when limit parameter is non-numeric", async () => {
      const res = await app.request(
        `/api/v1/wallet/${validAddress}/txs?limit=abc`,
        {
          method: "GET",
          headers: { "X-Payment": "tx_wallet_test_limit_1" },
        },
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe(
        "Invalid limit parameter: must be a positive integer",
      );
    });

    it("should return HTTP 400 when limit parameter is zero or negative", async () => {
      const res1 = await app.request(
        `/api/v1/wallet/${validAddress}/txs?limit=0`,
        {
          method: "GET",
          headers: { "X-Payment": "tx_wallet_test_limit_2" },
        },
      );
      expect(res1.status).toBe(400);

      const res2 = await app.request(
        `/api/v1/wallet/${validAddress}/txs?limit=-10`,
        {
          method: "GET",
          headers: { "X-Payment": "tx_wallet_test_limit_3" },
        },
      );
      expect(res2.status).toBe(400);
      const json = await res2.json();
      expect(json.error).toBe(
        "Invalid limit parameter: must be a positive integer",
      );
    });

    it("should return HTTP 400 when limit parameter exceeds max length", async () => {
      const longLimit = "9".repeat(300);
      const res = await app.request(
        `/api/v1/wallet/${validAddress}/txs?limit=${longLimit}`,
        {
          method: "GET",
          headers: { "X-Payment": "tx_wallet_test_limit_long" },
        },
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe(
        "Invalid limit parameter: string exceeds maximum length",
      );
    });
  });

  describe("Error Response Sanitization & Unhandled Exception Handling", () => {
    it("should return sanitized generic error message when graph statistics query fails", async () => {
      const { WalletGraph } = await import("../src/graph/walletGraph.js");
      const spy = vi
        .spyOn(WalletGraph.prototype, "getStats")
        .mockImplementationOnce(() => {
          throw new Error(
            "Internal DB connection failed: secret_path=/etc/shadow",
          );
        });

      const res = await app.request("/api/v1/wallet/graph", {
        method: "GET",
        headers: { "X-Payment": "tx_wallet_test_err" },
      });

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toBe("Failed to query wallet graph statistics");
      expect(json.error).not.toContain("secret_path");
      expect(json.error).not.toContain("DB connection failed");

      spy.mockRestore();
    });

    it("should sanitize uncaught route exceptions using global app.onError without leaking sensitive info", async () => {
      const auditModule = await import("../src/services/audit.js");
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const spy = vi
        .spyOn(auditModule, "getAuditSummary")
        .mockImplementationOnce(() => {
          throw new Error("FATAL_SECRET_LEAK_IN_DB: password=supersecret");
        });

      const res = await app.request("/api/v1/api/v1/audit/summary", {
        method: "GET",
        headers: {
          Accept: "application/json",
          "X-Payment": "tx_wallet_test_uncaught_err",
        },
      });

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toBe("Internal Server Error");
      expect(json.message).toBe("An unexpected error occurred while processing your request.");
      expect(JSON.stringify(json)).not.toContain("supersecret");

      spy.mockRestore();
      consoleSpy.mockRestore();
    });
  });
});
