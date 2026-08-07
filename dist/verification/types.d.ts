/**
 * Core type definitions for the Human Verification system.
 *
 * All verification methods produce a `VerificationClaim` — a signed,
 * off-chain binding between a wallet address and a verified identity.
 * The actual email/phone/OAuth identity is never stored in plaintext
 * beyond the verification window.
 *
 * @module types
 */
/** Pluggable verification method identifiers. */
export type VerificationMethod = "email" | "phone" | "oauth";
/**
 * A pending OTP verification attempt.
 * Stored in Supabase with a short TTL; deleted immediately after verification.
 */
export interface VerificationAttempt {
    /** UUID for this attempt */
    id: string;
    /** Email or phone being verified */
    identifier: string;
    /** Verification method */
    method: "email" | "phone";
    /** The OTP code (hashed for storage) */
    codeHash: string;
    /** Salt used for hashing the code */
    codeSalt: string;
    /** When this attempt expires (10 min from creation) */
    expiresAt: number;
    /** How many attempts so far (max 5) */
    attemptCount: number;
    /** Maximum allowed attempts */
    maxAttempts: number;
    /** Created timestamp */
    createdAt: number;
}
/**
 * A verified binding between a wallet and an identity.
 *
 * Structure: [wallet_address, verified_email_hash, verification_timestamp, signature]
 *
 * - wallet_address: The agent's Algorand address (base32)
 * - verified_email_hash: SHA-256 hash of the verified email (hex)
 * - verification_timestamp: Unix epoch seconds when verification completed
 * - signature: Ed25519 signature over the above fields by the service private key
 *
 * The claim is stored off-chain in Supabase. The hash is queryable but the
 * original email is never recoverable.
 */
export interface VerificationClaim {
    /** UUID for this claim */
    id: string;
    /** Wallet address (Algorand base32, 58 chars) */
    walletAddress: string;
    /** SHA-256 hash of verified email/identity (hex string) */
    identityHash: string;
    /** Verification method used ("email", "phone", "oauth") */
    method: VerificationMethod;
    /** Unix epoch seconds when verified */
    verifiedAt: number;
    /** Ed25519 signature (hex string) */
    signature: string;
    /** Service key ID used to sign (for key rotation) */
    keyId: string;
    /** Verification attempt ID (link to deleted attempt) */
    attemptId: string | null;
    /** Created timestamp */
    createdAt: number;
    /** Last updated timestamp */
    updatedAt: number;
}
/**
 * Query result for checking if a wallet has been verified.
 */
export interface VerifiedWalletCheck {
    /** The wallet address queried */
    walletAddress: string;
    /** Whether this wallet has any verification claims */
    isVerified: boolean;
    /** Count of verification claims for this wallet */
    claimCount: number;
    /** Most recent verification method */
    latestMethod: VerificationMethod | null;
    /** Most recent verification timestamp */
    latestVerifiedAt: number | null;
    /** Hash of the most recent verified identity (hex) */
    latestIdentityHash: string | null;
}
/**
 * Query result for checking if an identity hash has been verified.
 */
export interface IdentityHashCheck {
    /** The identity hash queried */
    identityHash: string;
    /** Whether this hash exists in any claim */
    found: boolean;
    /** All wallet addresses associated with this hash */
    walletAddresses: string[];
    /** Total number of claims for this hash */
    claimCount: number;
}
/** Result returned after successful verification. */
export interface VerificationSuccess {
    /** The created claim */
    claim: VerificationClaim;
    /** Whether the claim was created (false if already existed) */
    isNew: boolean;
}
/** Error returned from verification operations. */
export interface VerificationError {
    /** Human-readable error message */
    message: string;
    /** Error code for programmatic handling */
    code: "OTP_EXPIRED" | "OTP_INVALID" | "RATE_LIMITED" | "WALLET_ALREADY_VERIFIED" | "DUPLICATE_IDENTITY" | "SERVICE_ERROR";
    /** HTTP status code */
    status: number;
}
/**
 * Pluggable verification method interface.
 *
 * Implement this interface to add new verification methods
 * (phone OTP, OAuth, etc.) without modifying core logic.
 */
export interface VerificationProvider {
    /**
     * Method identifier (e.g., "email", "phone", "oauth")
     */
    readonly method: VerificationMethod;
    /**
     * Validate that an identifier is valid for this method.
     * Throws on invalid format.
     */
    validateIdentifier(identifier: string): void;
    /**
     * Generate and initiate a verification challenge.
     * For email: generates OTP and triggers send.
     * For phone: generates SMS OTP.
     * For OAuth: returns authorization URL.
     *
     * Returns the attempt ID needed for subsequent verification.
     */
    initiateVerification(params: {
        identifier: string;
        walletAddress: string;
    }): Promise<{
        attemptId: string;
    }>;
    /**
     * Verify the user's challenge response and create a claim.
     * For email: verifies OTP code and returns claim.
     * For phone: verifies SMS OTP code and returns claim.
     * For OAuth: exchanges authorization code and returns claim.
     *
     * This method handles:
     * 1. Hashing the email immediately
     * 2. Deleting the raw attempt
     * 3. Creating the signed claim
     * 4. Returning the result
     */
    completeVerification(params: {
        attemptId: string;
        code: string;
        walletAddress: string;
    }): Promise<VerificationSuccess>;
}
/** Configuration for the verification service. */
export interface VerificationConfig {
    /** Database URL (Supabase) */
    databaseUrl?: string;
    /** JWT service key (for Supabase) */
    serviceRoleKey?: string;
    /** Service private key for signing claims (Ed25519 PEM) */
    privateKey: string;
    /** Key ID for this private key (for key rotation) */
    keyId: string;
    /** OTP code length */
    otpLength?: number;
    /** OTP validity duration in seconds (default: 600 = 10 min) */
    otpTtlMs?: number;
    /** Maximum OTP attempts (default: 5) */
    maxAttempts?: number;
    /** Rate limit: max requests per identifier per hour (default: 10) */
    rateLimitPerHour?: number;
    /** Default verification provider */
    defaultProvider?: VerificationProvider;
    /** Optional test injection: claim store */
    claimStore?: any;
    /** Optional test injection: attempt store */
    attemptStore?: any;
}
