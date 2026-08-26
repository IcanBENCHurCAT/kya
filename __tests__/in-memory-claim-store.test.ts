import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryClaimStore } from "../src/verification/in-memory-claim-store.js";
import { VerificationClaim } from "../src/verification/types.js";

describe("InMemoryClaimStore", () => {
  let store: InMemoryClaimStore;

  const sampleClaimInput1 = {
    walletAddress: "WALLETAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    identityHash: "hash111111111111111111111111111111111111111111111111111111111111",
    method: "email" as const,
    verifiedAt: 1000,
    signature: "sig1",
    keyId: "key1",
    attemptId: "att1",
  };

  const sampleClaimInput2 = {
    walletAddress: "WALLETAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    identityHash: "hash111111111111111111111111111111111111111111111111111111111111",
    method: "email" as const,
    verifiedAt: 2000,
    signature: "sig2",
    keyId: "key1",
    attemptId: "att2",
  };

  const sampleClaimInput3 = {
    walletAddress: "WALLETBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
    identityHash: "hash222222222222222222222222222222222222222222222222222222222222",
    method: "phone" as const,
    verifiedAt: 1500,
    signature: "sig3",
    keyId: "key1",
    attemptId: null,
  };

  beforeEach(() => {
    store = new InMemoryClaimStore();
  });

  describe("createClaim", () => {
    it("should create a claim with UUID and timestamps", async () => {
      const claim = await store.createClaim(sampleClaimInput1);

      expect(claim.id).toBeDefined();
      expect(typeof claim.id).toBe("string");
      expect(claim.walletAddress).toBe(sampleClaimInput1.walletAddress);
      expect(claim.identityHash).toBe(sampleClaimInput1.identityHash);
      expect(claim.method).toBe(sampleClaimInput1.method);
      expect(claim.verifiedAt).toBe(sampleClaimInput1.verifiedAt);
      expect(claim.signature).toBe(sampleClaimInput1.signature);
      expect(claim.keyId).toBe(sampleClaimInput1.keyId);
      expect(claim.attemptId).toBe(sampleClaimInput1.attemptId);
      expect(typeof claim.createdAt).toBe("number");
      expect(typeof claim.updatedAt).toBe("number");
      expect(claim.createdAt).toBe(claim.updatedAt);
    });

    it("should increment store size on creation", async () => {
      expect(store.size()).toBe(0);
      await store.createClaim(sampleClaimInput1);
      expect(store.size()).toBe(1);
      await store.createClaim(sampleClaimInput2);
      expect(store.size()).toBe(2);
    });
  });

  describe("findByWallet", () => {
    it("should return null when no claims exist for wallet", async () => {
      const result = await store.findByWallet("NON_EXISTENT_WALLET");
      expect(result).toBeNull();
    });

    it("should return the latest claim sorted by verifiedAt descending", async () => {
      await store.createClaim(sampleClaimInput1); // verifiedAt: 1000
      await store.createClaim(sampleClaimInput2); // verifiedAt: 2000

      const result = await store.findByWallet(sampleClaimInput1.walletAddress);
      expect(result).not.toBeNull();
      expect(result?.verifiedAt).toBe(2000);
      expect(result?.attemptId).toBe("att2");
    });
  });

  describe("findAllForWallet", () => {
    it("should return an empty array when no claims exist for wallet", async () => {
      const results = await store.findAllForWallet("NON_EXISTENT_WALLET");
      expect(results).toEqual([]);
    });

    it("should return all claims for wallet sorted by verifiedAt descending", async () => {
      await store.createClaim(sampleClaimInput1); // verifiedAt: 1000
      await store.createClaim(sampleClaimInput2); // verifiedAt: 2000
      await store.createClaim(sampleClaimInput3); // different wallet

      const results = await store.findAllForWallet(sampleClaimInput1.walletAddress);
      expect(results.length).toBe(2);
      expect(results[0].verifiedAt).toBe(2000);
      expect(results[1].verifiedAt).toBe(1000);
    });
  });

  describe("findByIdentityHash", () => {
    it("should return empty array if identity hash is not found", async () => {
      const results = await store.findByIdentityHash("NON_EXISTENT_HASH");
      expect(results).toEqual([]);
    });

    it("should return all claims for identity hash sorted by verifiedAt descending", async () => {
      await store.createClaim(sampleClaimInput1); // verifiedAt: 1000
      await store.createClaim(sampleClaimInput2); // verifiedAt: 2000
      await store.createClaim(sampleClaimInput3); // different identityHash

      const results = await store.findByIdentityHash(sampleClaimInput1.identityHash);
      expect(results.length).toBe(2);
      expect(results[0].verifiedAt).toBe(2000);
      expect(results[1].verifiedAt).toBe(1000);
    });
  });

  describe("hasClaim & hasIdentityHash", () => {
    it("should accurately report presence of wallet claims", async () => {
      expect(await store.hasClaim(sampleClaimInput1.walletAddress)).toBe(false);
      await store.createClaim(sampleClaimInput1);
      expect(await store.hasClaim(sampleClaimInput1.walletAddress)).toBe(true);
      expect(await store.hasClaim("UNKNOWN_WALLET")).toBe(false);
    });

    it("should accurately report presence of identity hash", async () => {
      expect(await store.hasIdentityHash(sampleClaimInput1.identityHash)).toBe(false);
      await store.createClaim(sampleClaimInput1);
      expect(await store.hasIdentityHash(sampleClaimInput1.identityHash)).toBe(true);
      expect(await store.hasIdentityHash("UNKNOWN_HASH")).toBe(false);
    });
  });

  describe("getClaimCount", () => {
    it("should return correct count of claims for a wallet", async () => {
      expect(await store.getClaimCount(sampleClaimInput1.walletAddress)).toBe(0);
      await store.createClaim(sampleClaimInput1);
      expect(await store.getClaimCount(sampleClaimInput1.walletAddress)).toBe(1);
      await store.createClaim(sampleClaimInput2);
      expect(await store.getClaimCount(sampleClaimInput1.walletAddress)).toBe(2);
      expect(await store.getClaimCount(sampleClaimInput3.walletAddress)).toBe(0);
    });
  });

  describe("getAll, size & clear", () => {
    it("should manage claims collection correctly", async () => {
      const claim1 = await store.createClaim(sampleClaimInput1);
      const claim3 = await store.createClaim(sampleClaimInput3);

      expect(store.size()).toBe(2);
      const allClaims = store.getAll();
      expect(allClaims.length).toBe(2);
      expect(allClaims).toContainEqual(claim1);
      expect(allClaims).toContainEqual(claim3);

      store.clear();
      expect(store.size()).toBe(0);
      expect(store.getAll()).toEqual([]);
    });
  });
});
