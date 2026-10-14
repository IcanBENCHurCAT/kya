/**
 * Beneficial Owner Resolution Service
 *
 * Resolves wallet addresses to beneficial owners using identity attestation/verification data.
 * If a human is verified, use that identity; otherwise fall back to address associations.
 *
 * In production, this would connect to:
 * - Supabase (identity attestation/verification database)
 * - Algorand blockchain (wallet ownership, on-chain identity)
 * - External identity attestation providers
 *
 * This implementation provides the interface with in-memory/fallback data for dev/testing.
 */
export interface WalletIdentity {
    walletAddress: string;
    verifiedOwner?: {
        name: string;
        nationality?: string;
        dateOfBirth?: string;
        verifiedAt: string;
        verificationMethod: string;
        verificationId: string;
    };
    altAddresses?: string[];
    lastSeen?: string;
}
export interface ResolutionResult {
    walletAddress: string;
    resolved: boolean;
    beneficialOwner?: {
        name: string;
        nationality?: string;
        dateOfBirth?: string;
        verified: boolean;
        verificationMethod?: string;
    };
    associatedWallets: string[];
    confidence: number;
    notes: string;
    timestamp: string;
}
/**
 * In-memory wallet identity store (dev/testing only).
 * Maximum capacity bounded to prevent memory exhaustion and DoS from unauthenticated registration requests.
 */
export declare const MAX_WALLET_IDENTITIES_CAP = 10000;
/**
 * Clear wallet identities (for testing).
 */
export declare function clearWalletIdentities(): void;
/**
 * Register a wallet-to-owner mapping.
 * Used for seeding test data and simulating identity registration.
 */
export declare function registerWalletIdentity(walletAddress: string, ownerName: string, options?: {
    nationality?: string;
    dateOfBirth?: string;
    verificationMethod?: string;
    altAddresses?: string[];
}): WalletIdentity;
/**
 * Query wallet identity by address.
 */
export declare function resolveWalletIdentity(walletAddress: string): WalletIdentity | null;
/**
 * Check if a wallet has a verified beneficial owner.
 */
export declare function hasVerifiedOwner(walletAddress: string): boolean;
/**
 * Full resolution: wallet → beneficial owner for screening.
 *
 * Priority:
 * 1. If identity-verified identity exists → use that
 * 2. If known address associations exist → check those too
 * 3. Fall back to address itself
 *
 * Returns a ResolutionResult suitable for screening.
 */
export declare function resolveForScreening(walletAddress: string): ResolutionResult;
/**
 * Seed development/test data.
 * Includes some known sanctioned patterns for testing.
 */
export declare function seedTestData(): void;
