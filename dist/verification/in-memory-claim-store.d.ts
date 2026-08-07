/**
 * In-memory claim store for testing.
 * Production uses Supabase; this stores claims locally.
 */
import { VerificationClaim } from "./types.js";
export declare class InMemoryClaimStore {
    private claims;
    createClaim(claim: Omit<VerificationClaim, "id" | "createdAt" | "updatedAt">): Promise<VerificationClaim>;
    findByWallet(walletAddress: string): Promise<VerificationClaim | null>;
    findAllForWallet(walletAddress: string): Promise<VerificationClaim[]>;
    findByIdentityHash(identityHash: string): Promise<VerificationClaim[]>;
    hasClaim(walletAddress: string): Promise<boolean>;
    hasIdentityHash(identityHash: string): Promise<boolean>;
    getClaimCount(walletAddress: string): Promise<number>;
    getAll(): VerificationClaim[];
    size(): number;
    clear(): void;
}
