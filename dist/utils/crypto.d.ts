/**
 * Cryptographic utilities for claim signing and verification.
 *
 * Uses Ed25519 (via jose library) for:
 * - Generating service key pairs for signing claims
 * - Signing claims with the service private key
 * - Verifying claims with the service public key
 */
import { VerificationClaim } from "../verification/types.js";
/**
 * Generate a new Ed25519 key pair for signing claims.
 * Returns PEM-encoded private and public keys.
 */
export declare function generateSigningKey(): Promise<{
    privateKey: string;
    publicKey: string;
}>;
/**
 * Sign a verification claim.
 *
 * The claim is serialized into a deterministic format:
 *   wallet_address | identity_hash | verified_at
 *
 * This is signed with the service private key using Ed25519.
 */
export declare function signClaim(params: {
    walletAddress: string;
    identityHash: string;
    method: string;
    verifiedAt: number;
    privateKey: string;
    keyId: string;
}): Promise<{
    signature: string;
    keyId: string;
    verifiedAt: number;
}>;
/**
 * Verify a verification claim signature.
 */
export declare function verifyClaimSignature(params: {
    walletAddress: string;
    identityHash: string;
    verifiedAt: number;
    signature: string;
    publicKey: string;
}): Promise<boolean>;
/**
 * Create a full signed claim object.
 */
export declare function verifyAndSignClaim(params: {
    walletAddress: string;
    identityHash: string;
    method: string;
    privateKey: string;
    keyId: string;
}): Promise<Omit<VerificationClaim, "id" | "attemptId">>;
/**
 * Verify that an existing claim's signature is valid.
 */
export declare function verifyExistingClaim(claim: VerificationClaim, publicKey?: string): Promise<boolean>;
