/**
 * Email Verification Provider — OTP-based.
 *
 * Implements the VerificationProvider interface for email verification:
 * 1. Generate random OTP
 * 2. Hash and store OTP + salt
 * 3. "Send" email (triggers sendEmail callback)
 * 4. Verify OTP on submit
 *
 * The actual email send is delegated to a callback so the provider
 * remains framework-agnostic (works with nodemailer, SendGrid, etc.)
 */
import { VerificationProvider } from "../types.js";
import { AttemptStore } from "../attempt-store.js";
import { ClaimStore } from "../claim-store.js";
import { InMemoryAttemptStore } from "../in-memory-store.js";
import { VerificationSuccess } from "../types.js";
export interface EmailProviderOptions {
    /** Attempt store for OTP persistence */
    attemptStore: AttemptStore | InMemoryAttemptStore;
    /** Claim store for storing verification results */
    claimStore: ClaimStore;
    /** Service private key for signing (Ed25519 PEM) */
    privateKey: string;
    /** Key ID for key rotation */
    keyId: string;
    /** Function to "send" the OTP email. Implement this to use real email. */
    sendEmail?: (to: string, subject: string, body: string) => Promise<void>;
    /** OTP code length (default: 6) */
    otpLength?: number;
    /** OTP validity in ms (default: 600000 = 10 min) */
    otpTtlMs?: number;
    /** Max OTP attempts (default: 5) */
    maxAttempts?: number;
}
export declare class EmailVerificationProvider implements VerificationProvider {
    readonly method: "email";
    private attemptStore;
    private claimStore;
    private privateKey;
    private keyId;
    private sendEmail;
    private otpLength;
    private otpTtlMs;
    private maxAttempts;
    constructor(options: EmailProviderOptions);
    /**
     * Validate that the identifier looks like an email address.
     */
    validateIdentifier(identifier: string): void;
    /**
     * Generate an OTP and "send" it to the email.
     * Returns attemptId for later verification.
     */
    initiateVerification({ identifier: email, walletAddress, }: {
        identifier: string;
        walletAddress: string;
    }): Promise<{
        attemptId: string;
    }>;
    /**
     * Verify the OTP and create a signed claim.
     *
     * Flow:
     * 1. Look up the attempt
     * 2. Check if expired
     * 3. Increment attempt count (rate limiting)
     * 4. Verify OTP code
     * 5. Hash the email (SHA-256)
     * 6. Delete the raw attempt
     * 7. Check if wallet already verified
     * 8. Check if identity already verified
     * 9. Create signed claim
     */
    completeVerification({ attemptId, code, walletAddress, }: {
        attemptId: string;
        code: string;
        walletAddress: string;
    }): Promise<VerificationSuccess>;
}
