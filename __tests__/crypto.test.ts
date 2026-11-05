import { describe, it, expect } from "vitest";
import {
  generateSigningKey,
  verifyAndSignClaim,
  verifyExistingClaim,
  verifyClaimSignature,
  MAX_KEY_CACHE_CAP,
  getKeyCacheStats,
  clearKeyCache,
} from "../src/utils/crypto.js";
import { VerificationClaim } from "../src/verification/types.js";

describe("Crypto utilities - verifyExistingClaim", () => {
  it("should return true for a validly signed claim with matching public key", async () => {
    const keys = await generateSigningKey();
    const walletAddress = "A".repeat(58);
    const identityHash = "a".repeat(64);

    const signedClaimData = await verifyAndSignClaim({
      walletAddress,
      identityHash,
      method: "email",
      privateKey: keys.privateKey,
      keyId: "test-key-1",
    });

    const fullClaim: VerificationClaim = {
      id: "claim-123",
      attemptId: null,
      ...signedClaimData,
    };

    const isValid = await verifyExistingClaim(fullClaim, keys.publicKey);
    expect(isValid).toBe(true);
  });

  it("should return false if public key is not provided", async () => {
    const keys = await generateSigningKey();
    const walletAddress = "A".repeat(58);
    const identityHash = "a".repeat(64);

    const signedClaimData = await verifyAndSignClaim({
      walletAddress,
      identityHash,
      method: "email",
      privateKey: keys.privateKey,
      keyId: "test-key-1",
    });

    const fullClaim: VerificationClaim = {
      id: "claim-123",
      attemptId: null,
      ...signedClaimData,
    };

    const isValid = await verifyExistingClaim(fullClaim);
    expect(isValid).toBe(false);
  });

  it("should return false if signature is tampered with or invalid", async () => {
    const keys = await generateSigningKey();
    const walletAddress = "A".repeat(58);
    const identityHash = "a".repeat(64);

    const signedClaimData = await verifyAndSignClaim({
      walletAddress,
      identityHash,
      method: "email",
      privateKey: keys.privateKey,
      keyId: "test-key-1",
    });

    const tamperedClaim: VerificationClaim = {
      id: "claim-123",
      attemptId: null,
      ...signedClaimData,
      signature: "1234567890abcdef" + signedClaimData.signature.slice(16),
    };

    const isValid = await verifyExistingClaim(tamperedClaim, keys.publicKey);
    expect(isValid).toBe(false);
  });

  it("should return false if verified against a different public key", async () => {
    const keys1 = await generateSigningKey();
    const keys2 = await generateSigningKey();
    const walletAddress = "A".repeat(58);
    const identityHash = "a".repeat(64);

    const signedClaimData = await verifyAndSignClaim({
      walletAddress,
      identityHash,
      method: "email",
      privateKey: keys1.privateKey,
      keyId: "test-key-1",
    });

    const fullClaim: VerificationClaim = {
      id: "claim-123",
      attemptId: null,
      ...signedClaimData,
    };

    const isValid = await verifyExistingClaim(fullClaim, keys2.publicKey);
    expect(isValid).toBe(false);
  });

  it("should return false gracefully without throwing for malformed or non-string inputs", async () => {
    const keys = await generateSigningKey();

    // Invalid/malformed signature or non-string inputs
    expect(
      await verifyClaimSignature({
        walletAddress: "A".repeat(58),
        identityHash: "a".repeat(64),
        verifiedAt: Date.now(),
        signature: "invalid-non-hex-sig",
        publicKey: keys.publicKey,
      })
    ).toBe(false);

    expect(
      await verifyClaimSignature({
        walletAddress: "A".repeat(58),
        identityHash: "a".repeat(64),
        verifiedAt: Date.now(),
        signature: "",
        publicKey: keys.publicKey,
      })
    ).toBe(false);

    expect(
      await verifyClaimSignature({
        walletAddress: "A".repeat(58),
        identityHash: "a".repeat(64),
        verifiedAt: Date.now(),
        signature: "abcd",
        publicKey: "not-a-valid-pem",
      })
    ).toBe(false);

    expect(
      await verifyClaimSignature(null as any)
    ).toBe(false);

    expect(
      await verifyClaimSignature({
        walletAddress: 123 as any,
        identityHash: "a".repeat(64),
        verifiedAt: Date.now(),
        signature: "abcd",
        publicKey: keys.publicKey,
      })
    ).toBe(false);

    // verifyExistingClaim defensive edge cases
    expect(await verifyExistingClaim(null as any, keys.publicKey)).toBe(false);
    expect(await verifyExistingClaim(undefined as any, keys.publicKey)).toBe(false);
    expect(await verifyExistingClaim({} as any, keys.publicKey)).toBe(false);
    expect(await verifyExistingClaim("not-an-object" as any, keys.publicKey)).toBe(false);
    expect(await verifyExistingClaim({ signature: "abcd" } as any, 123 as any)).toBe(false);
  });

  it("should bound key cache size to MAX_KEY_CACHE_CAP and evict oldest key on overflow", async () => {
    clearKeyCache();
    expect(MAX_KEY_CACHE_CAP).toBe(1000);

    // Populate multiple keys and verify cache bounding logic
    const keysA = await generateSigningKey();
    const keysB = await generateSigningKey();

    const signed = await verifyAndSignClaim({
      walletAddress: "A".repeat(58),
      identityHash: "a".repeat(64),
      method: "email",
      privateKey: keysA.privateKey,
      keyId: "key-a",
    });

    const fullClaim: VerificationClaim = {
      id: "claim-test-cache",
      attemptId: null,
      ...signed,
    };

    expect(await verifyExistingClaim(fullClaim, keysA.publicKey)).toBe(true);
    expect(await verifyExistingClaim(fullClaim, keysB.publicKey)).toBe(false);

    const stats = getKeyCacheStats();
    expect(stats.pkcs8Size).toBeGreaterThan(0);
    expect(stats.spkiSize).toBeGreaterThan(0);
    expect(stats.pkcs8Size).toBeLessThanOrEqual(MAX_KEY_CACHE_CAP);
    expect(stats.spkiSize).toBeLessThanOrEqual(MAX_KEY_CACHE_CAP);
  });
});
