/**
 * Tests for the Human Verification service.
 *
 * Tests cover:
 * - Crypto utilities (key generation, signing, verification)
 * - In-memory attempt store
 * - Email verification provider (full OTP flow)
 * - Provider registry
 * - Verification service orchestrator
 * - HTTP routes (mocked)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import bcrypt from "bcryptjs";
import { VerificationProvider } from "../src/verification/types.js";
import { InMemoryAttemptStore } from "../src/verification/in-memory-store.js";
import { ClaimStore } from "../src/verification/claim-store.js";
import { EmailVerificationProvider } from "../src/verification/providers/email-provider.js";
import { ProviderRegistry } from "../src/verification/provider-registry.js";
import { VerificationService } from "../src/verification/service.js";
import { generateSigningKey, signClaim, verifyClaimSignature } from "../src/utils/crypto.js";

// ---------------------------------------------------------------------------
// Test fixture: generate a signing key for tests
// ---------------------------------------------------------------------------
let testSigningKey: string;
let testPublicKey: string;
let testKeyId = "test-key-1";

beforeEach(async () => {
  const keys = await generateSigningKey();
  testSigningKey = keys.privateKey;
  testPublicKey = keys.publicKey;
});

// ---------------------------------------------------------------------------
// Crypto Utilities
// ---------------------------------------------------------------------------
describe("Crypto Utilities", () => {
  it("generates a valid Ed25519 key pair", async () => {
    const { privateKey, publicKey } = await generateSigningKey();
    expect(privateKey).toBeDefined();
    expect(publicKey).toBeDefined();
    expect(privateKey).toContain("PRIVATE KEY");
    expect(publicKey).toContain("PUBLIC KEY");
  });

  it("can sign and verify a claim", async () => {
    const { privateKey, publicKey } = await generateSigningKey();

    const { signature } = await signClaim({
      walletAddress: "RPXAZ2345678901234567890123456789012345678901234567890",
      identityHash: "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
      method: "email",
      verifiedAt: 1700000000,
      privateKey,
      keyId: "test-1",
    });

    expect(signature).toBeDefined();
    expect(signature.length).toBeGreaterThan(0);

    const isValid = await verifyClaimSignature({
      walletAddress: "RPXAZ2345678901234567890123456789012345678901234567890",
      identityHash: "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
      verifiedAt: 1700000000,
      signature,
      publicKey,
    });

    expect(isValid).toBe(true);
  });

  it("rejects a tampered signature", async () => {
    const { privateKey, publicKey } = await generateSigningKey();

    const { signature } = await signClaim({
      walletAddress: "RPXAZ2345678901234567890123456789012345678901234567890",
      identityHash: "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
      method: "email",
      verifiedAt: 1700000000,
      privateKey,
      keyId: "test-1",
    });

    // Tamper with the wallet address
    const isValid = await verifyClaimSignature({
      walletAddress: "INVALID_WALLET_ADDRESS",
      identityHash: "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
      verifiedAt: 1700000000,
      signature,
      publicKey,
    });

    expect(isValid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// In-Memory Attempt Store
// ---------------------------------------------------------------------------
describe("InMemoryAttemptStore", () => {
  let store: InMemoryAttemptStore;

  beforeEach(() => {
    store = new InMemoryAttemptStore();
  });

  it("creates and retrieves an attempt", async () => {
    const now = Date.now();
    const attempt = await store.createAttempt({
      identifier: "test@example.com",
      method: "email",
      codeHash: "hashed_otp",
      codeSalt: "salt",
      expiresAt: now + 600_000,
      attemptCount: 0,
      maxAttempts: 5,
      createdAt: now,
    });

    const retrieved = await store.getAttempt(attempt.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.identifier).toBe("test@example.com");
    expect(retrieved?.codeHash).toBe("hashed_otp");
  });

  it("rejects expired attempts", async () => {
    const attempt = await store.createAttempt({
      identifier: "test@example.com",
      method: "email",
      codeHash: "hashed_otp",
      codeSalt: "salt",
      expiresAt: Date.now() - 1000, // already expired
      attemptCount: 0,
      maxAttempts: 5,
      createdAt: Date.now(),
    });

    const retrieved = await store.getAttempt(attempt.id);
    expect(retrieved).toBeNull();
  });

  it("increments attempt count", async () => {
    const now = Date.now();
    const attempt = await store.createAttempt({
      identifier: "test@example.com",
      method: "email",
      codeHash: "hashed_otp",
      codeSalt: "salt",
      expiresAt: now + 600_000,
      attemptCount: 0,
      maxAttempts: 5,
      createdAt: now,
    });

    await store.incrementAttempt(attempt.id);
    const updated = await store.getAttempt(attempt.id);

    expect(updated?.attemptCount).toBe(1);
  });

  it("deletes an attempt", async () => {
    const now = Date.now();
    const attempt = await store.createAttempt({
      identifier: "test@example.com",
      method: "email",
      codeHash: "hashed_otp",
      codeSalt: "salt",
      expiresAt: now + 600_000,
      attemptCount: 0,
      maxAttempts: 5,
      createdAt: now,
    });

    await store.deleteAttempt(attempt.id);
    const retrieved = await store.getAttempt(attempt.id);
    expect(retrieved).toBeNull();
  });

  it("cleans up expired attempts", async () => {
    // Create one expired and one valid attempt
    await store.createAttempt({
      identifier: "expired@example.com",
      method: "email",
      codeHash: "hash1",
      codeSalt: "salt1",
      expiresAt: Date.now() - 1000,
      attemptCount: 0,
      maxAttempts: 5,
      createdAt: Date.now(),
    });

    await store.createAttempt({
      identifier: "valid@example.com",
      method: "email",
      codeHash: "hash2",
      codeSalt: "salt2",
      expiresAt: Date.now() + 600_000,
      attemptCount: 0,
      maxAttempts: 5,
      createdAt: Date.now(),
    });

    const count = await store.cleanupExpired();
    expect(count).toBe(1);
    expect(store.size()).toBe(1);
  });

  it("counts recent attempts per identifier", async () => {
    const now = Date.now();
    await store.createAttempt({
      identifier: "test@example.com",
      method: "email",
      codeHash: "hash1",
      codeSalt: "salt1",
      expiresAt: now + 600_000,
      attemptCount: 0,
      maxAttempts: 5,
      createdAt: now,
    });
    await store.createAttempt({
      identifier: "test@example.com",
      method: "email",
      codeHash: "hash2",
      codeSalt: "salt2",
      expiresAt: now + 600_000,
      attemptCount: 0,
      maxAttempts: 5,
      createdAt: now + 1000,
    });

    const count = await store.getRecentAttemptCount("test@example.com");
    expect(count).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Provider Registry
// ---------------------------------------------------------------------------
describe("ProviderRegistry", () => {
  it("registers and retrieves a provider", async () => {
    const registry = new ProviderRegistry();
    const mockProvider = {
      method: "email" as const,
      validateIdentifier: () => {},
      initiateVerification: async () => ({ attemptId: "test" }),
      completeVerification: async () => ({
        claim: { id: "test", walletAddress: "test", identityHash: "test", method: "email", verifiedAt: 0, signature: "sig", keyId: "k1", createdAt: 0, updatedAt: 0 },
        isNew: true,
      }),
    } as VerificationProvider;

    registry.register(mockProvider);
    expect(registry.get("email")).toBe(mockProvider);
    expect(registry.listMethods()).toContain("email");
  });

  it("throws on duplicate registration", () => {
    const registry = new ProviderRegistry();
    const mockProvider = {
      method: "email" as const,
      validateIdentifier: () => {},
      initiateVerification: async () => ({ attemptId: "test" }),
      completeVerification: async () => ({
        claim: { id: "test", walletAddress: "test", identityHash: "test", method: "email", verifiedAt: 0, signature: "sig", keyId: "k1", createdAt: 0, updatedAt: 0 },
        isNew: true,
      }),
    } as VerificationProvider;

    registry.register(mockProvider);
    expect(() => registry.register(mockProvider)).toThrow("already registered");
  });

  it("resolves default provider when method is unspecified", async () => {
    const registry = new ProviderRegistry();
    const mockProvider = {
      method: "email" as const,
      validateIdentifier: () => {},
      initiateVerification: async () => ({ attemptId: "test" }),
      completeVerification: async () => ({
        claim: { id: "test", walletAddress: "test", identityHash: "test", method: "email", verifiedAt: 0, signature: "sig", keyId: "k1", createdAt: 0, updatedAt: 0 },
        isNew: true,
      }),
    } as VerificationProvider;

    registry.setDefault(mockProvider);
    const resolved = registry.resolve();
    expect(resolved).toBe(mockProvider);
  });

  it("throws when no provider is registered for a method", () => {
    const registry = new ProviderRegistry();
    expect(() => registry.resolve("phone")).toThrow("No provider");
  });
});

// ---------------------------------------------------------------------------
// Email Verification Provider — Full Flow
// ---------------------------------------------------------------------------
describe("EmailVerificationProvider", () => {
  let store: InMemoryAttemptStore;
  let claimStore: ClaimStore;
  let provider: EmailVerificationProvider;
  let sentEmails: { to: string; subject: string; body: string }[];

  beforeEach(() => {
    store = new InMemoryAttemptStore();
    claimStore = new ClaimStore("http://localhost:54321", "dummy-key");
    sentEmails = [];

    provider = new EmailVerificationProvider({
      attemptStore: store,
      claimStore,
      privateKey: testSigningKey,
      keyId: testKeyId,
      sendEmail: async (to, subject, body) => {
        sentEmails.push({ to, subject, body });
      },
      otpLength: 6,
      otpTtlMs: 600_000,
      maxAttempts: 5,
    });
  });

  it("validates email format", () => {
    expect(() => provider.validateIdentifier("not-an-email")).toThrow("Invalid email address");
    expect(() => provider.validateIdentifier("test@example.com")).not.toThrow();
  });

  it("initiates verification and sends email", async () => {
    const result = await provider.initiateVerification({
      identifier: "test@example.com",
      walletAddress: "RPXAZ2345678901234567890123456789012345678901234567890",
    });

    expect(result.attemptId).toBeDefined();
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0].to).toBe("test@example.com");
    expect(sentEmails[0].subject).toContain("Verify");
    // Body should contain a 6-digit OTP
    expect(sentEmails[0].body).toMatch(/\d{6}/);

    // Attempt should be stored
    expect(store.size()).toBe(1);
  });

  it("completes verification with correct OTP", async () => {
    // Initiate verification
    const initResult = await provider.initiateVerification({
      identifier: "test@example.com",
      walletAddress: "RPXAZ2345678901234567890123456789012345678901234567890",
    });

    // Extract OTP from email body
    const otpMatch = sentEmails[0].body.match(/(\d{6})/);
    expect(otpMatch).not.toBeNull();
    const otp = otpMatch![1];

    // Complete verification
    const result = await provider.completeVerification({
      attemptId: initResult.attemptId,
      code: otp,
      walletAddress: "RPXAZ2345678901234567890123456789012345678901234567890",
    });

    expect(result.claim).toBeDefined();
    expect(result.claim.walletAddress).toBe("RPXAZ2345678901234567890123456789012345678901234567890");
    expect(result.claim.identityHash).toMatch(/^[0-9a-f]{64}$/); // SHA-256 hex
    expect(result.claim.method).toBe("email");
    expect(result.claim.signature).toMatch(/^[0-9a-f]+$/);
    expect(result.isNew).toBe(true);

    // Attempt should be deleted (privacy)
    expect(store.size()).toBe(0);
  });

  it("rejects incorrect OTP", async () => {
    await provider.initiateVerification({
      identifier: "test@example.com",
      walletAddress: "RPXAZ2345678901234567890123456789012345678901234567890",
    });

    await expect(
      provider.completeVerification({
        attemptId: (await store.getAll())[0].id,
        code: "000000", // Wrong code
        walletAddress: "RPXAZ2345678901234567890123456789012345678901234567890",
      })
    ).rejects.toThrow("Invalid verification code");
  });

  it("rejects expired OTP", async () => {
    // Create an expired attempt manually
    const now = Date.now();
    await store.createAttempt({
      identifier: "expired@example.com",
      method: "email",
      codeHash: bcrypt.hashSync("123456", bcrypt.genSaltSync(10)),
      codeSalt: "salt",
      expiresAt: now - 1000, // expired
      attemptCount: 0,
      maxAttempts: 5,
      createdAt: now,
    });

    const attempt = store.getAll().values().next().value as any;

    await expect(
      provider.completeVerification({
        attemptId: attempt.id,
        code: "123456",
        walletAddress: "RPXAZ2345678901234567890123456789012345678901234567890",
      })
    ).rejects.toThrow("expired or not found");
  });

  it("hashes email to identity hash (deterministic)", async () => {
    // Initiate and complete for same email twice
    const wallet1 = "RPXAZ2345678901234567890123456789012345678901234567890";
    const wallet2 = "RPXAZABCDEFGHIJKLMNOPQRSTUVWXYZ2345678901234567890123";

    const result1 = await provider.completeVerification({
      attemptId: (await provider.initiateVerification({
        identifier: "test@example.com",
        walletAddress: wallet1,
      })).attemptId,
      code: sentEmails[sentEmails.length - 1].body.match(/(\d{6})/)![1],
      walletAddress: wallet1,
    });

    const result2 = await provider.completeVerification({
      attemptId: (await provider.initiateVerification({
        identifier: "test@example.com",
        walletAddress: wallet2,
      })).attemptId,
      code: sentEmails[sentEmails.length - 1].body.match(/(\d{6})/)![1],
      walletAddress: wallet2,
    });

    // Same email → same identity hash
    expect(result1.claim.identityHash).toBe(result2.claim.identityHash);
  });

  it("prevents double verification of same wallet", async () => {
    const walletAddress = "RPXAZ2345678901234567890123456789012345678901234567890";

    // First verification
    await provider.completeVerification({
      attemptId: (await provider.initiateVerification({
        identifier: "test@example.com",
        walletAddress: walletAddress,
      })).attemptId,
      code: sentEmails[sentEmails.length - 1].body.match(/(\d{6})/)![1],
      walletAddress: walletAddress,
    });

    // Second verification attempt should fail
    await expect(
      provider.completeVerification({
        attemptId: (await provider.initiateVerification({
          identifier: "other@example.com",
          walletAddress: walletAddress,
        })).attemptId,
        code: sentEmails[sentEmails.length - 1].body.match(/(\d{6})/)![1],
        walletAddress: walletAddress,
      })
    ).rejects.toThrow("already verified");
  });

  it("enforces rate limiting on attempt count", async () => {
    const walletAddress = "RPXAZ2345678901234567890123456789012345678901234567890";
    const provider5 = new EmailVerificationProvider({
      attemptStore: store,
      claimStore,
      privateKey: testSigningKey,
      keyId: testKeyId,
      sendEmail: async (to, subject, body) => {
        sentEmails.push({ to, subject, body });
      },
      maxAttempts: 3,
    });

    // Exhaust attempts
    for (let i = 0; i < 3; i++) {
      const initResult = await provider5.initiateVerification({
        identifier: "test@example.com",
        walletAddress,
      });
      await expect(
        provider5.completeVerification({
          attemptId: initResult.attemptId,
          code: "000000", // wrong code
          walletAddress,
        })
      ).rejects.toThrow("Invalid verification code");
    }

    // Next attempt should be rate limited
    const initResult = await provider5.initiateVerification({
      identifier: "test@example.com",
      walletAddress,
    });
    await expect(
      provider5.completeVerification({
        attemptId: initResult.attemptId,
        code: "000000",
        walletAddress,
      })
    ).rejects.toThrow("Too many attempts");
  });
});

// ---------------------------------------------------------------------------
// Verification Service (Orchestrator)
// ---------------------------------------------------------------------------
describe("VerificationService", () => {
  let service: VerificationService;
  let sentEmails: { to: string; subject: string; body: string }[];

  beforeEach(() => {
    sentEmails = [];
    service = new VerificationService({
      databaseUrl: "http://localhost:54321",
      serviceRoleKey: "dummy-key",
      privateKey: testSigningKey,
      keyId: testKeyId,
      defaultProvider: new EmailVerificationProvider({
        attemptStore: new InMemoryAttemptStore(),
        claimStore: new ClaimStore("http://localhost:54321", "dummy-key"),
        privateKey: testSigningKey,
        keyId: testKeyId,
        sendEmail: async (to, subject, body) => {
          sentEmails.push({ to, subject, body });
        },
      }),
    });
  });

  it("initiates verification flow", async () => {
    const result = await service.initiateVerification({
      email: "test@example.com",
      walletAddress: "RPXAZ2345678901234567890123456789012345678901234567890",
    });

    expect(result.attemptId).toBeDefined();
    expect(sentEmails).toHaveLength(1);
  });

  it("completes verification flow end-to-end", async () => {
    const walletAddress = "RPXAZ2345678901234567890123456789012345678901234567890";

    const init = await service.initiateVerification({
      email: "test@example.com",
      walletAddress,
    });

    const otp = sentEmails[0].body.match(/(\d{6})/)![1];

    const complete = await service.completeVerification({
      attemptId: init.attemptId,
      code: otp,
      walletAddress,
    });

    expect(complete.claim.walletAddress).toBe(walletAddress);
    expect(complete.claim.identityHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("checks wallet verification status", async () => {
    const walletAddress = "RPXAZ2345678901234567890123456789012345678901234567890";

    // Before verification
    const before = await service.checkVerification(walletAddress);
    expect(before.isVerified).toBe(false);

    // After verification
    const init = await service.initiateVerification({
      email: "test@example.com",
      walletAddress,
    });
    const otp = sentEmails[0].body.match(/(\d{6})/)![1];
    await service.completeVerification({
      attemptId: init.attemptId,
      code: otp,
      walletAddress,
    });

    const after = await service.checkVerification(walletAddress);
    expect(after.isVerified).toBe(true);
    expect(after.claimCount).toBe(1);
  });

  it("lists available methods", () => {
    const methods = service.getAvailableMethods();
    expect(methods).toContain("email");
  });

  it("checks identity hash", async () => {
    const walletAddress = "RPXAZ2345678901234567890123456789012345678901234567890";

    const init = await service.initiateVerification({
      email: "test@example.com",
      walletAddress,
    });
    const otp = sentEmails[0].body.match(/(\d{6})/)![1];
    const complete = await service.completeVerification({
      attemptId: init.attemptId,
      code: otp,
      walletAddress,
    });

    const identityCheck = await service.checkIdentityHash(complete.claim.identityHash);
    expect(identityCheck.found).toBe(true);
    expect(identityCheck.walletAddresses).toContain(walletAddress);
  });
});
