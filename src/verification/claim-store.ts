/**
 * Verification claim storage layer.
 *
 * Claims are off-chain, signed bindings between wallets and verified identities.
 * They are stored in Supabase (PostgreSQL) and never written to any blockchain.
 */

import { VerificationClaim } from "./types.js";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

export class ClaimStore {
  private supabase: SupabaseClient;

  constructor(databaseUrl: string, serviceRoleKey: string) {
    this.supabase = createClient(databaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false },
    });
  }

  /**
   * Store a new verification claim.
   */
  async createClaim(
    claim: Omit<VerificationClaim, "id" | "createdAt" | "updatedAt">
  ): Promise<VerificationClaim> {
    const now = Date.now();
    const { data, error } = await this.supabase
      .from("verification_claims")
      .insert({
        wallet_address: claim.walletAddress,
        identity_hash: claim.identityHash,
        method: claim.method,
        verified_at: claim.verifiedAt,
        signature: claim.signature,
        key_id: claim.keyId,
        attempt_id: claim.attemptId,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create claim: ${error.message}`);
    }

    return {
      id: data.id,
      walletAddress: data.wallet_address,
      identityHash: data.identity_hash,
      method: data.method as VerificationClaim["method"],
      verifiedAt: data.verified_at,
      signature: data.signature,
      keyId: data.key_id,
      attemptId: data.attempt_id,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  /**
   * Find a claim by wallet address.
   */
  async findByWallet(walletAddress: string): Promise<VerificationClaim | null> {
    const { data, error } = await this.supabase
      .from("verification_claims")
      .select()
      .eq("wallet_address", walletAddress)
      .order("verified_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      walletAddress: data.wallet_address,
      identityHash: data.identity_hash,
      method: data.method as VerificationClaim["method"],
      verifiedAt: data.verified_at,
      signature: data.signature,
      keyId: data.key_id,
      attemptId: data.attempt_id,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  /**
   * Find all claims for a wallet.
   */
  async findAllForWallet(
    walletAddress: string
  ): Promise<VerificationClaim[]> {
    const { data, error } = await this.supabase
      .from("verification_claims")
      .select()
      .eq("wallet_address", walletAddress)
      .order("verified_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to find claims: ${error.message}`);
    }

    return (data || []).map((d) => ({
      id: d.id,
      walletAddress: d.wallet_address,
      identityHash: d.identity_hash,
      method: d.method as VerificationClaim["method"],
      verifiedAt: d.verified_at,
      signature: d.signature,
      keyId: d.key_id,
      attemptId: d.attempt_id,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
    }));
  }

  /**
   * Find claims by identity hash.
   * Used to check if the same identity was verified from multiple wallets.
   */
  async findByIdentityHash(
    identityHash: string
  ): Promise<VerificationClaim[]> {
    const { data, error } = await this.supabase
      .from("verification_claims")
      .select()
      .eq("identity_hash", identityHash)
      .order("verified_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to find claims by hash: ${error.message}`);
    }

    return (data || []).map((d) => ({
      id: d.id,
      walletAddress: d.wallet_address,
      identityHash: d.identity_hash,
      method: d.method as VerificationClaim["method"],
      verifiedAt: d.verified_at,
      signature: d.signature,
      keyId: d.key_id,
      attemptId: d.attempt_id,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
    }));
  }

  /**
   * Check if a wallet already has a verification claim.
   */
  async hasClaim(walletAddress: string): Promise<boolean> {
    const { count, error } = await this.supabase
      .from("verification_claims")
      .select("count", { count: "exact" })
      .eq("wallet_address", walletAddress);

    if (error) {
      throw new Error(`Claim check failed: ${error.message}`);
    }

    return (count || 0) > 0;
  }

  /**
   * Check if an identity hash already has a claim.
   */
  async hasIdentityHash(identityHash: string): Promise<boolean> {
    const { count, error } = await this.supabase
      .from("verification_claims")
      .select("count", { count: "exact" })
      .eq("identity_hash", identityHash);

    if (error) {
      throw new Error(`Identity hash check failed: ${error.message}`);
    }

    return (count || 0) > 0;
  }

  /**
   * Get the count of claims for a wallet.
   */
  async getClaimCount(walletAddress: string): Promise<number> {
    const { count, error } = await this.supabase
      .from("verification_claims")
      .select("count", { count: "exact" })
      .eq("wallet_address", walletAddress);

    if (error) {
      throw new Error(`Claim count failed: ${error.message}`);
    }

    return count || 0;
  }
}
