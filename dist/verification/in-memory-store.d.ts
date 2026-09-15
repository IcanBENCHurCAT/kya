/**
 * In-memory OTP store for testing.
 * Production uses Supabase; this stores OTP hashes locally.
 */
import { VerificationAttempt } from "./types.js";
export declare class InMemoryAttemptStore {
    private attempts;
    private byIdentifier;
    createAttempt(attempt: Omit<VerificationAttempt, "id">): Promise<VerificationAttempt>;
    getAttempt(id: string): Promise<VerificationAttempt | null>;
    incrementAttempt(id: string): Promise<VerificationAttempt | null>;
    deleteAttempt(id: string): Promise<void>;
    cleanupExpired(): Promise<number>;
    /**
     * Check rate limit for an identifier.
     * Returns number of attempts made in the last hour.
     *
     * Performance optimization:
     * Uses secondary index `byIdentifier` for O(1) lookup of candidate attempts,
     * replacing the previous O(N) linear scan across all stored verification attempts.
     */
    getRecentAttemptCount(identifier: string): Promise<number>;
    private removeFromIndex;
    getAll(): Map<string, VerificationAttempt>;
    size(): number;
    clear(): void;
}
