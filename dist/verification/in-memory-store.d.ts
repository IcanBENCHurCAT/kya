/**
 * In-memory OTP store for testing.
 * Production uses Supabase; this stores OTP hashes locally.
 */
import { VerificationAttempt } from "./types.js";
export declare class InMemoryAttemptStore {
    private attempts;
    createAttempt(attempt: Omit<VerificationAttempt, "id">): Promise<VerificationAttempt>;
    getAttempt(id: string): Promise<VerificationAttempt | null>;
    incrementAttempt(id: string): Promise<VerificationAttempt | null>;
    deleteAttempt(id: string): Promise<void>;
    cleanupExpired(): Promise<number>;
    getRecentAttemptCount(identifier: string): Promise<number>;
    getAll(): Map<string, VerificationAttempt>;
    size(): number;
}
