/**
 * Simple test runner using tsx for the Human Verification service.
 * Runs all tests sequentially and reports pass/fail.
 */

import { randomInt } from "node:crypto";
import * as path from "node:path";
import * as fs from "node:fs";

// ---- Resolve module paths (tsx can't resolve .js→.ts in subpaths) ----
const __filename = new URL(import.meta.url).pathname;
const __dirname = path.dirname(__filename);
const resolve = (seg: string) => path.resolve(__dirname, seg);

// Dynamically import source modules — tsx resolves .ts from .js imports
const { InMemoryAttemptStore } = await import(resolve("../src/verification/in-memory-store.ts"));
const { ClaimStore } = await import(resolve("../src/verification/claim-store.ts"));
const { EmailVerificationProvider } = await import(resolve("../src/verification/providers/email-provider.ts"));
const { ProviderRegistry } = await import(resolve("../src/verification/provider-registry.ts"));
const { VerificationService } = await import(resolve("../src/verification/service.ts"));
const { generateSigningKey, signClaim, verifyClaimSignature, verifyAndSignClaim } = await import(resolve("../src/utils/crypto.ts"));
const bcrypt = await import("bcryptjs");
const { VerificationProvider } = await import(resolve("../src/verification/types.ts"));

// ---- Test framework (minimal) ----
let passed = 0;
let failed = 0;
let total = 0;
let suiteName = "";

function suite(name: string, fn: () => void | Promise<void>) {
  suiteName = name;
  console.log(`\n📦 ${name}`);
  return fn();
}

async function it(name: string, fn: () => void | Promise<void>) {
  total++;
  try {
    await fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err: any) {
    failed++;
    console.log(`  ❌ ${name}`);
    console.log(`     → ${err.message || err}`);
  }
}

function expect<T>(actual: T) {
  return {
    toBe(expected: T) {
      if (actual !== expected) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      }
    },
    toBeNull() {
      if (actual !== null && actual !== undefined) {
        throw new Error(`Expected null, got ${JSON.stringify(actual)}`);
      }
    },
    toHaveLength(len: number) {
      if (actual?.length !== len) {
        throw new Error(`Expected length ${len}, got ${actual?.length}`);
      }
    },
    toContain(val: any) {
      if (!(actual as any)?.includes?.(val)) {
        throw new Error(`Expected ${JSON.stringify(actual)} to contain ${JSON.stringify(val)}`);
      }
    },
    toMatch(re: RegExp) {
      const str = actual?.toString?.() ?? String(actual);
      if (!re.test(str)) {
        throw new Error(`Expected ${JSON.stringify(str)} to match ${re}`);
      }
    },
    toThrow(msg?: string) {
      throw new Error("expect(...).toThrow() must wrap a function call");
    },
  };
}

async function throwsAsync(fn: () => Promise<any>, msg?: string) {
  try {
    await fn();
    throw new Error("Expected function to throw but it didn't");
  } catch (err: any) {
    if (msg && !err.message.includes(msg)) {
      throw new Error(`Expected error containing "${msg}", got: ${err.message}`);
    }
  }
}

// ---- Fix expect.toThrow for async ----
const originalToThrow = expect(null as any).toThrow;
function asyncThrows(fn: () => Promise<any>, msg?: string) {
  total++;
  return fn()
    .then(() => {
      failed++;
      console.log(`  ❌ should have thrown${msg ? ` (${msg})` : ""}`);
    })
    .catch((err: any) => {
      if (msg && !err.message.includes(msg)) {
        failed++;
        console.log(`  ❌ should have thrown "${msg}"`);
        console.log(`     → got: ${err.message}`);
      } else {
        passed++;
        console.log(`  ✅ throws ${msg || "(error)"}`);
      }
    });
}

// ---- Generate a signing key for all tests ----
let testSigningKey: string;
let testPublicKey: string;
const testKeyId = "test-key-1";

console.log("⚙️  Generating test signing key...");
const keys = await generateSigningKey();
testSigningKey = keys.privateKey;
testPublicKey = keys.publicKey;

// ===================================================================
// CRYPTO UTILITIES
// ===================================================================

await suite("Crypto Utilities", async () => {
  await it("generates a valid Ed25519 key pair", async () => {
    const { privateKey, publicKey } = await generateSigningKey();
    expect(privateKey).toBeDefined();
    expect(publicKey).toBeDefined();
    expect(privateKey).toContain("PRIVATE KEY");
    expect(publicKey).toContain("PUBLIC KEY");
  });

  await it("can sign and verify a claim", async () => {
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

  await it("rejects a tampered signature", async () => {
    const { privateKey, publicKey } = await generateSigningKey();
    const { signature } = await signClaim({
      walletAddress: "RPXAZ2345678901234567890123456789012345678901234567890",
      identityHash: "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
      method: "email",
      verifiedAt: 1700000000,
      privateKey,
      keyId: "test-1",
    });
    const isValid = await verifyClaimSignature({
      walletAddress: "INVALID_WALLET",
      identityHash: "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
      verifiedAt: 1700000000,
      signature,
      publicKey,
    });
    expect(isValid).toBe(false);
  });
});

// ===================================================================
// IN-MEMORY ATTEMPT STORE
// ===================================================================

await suite("InMemoryAttemptStore", async () => {
  await it("creates and retrieves an attempt", async () => {
    const store = new InMemoryAttemptStore();
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
    expect(retrieved).toBeDefined();
    expect(retrieved?.identifier).toBe("test@example.com");
    expect(retrieved?.codeHash).toBe("hashed_otp");
  });

  await it("rejects expired attempts", async () => {
    const store = new InMemoryAttemptStore();
    const attempt = await store.createAttempt({
      identifier: "test@example.com",
      method: "email",
      codeHash: "hashed_otp",
      codeSalt: "salt",
      expiresAt: Date.now() - 1000,
      attemptCount: 0,
      maxAttempts: 5,
      createdAt: Date.now(),
    });
    const retrieved = await store.getAttempt(attempt.id);
    expect(retrieved).toBe(null);
  });

  await it("increments attempt count", async () => {
    const store = new InMemoryAttemptStore();
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

  await it("deletes an attempt", async () => {
    const store = new InMemoryAttemptStore();
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
    expect(retrieved).toBe(null);
  });

  await it("cleans up expired attempts", async () => {
    const store = new InMemoryAttemptStore();
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

  await it("counts recent attempts per identifier", async () => {
    const store = new InMemoryAttemptStore();
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

// ===================================================================
// PROVIDER REGISTRY
// ===================================================================

await suite("ProviderRegistry", async () => {
  await it("registers and retrieves a provider", async () => {
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

  await it("throws on duplicate registration", async () => {
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
    try {
      registry.register(mockProvider);
      throw new Error("Expected to throw");
    } catch (err: any) {
      expect(err.message).toContain("already registered");
    }
  });

  await it("resolves default provider when unspecified", async () => {
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

  await it("throws when no provider is registered", async () => {
    const registry = new ProviderRegistry();
    try {
      registry.resolve("phone");
      throw new Error("Expected to throw");
    } catch (err: any) {
      expect(err.message).toContain("No provider");
    }
  });
});

// ===================================================================
// EMAIL VERIFICATION PROVIDER — Full OTP Flow
// ===================================================================

await suite("EmailVerificationProvider", async () => {
  let store: InMemoryAttemptStore;
  let claimStore: ClaimStore;
  let provider: EmailVerificationProvider;
  let sentEmails: { to: string; subject: string; body: string }[];

  function setup() {
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
  }

  beforeEach(() => setup());

  await it("validates email format", async () => {
    try {
      provider.validateIdentifier("not-an-email");
      throw new Error("Expected to throw");
    } catch (err: any) {
      expect(err.message).toContain("Invalid email address");
    }
    expect(() => provider.validateIdentifier("test@example.com")).not.toThrow();
  });

  await it("initiates verification and sends email", async () => {
    const result = await provider.initiateVerification({
      identifier: "test@example.com",
      walletAddress: "RPXAZ2345678901234567890123456789012345678901234567890",
    });
    expect(result.attemptId).toBeDefined();
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0].to).toBe("test@example.com");
    expect(sentEmails[0].subject).toContain("Verify");
    expect(sentEmails[0].body).toMatch(/\d{6}/);
    expect(store.size()).toBe(1);
  });

  await it("completes verification with correct OTP", async () => {
    const initResult = await provider.initiateVerification({
      identifier: "test@example.com",
      walletAddress: "RPXAZ2345678901234567890123456789012345678901234567890",
    });
    const otpMatch = sentEmails[0].body.match(/(\d{6})/);
    expect(otpMatch).not.toBe(null);
    const otp = otpMatch![1];

    const result = await provider.completeVerification({
      attemptId: initResult.attemptId,
      code: otp,
      walletAddress: "RPXAZ2345678901234567890123456789012345678901234567890",
    });
    expect(result.claim).toBeDefined();
    expect(result.claim.walletAddress).toBe("RPXAZ2345678901234567890123456789012345678901234567890");
    expect(result.claim.identityHash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.claim.method).toBe("email");
    expect(result.claim.signature).toMatch(/^[0-9a-f]+$/);
    expect(result.isNew).toBe(true);
    expect(store.size()).toBe(0); // attempt deleted
  });

  await it("rejects incorrect OTP", async () => {
    setup();
    await provider.initiateVerification({
      identifier: "test@example.com",
      walletAddress: "RPXAZ2345678901234567890123456789012345678901234567890",
    });
    const attempts = store.getAll();
    const attempt = attempts.values().next().value as any;
    try {
      await provider.completeVerification({
        attemptId: attempt.id,
        code: "000000",
        walletAddress: "RPXAZ2345678901234567890123456789012345678901234567890",
      });
      throw new Error("Expected to throw");
    } catch (err: any) {
      expect(err.message).toContain("Invalid verification code");
    }
  });

  await it("rejects expired OTP", async () => {
    const storeExp = new InMemoryAttemptStore();
    const claimStoreExp = new ClaimStore("http://localhost:54321", "dummy-key");
    const otp = randomInt(100_000, 999_999).toString();
    const salt = bcrypt.default.genSaltSync(10);
    await storeExp.createAttempt({
      identifier: "expired@example.com",
      method: "email",
      codeHash: bcrypt.hashSync(otp, salt),
      codeSalt: salt,
      expiresAt: Date.now() - 1000,
      attemptCount: 0,
      maxAttempts: 5,
      createdAt: Date.now(),
    });
    const attempt = storeExp.getAll().values().next().value as any;
    const providerExp = new EmailVerificationProvider({
      attemptStore: storeExp,
      claimStore: claimStoreExp,
      privateKey: testSigningKey,
      keyId: testKeyId,
    });
    try {
      await providerExp.completeVerification({
        attemptId: attempt.id,
        code: otp,
        walletAddress: "RPXAZ2345678901234567890123456789012345678901234567890",
      });
      throw new Error("Expected to throw");
    } catch (err: any) {
      expect(err.message).toContain("expired or not found");
    }
  });

  await it("hashes email to identity hash (deterministic)", async () => {
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

    expect(result1.claim.identityHash).toBe(result2.claim.identityHash);
  });

  await it("prevents double verification of same wallet", async () => {
    const walletAddress = "RPXAZ2345678901234567890123456789012345678901234567890";

    await provider.completeVerification({
      attemptId: (await provider.initiateVerification({
        identifier: "test@example.com",
        walletAddress: walletAddress,
      })).attemptId,
      code: sentEmails[sentEmails.length - 1].body.match(/(\d{6})/)![1],
      walletAddress: walletAddress,
    });

    try {
      await provider.completeVerification({
        attemptId: (await provider.initiateVerification({
          identifier: "other@example.com",
          walletAddress: walletAddress,
        })).attemptId,
        code: sentEmails[sentEmails.length - 1].body.match(/(\d{6})/)![1],
        walletAddress: walletAddress,
      });
      throw new Error("Expected to throw");
    } catch (err: any) {
      expect(err.message).toContain("already verified");
    }
  });
});

// ===================================================================
// VERIFICATION SERVICE (ORCHESTRATOR)
// ===================================================================

await suite("VerificationService", async () => {
  let service: VerificationService;
  let sentEmails: { to: string; subject: string; body: string }[];

  function setup() {
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
  }

  beforeEach(() => setup());

  await it("initiates verification flow", async () => {
    const result = await service.initiateVerification({
      email: "test@example.com",
      walletAddress: "RPXAZ2345678901234567890123456789012345678901234567890",
    });
    expect(result.attemptId).toBeDefined();
    expect(sentEmails).toHaveLength(1);
  });

  await it("completes verification flow end-to-end", async () => {
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

  await it("checks wallet verification status", async () => {
    const walletAddress = "RPXAZ2345678901234567890123456789012345678901234567890";
    const before = await service.checkVerification(walletAddress);
    expect(before.isVerified).toBe(false);

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

  await it("lists available methods", async () => {
    const methods = service.getAvailableMethods();
    expect(methods).toContain("email");
  });

  await it("checks identity hash", async () => {
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

// ===================================================================
// SUMMARY
// ===================================================================

console.log(`\n${"=".repeat(50)}`);
console.log(`  Test Results: ${passed}/${total} passed, ${failed} failed`);
console.log(`${"=".repeat(50)}\n`);

process.exit(failed > 0 ? 1 : 0);
