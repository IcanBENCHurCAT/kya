/**
 * Verification claim storage layer.
 *
 * Claims are off-chain, signed bindings between wallets and verified identities.
 * They are stored in Supabase (PostgreSQL) and never written to any blockchain.
 */
import { VerificationClaim } from "./types.js";
export declare class ClaimStore {
    private supabase;
    constructor(databaseUrl: string, serviceRoleKey: string);
    /**
     * Store a new verification claim.
     */
    createClaim(claim: Omit<VerificationClaim, "id" | "createdAt" | "updatedAt">): Promise<VerificationClaim>;
    /**
     * Find a claim by wallet address.
     */
    findByWallet(walletAddress: string): Promise<VerificationClaim | null>;
    /**
     * Find all claims for a wallet.
     */
    findAllForWallet(walletAddress: string): Promise<VerificationClaim[]>;
    /**
     * Find claims by identity hash.
     * Used to check if the same identity was verified from multiple wallets.
     */
    findByIdentityHash(identityHash: string): Promise<VerificationClaim[]>;
    /**
     * Check if a wallet already has a verification claim.
     */
    hasClaim(walletAddress: string): Promise<boolean>;
    /**
     * Check if an identity hash already has a claim.
     */
    hasIdentityHash(identityHash: string): Promise<boolean>;
    /**
     * Get the count of claims for a wallet.
     */
    getClaimCount(walletAddress: string): Promise<number>;
}
