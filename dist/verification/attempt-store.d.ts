/**
 * Verification attempt storage layer.
 *
 * Handles OTP attempts — short-lived records that are deleted immediately
 * after successful verification to ensure no sensitive data persists.
 */
import { VerificationAttempt } from "./types.js";
export declare class AttemptStore {
    private supabase;
    constructor(databaseUrl: string, serviceRoleKey: string);
    /**
     * Store a new verification attempt.
     */
    createAttempt(attempt: Omit<VerificationAttempt, "id">): Promise<VerificationAttempt>;
    /**
     * Get an active attempt by ID.
     * Returns null if not found or expired.
     */
    getAttempt(id: string): Promise<VerificationAttempt | null>;
    /**
     * Increment attempt count.
     * Returns the updated attempt or null if not found.
     */
    incrementAttempt(id: string): Promise<VerificationAttempt | null>;
    /**
     * Delete an attempt record.
     * Called immediately after successful verification.
     */
    deleteAttempt(id: string): Promise<void>;
    /**
     * Delete all expired attempts.
     * Can be called via cron or periodically.
     */
    cleanupExpired(): Promise<number>;
    /**
     * Check rate limit for an identifier.
     * Returns number of attempts made in the last hour.
     */
    getRecentAttemptCount(identifier: string): Promise<number>;
}
