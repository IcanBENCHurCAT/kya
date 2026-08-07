/**
 * Verification Service — Orchestration layer.
 *
 * Coordinates between providers, stores, and rate limiting
 * to provide a unified verification API.
 *
 * This is the main entry point for verification operations:
 * - initiateVerification: Start a verification flow
 * - completeVerification: Complete a verification flow
 * - checkVerification: Query verification status
 * - listVerifications: List all verifications
 */

import { ProviderRegistry } from "./provider-registry.js";
import { VerificationConfig } from "./types.js";
import { VerificationError } from "./types.js";
import { AttemptStore } from "./attempt-store.js";
import { ClaimStore } from "./claim-store.js";
import { InMemoryClaimStore } from "./in-memory-claim-store.js";
import { InMemoryAttemptStore } from "./in-memory-store.js";

export class VerificationService {
  private registry: ProviderRegistry;
  private attemptStore: AttemptStore | InMemoryAttemptStore;
  private claimStore: ClaimStore | InMemoryClaimStore;
  private rateLimitPerHour: number;
  private config: VerificationConfig;

  constructor(config: VerificationConfig) {
    this.config = config;
    this.registry = new ProviderRegistry();

    // Set up stores
    if (config.databaseUrl && config.serviceRoleKey) {
      this.attemptStore = new AttemptStore(
        config.databaseUrl,
        config.serviceRoleKey
      );
      this.claimStore = new ClaimStore(
        config.databaseUrl,
        config.serviceRoleKey
      );
    } else if (config.claimStore) {
      // Test injection: use provided in-memory stores
      this.claimStore = config.claimStore;
      this.attemptStore = config.attemptStore ?? new InMemoryAttemptStore();
    } else {
      // For testing, use in-memory stores
      this.attemptStore = new InMemoryAttemptStore();
      this.claimStore = new InMemoryClaimStore();
    }

    this.rateLimitPerHour = config.rateLimitPerHour ?? 10;

    // Register default provider if provided
    if (config.defaultProvider) {
      this.registry.setDefault(config.defaultProvider);
    }
  }

  /**
   * Register a verification provider.
   */
  registerProvider(provider: { method: string } & Record<string, unknown>): void {
    this.registry.register(provider as any);
  }

  /**
   * Initiate a verification flow.
   *
   * Sends an OTP to the provided email address.
   * Returns an attempt ID needed for completion.
   */
  async initiateVerification({
    email,
    walletAddress,
  }: {
    email: string;
    walletAddress: string;
  }): Promise<{ attemptId: string }> {
    // Resolve provider
    const provider = this.registry.resolve("email");

    // Validate identifier
    provider.validateIdentifier(email);

    // Check rate limit
    const recentCount = await this.attemptStore.getRecentAttemptCount(email);
    if (recentCount >= this.rateLimitPerHour) {
      throw Object.assign(
        new Error(
          `Rate limit exceeded. Maximum ${this.rateLimitPerHour} requests per hour.`
        ),
        {
          code: "RATE_LIMITED" as const,
          status: 429,
        }
      );
    }

    // Delegate to provider (which handles OTP generation and email sending)
    return provider.initiateVerification({ identifier: email, walletAddress });
  }

  /**
   * Complete a verification flow.
   *
   * Verifies the OTP code and creates a signed claim.
   */
  async completeVerification({
    attemptId,
    code,
    walletAddress,
  }: {
    attemptId: string;
    code: string;
    walletAddress: string;
  }): Promise<{ claim: any; isNew: boolean }> {
    const provider = this.registry.resolve("email");
    return provider.completeVerification({ attemptId, code, walletAddress });
  }

  /**
   * Check if a wallet address has been verified.
   */
  async checkVerification(walletAddress: string): Promise<any> {
    const claims = await this.claimStore.findAllForWallet(walletAddress);

    if (claims.length === 0) {
      return {
        walletAddress,
        isVerified: false,
        claimCount: 0,
        latestMethod: null,
        latestVerifiedAt: null,
        latestIdentityHash: null,
      };
    }

    const latest = claims[0];
    return {
      walletAddress,
      isVerified: true,
      claimCount: claims.length,
      latestMethod: latest.method,
      latestVerifiedAt: latest.verifiedAt,
      latestIdentityHash: latest.identityHash,
    };
  }

  /**
   * Check if an identity hash has been verified.
   * Used to detect multi-wallet verification by the same person.
   */
  async checkIdentityHash(identityHash: string): Promise<{
    found: boolean;
    walletAddresses: string[];
    claimCount: number;
  }> {
    const claims = await this.claimStore.findByIdentityHash(identityHash);

    return {
      found: claims.length > 0,
      walletAddresses: claims.map((c) => c.walletAddress),
      claimCount: claims.length,
    };
  }

  /**
   * Get the list of supported verification methods.
   */
  getAvailableMethods(): string[] {
    return this.registry.listMethods();
  }
}
