/**
 * In-memory OTP store for testing.
 * Production uses Supabase; this stores OTP hashes locally.
 */

import { VerificationAttempt } from "./types.js";
import bcrypt from "bcryptjs";

export class InMemoryAttemptStore {
  private attempts = new Map<string, VerificationAttempt>();

  async createAttempt(
    attempt: Omit<VerificationAttempt, "id">
  ): Promise<VerificationAttempt> {
    const id = crypto.randomUUID();
    const fullAttempt = { id, ...attempt };
    this.attempts.set(id, fullAttempt);
    return fullAttempt;
  }

  async getAttempt(id: string): Promise<VerificationAttempt | null> {
    const attempt = this.attempts.get(id);
    if (!attempt) return null;
    if (attempt.expiresAt <= Date.now()) {
      this.attempts.delete(id);
      return null;
    }
    return attempt;
  }

  async incrementAttempt(id: string): Promise<VerificationAttempt | null> {
    const attempt = this.attempts.get(id);
    if (!attempt) return null;
    attempt.attemptCount += 1;
    this.attempts.set(id, attempt);
    return attempt;
  }

  async deleteAttempt(id: string): Promise<void> {
    this.attempts.delete(id);
  }

  async cleanupExpired(): Promise<number> {
    let count = 0;
    for (const [id, attempt] of this.attempts) {
      if (attempt.expiresAt <= Date.now()) {
        this.attempts.delete(id);
        count++;
      }
    }
    return count;
  }

  async getRecentAttemptCount(identifier: string): Promise<number> {
    const oneHourAgo = Date.now() - 3600000;
    let count = 0;
    for (const attempt of this.attempts.values()) {
      if (attempt.identifier === identifier && attempt.createdAt >= oneHourAgo) {
        count++;
      }
    }
    return count;
  }

  // Test helpers
  getAll(): Map<string, VerificationAttempt> {
    return new Map(this.attempts);
  }

  size(): number {
    return this.attempts.size;
  }
}
