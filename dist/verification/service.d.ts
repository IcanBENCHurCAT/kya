/**
 * Verification Service — Orchestration layer.
 *
 * Coordinates between providers, stores, and rate limiting
 * to provide a unified verification API.
 *
 * This is the main entry point for verification operations:
 * - initiateVerification: Start a verification flow
 * - completeVerification: Complete a verification flow
 * - checkVerification: Query verification status
 * - listVerifications: List all verifications
 */
import { VerificationConfig } from "./types.js";
export declare class VerificationService {
    private registry;
    private attemptStore;
    private claimStore;
    private rateLimitPerHour;
    private config;
    constructor(config: VerificationConfig);
    /**
     * Register a verification provider.
     */
    registerProvider(provider: {
        method: string;
    } & Record<string, unknown>): void;
    /**
     * Initiate a verification flow.
     *
     * Sends an OTP to the provided email address.
     * Returns an attempt ID needed for completion.
     */
    initiateVerification({ email, walletAddress, }: {
        email: string;
        walletAddress: string;
    }): Promise<{
        attemptId: string;
    }>;
    /**
     * Complete a verification flow.
     *
     * Verifies the OTP code and creates a signed claim.
     */
    completeVerification({ attemptId, code, walletAddress, }: {
        attemptId: string;
        code: string;
        walletAddress: string;
    }): Promise<{
        claim: any;
        isNew: boolean;
    }>;
    /**
     * Check if a wallet address has been verified.
     */
    checkVerification(walletAddress: string): Promise<any>;
    /**
     * Check if an identity hash has been verified.
     * Used to detect multi-wallet verification by the same person.
     */
    checkIdentityHash(identityHash: string): Promise<{
        found: boolean;
        walletAddresses: string[];
        claimCount: number;
    }>;
    /**
     * Get the list of supported verification methods.
     */
    getAvailableMethods(): string[];
}
