/**
 * In-memory claim store for testing.
 * Production uses Supabase; this stores claims locally.
 */
import { VerificationClaim } from "./types.js";
export declare class InMemoryClaimStore {
    private claims;
    private byWallet;
    private byIdentityHash;
    createClaim(claim: Omit<VerificationClaim, "id" | "createdAt" | "updatedAt">): Promise<VerificationClaim>;
    /**
     * Find the latest verification claim for a wallet address.
     *
     * Performance optimization:
     * Uses a single-pass loop over the wallet claims Set to find the claim with the maximum
     * `verifiedAt` timestamp. Eliminates intermediate `Array.from` allocations and reduces
     * lookup complexity from O(K log K) sorting down to O(K) linear scanning with 0 GC allocations.
     */
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
