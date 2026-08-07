/**
 * In-memory claim store for testing.
 * Production uses Supabase; this stores claims locally.
 */

import { VerificationClaim } from "./types.js";

export class InMemoryClaimStore {
  private claims = new Map<string, VerificationClaim>();

  async createClaim(
    claim: Omit<VerificationClaim, "id" | "createdAt" | "updatedAt">
  ): Promise<VerificationClaim> {
    const now = Date.now();
    const fullClaim: VerificationClaim = {
      id: crypto.randomUUID(),
      ...claim,
      createdAt: now,
      updatedAt: now,
    };
    this.claims.set(fullClaim.id, fullClaim);
    return fullClaim;
  }

  async findByWallet(walletAddress: string): Promise<VerificationClaim | null> {
    const walletClaims = Array.from(this.claims.values()).filter(
      (c) => c.walletAddress === walletAddress
    );
    if (walletClaims.length === 0) return null;
    walletClaims.sort((a, b) => b.verifiedAt - a.verifiedAt);
    return walletClaims[0];
  }

  async findAllForWallet(
    walletAddress: string
  ): Promise<VerificationClaim[]> {
    return Array.from(this.claims.values())
      .filter((c) => c.walletAddress === walletAddress)
      .sort((a, b) => b.verifiedAt - a.verifiedAt);
  }

  async findByIdentityHash(identityHash: string): Promise<VerificationClaim[]> {
    return Array.from(this.claims.values())
      .filter((c) => c.identityHash === identityHash)
      .sort((a, b) => b.verifiedAt - a.verifiedAt);
  }

  async hasClaim(walletAddress: string): Promise<boolean> {
    return Array.from(this.claims.values()).some(
      (c) => c.walletAddress === walletAddress
    );
  }

  async hasIdentityHash(identityHash: string): Promise<boolean> {
    return Array.from(this.claims.values()).some(
      (c) => c.identityHash === identityHash
    );
  }

  async getClaimCount(walletAddress: string): Promise<number> {
    return Array.from(this.claims.values()).filter(
      (c) => c.walletAddress === walletAddress
    ).length;
  }

  getAll(): VerificationClaim[] {
    return Array.from(this.claims.values());
  }

  size(): number {
    return this.claims.size;
  }

  clear(): void {
    this.claims.clear();
  }
}
