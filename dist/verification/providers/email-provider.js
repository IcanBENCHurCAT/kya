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
import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { verifyAndSignClaim } from "../../utils/crypto.js";
export class EmailVerificationProvider {
    method = "email";
    attemptStore;
    claimStore;
    privateKey;
    keyId;
    sendEmail;
    otpLength;
    otpTtlMs;
    maxAttempts;
    constructor(options) {
        this.attemptStore = options.attemptStore;
        this.claimStore = options.claimStore;
        this.privateKey = options.privateKey;
        this.keyId = options.keyId;
        this.otpLength = options.otpLength ?? 6;
        this.otpTtlMs = options.otpTtlMs ?? 600_000; // 10 minutes
        this.maxAttempts = options.maxAttempts ?? 5;
        // Default sendEmail does nothing (for testing/development)
        this.sendEmail =
            options.sendEmail ??
                ((to, subject, body) => {
                    console.log(`[EmailProvider] Would send email to ${to}: ${subject} — ${body}`);
                    return Promise.resolve();
                });
    }
    /**
     * Validate that the identifier looks like an email address.
     */
    validateIdentifier(identifier) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(identifier)) {
            throw new Error(`Invalid email address: ${identifier}`);
        }
    }
    /**
     * Generate an OTP and "send" it to the email.
     * Returns attemptId for later verification.
     */
    async initiateVerification({ identifier: email, walletAddress, }) {
        // 1. Validate email format
        this.validateIdentifier(email);
        // 2. Generate OTP
        const otp = randomInt(100_000, 999_999).toString();
        // 3. Hash OTP with random salt
        const salt = bcrypt.genSaltSync(10);
        const codeHash = bcrypt.hashSync(otp, salt);
        // 4. Store attempt
        const attempt = await this.attemptStore.createAttempt({
            identifier: email,
            method: "email",
            codeHash,
            codeSalt: salt,
            expiresAt: Date.now() + this.otpTtlMs,
            attemptCount: 0,
            maxAttempts: this.maxAttempts,
            createdAt: Date.now(),
        });
        // 5. "Send" email
        const subject = "Verify your AlgoBounty identity";
        const body = `Your verification code is: ${otp}\n\nThis code expires in 10 minutes. Do not share this code with anyone.`;
        await this.sendEmail(email, subject, body);
        return { attemptId: attempt.id };
    }
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
    async completeVerification({ attemptId, code, walletAddress, }) {
        // 1. Look up attempt
        const attempt = await this.attemptStore.getAttempt(attemptId);
        if (!attempt) {
            throw Object.assign(new Error("Verification code expired or not found"), {
                code: "OTP_EXPIRED",
                status: 410,
            });
        }
        // 2. Check max attempts
        if (attempt.attemptCount >= attempt.maxAttempts) {
            throw Object.assign(new Error("Too many attempts. Please request a new code."), {
                code: "RATE_LIMITED",
                status: 429,
            });
        }
        // 3. Increment attempt count
        await this.attemptStore.incrementAttempt(attemptId);
        // 4. Verify OTP
        const valid = bcrypt.compareSync(code, attempt.codeHash);
        if (!valid) {
            throw Object.assign(new Error("Invalid verification code"), {
                code: "OTP_INVALID",
                status: 400,
            });
        }
        // 5. Hash email (SHA-256) for identity
        const identityHash = await hashEmail(attempt.identifier);
        // 6. Delete raw attempt (privacy: no sensitive data stored)
        await this.attemptStore.deleteAttempt(attemptId);
        // 7. Check if wallet already verified
        if (await this.claimStore.hasClaim(walletAddress)) {
            throw Object.assign(new Error("This wallet is already verified"), {
                code: "WALLET_ALREADY_VERIFIED",
                status: 409,
            });
        }
        // 8. Check if this identity was already verified (same person, different wallet?)
        const existingClaims = await this.claimStore.findByIdentityHash(identityHash);
        if (existingClaims.length > 0) {
            // Allow multi-wallet verification but note it
            console.warn(`Identity ${identityHash.slice(0, 16)}... already verified for ${existingClaims.length} wallet(s)`);
        }
        // 9. Create signed claim
        const claim = await verifyAndSignClaim({
            walletAddress,
            identityHash,
            method: "email",
            privateKey: this.privateKey,
            keyId: this.keyId,
        });
        // 10. Store claim (attemptId already deleted, so null)
        const result = await this.claimStore.createClaim({
            ...claim,
            attemptId: null, // attempt was deleted
        });
        return { claim: result, isNew: true };
    }
}
/**
 * Hash an email address for identity binding.
 * Uses SHA-256 to create a fixed-length, non-reversible hash.
 * The email is lowercased and trimmed before hashing.
 */
async function hashEmail(email) {
    const normalized = email.toLowerCase().trim();
    const encoder = new TextEncoder();
    const data = encoder.encode(normalized);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
