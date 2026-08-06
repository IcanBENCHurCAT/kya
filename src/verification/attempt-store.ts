/**
 * Verification attempt storage layer.
 *
 * Handles OTP attempts — short-lived records that are deleted immediately
 * after successful verification to ensure no sensitive data persists.
 */

import { VerificationAttempt } from "./types.js";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

export class AttemptStore {
  private supabase: SupabaseClient;

  constructor(databaseUrl: string, serviceRoleKey: string) {
    this.supabase = createClient(databaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false },
    });
  }

  /**
   * Store a new verification attempt.
   */
  async createAttempt(
    attempt: Omit<VerificationAttempt, "id">
  ): Promise<VerificationAttempt> {
    const { data, error } = await this.supabase
      .from("verification_attempts")
      .insert({
        identifier: attempt.identifier,
        method: attempt.method,
        code_hash: attempt.codeHash,
        code_salt: attempt.codeSalt,
        expires_at: attempt.expiresAt,
        attempt_count: attempt.attemptCount,
        max_attempts: attempt.maxAttempts,
        created_at: attempt.createdAt,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create attempt: ${error.message}`);
    }

    return {
      id: data.id,
      identifier: data.identifier,
      method: data.method as "email" | "phone",
      codeHash: data.code_hash,
      codeSalt: data.code_salt,
      expiresAt: data.expires_at,
      attemptCount: data.attempt_count,
      maxAttempts: data.max_attempts,
      createdAt: data.created_at,
    };
  }

  /**
   * Get an active attempt by ID.
   * Returns null if not found or expired.
   */
  async getAttempt(id: string): Promise<VerificationAttempt | null> {
    const { data, error } = await this.supabase
      .from("verification_attempts")
      .select()
      .eq("id", id)
      .gt("expires_at", Date.now())
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      identifier: data.identifier,
      method: data.method as "email" | "phone",
      codeHash: data.code_hash,
      codeSalt: data.code_salt,
      expiresAt: data.expires_at,
      attemptCount: data.attempt_count,
      maxAttempts: data.max_attempts,
      createdAt: data.created_at,
    };
  }

  /**
   * Increment attempt count.
   * Returns the updated attempt or null if not found.
   */
  async incrementAttempt(id: string): Promise<VerificationAttempt | null> {
    const { data, error } = await this.supabase
      .from("verification_attempts")
      .update({ attempt_count: { increment: 1 } })
      .eq("id", id)
      .select()
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      identifier: data.identifier,
      method: data.method as "email" | "phone",
      codeHash: data.code_hash,
      codeSalt: data.code_salt,
      expiresAt: data.expires_at,
      attemptCount: data.attempt_count,
      maxAttempts: data.max_attempts,
      createdAt: data.created_at,
    };
  }

  /**
   * Delete an attempt record.
   * Called immediately after successful verification.
   */
  async deleteAttempt(id: string): Promise<void> {
    const { error } = await this.supabase
      .from("verification_attempts")
      .delete()
      .eq("id", id);

    if (error) {
      throw new Error(`Failed to delete attempt: ${error.message}`);
    }
  }

  /**
   * Delete all expired attempts.
   * Can be called via cron or periodically.
   */
  async cleanupExpired(): Promise<number> {
    const { count, error } = await this.supabase
      .from("verification_attempts")
      .delete()
      .lt("expires_at", Date.now())
      .select("count");

    if (error) {
      throw new Error(`Failed to cleanup expired attempts: ${error.message}`);
    }

    return count || 0;
  }

  /**
   * Check rate limit for an identifier.
   * Returns number of attempts made in the last hour.
   */
  async getRecentAttemptCount(identifier: string): Promise<number> {
    const oneHourAgo = Date.now() - 3600000;
    const { count, error } = await this.supabase
      .from("verification_attempts")
      .select("count", { count: "exact" })
      .eq("identifier", identifier)
      .gte("created_at", oneHourAgo);

    if (error) {
      throw new Error(`Rate limit check failed: ${error.message}`);
    }

    return count || 0;
  }
}
