/**
 * Verification Service HTTP Routes (Hono)
 *
 * REST API endpoints for human verification:
 *
 * POST /verify/email/initiate    — Start email OTP verification
 * POST /verify/email/complete    — Complete email OTP verification
 * GET  /verify/wallet/:address   — Check verification status by wallet
 * GET  /verify/identity/:hash    — Check verification by identity hash
 * GET  /verify/methods           — List available verification methods
 */
import { Hono } from "hono";
export function createVerificationRoutes(verificationService) {
    const router = new Hono();
    // -----------------------------------------------------------------------
    // POST /verify/email/initiate
    // Request: { email: string, walletAddress: string }
    // Response: { attemptId: string }
    // -----------------------------------------------------------------------
    router.post("/verify/email/initiate", async (c) => {
        try {
            const body = await c.req.json();
            if (!body.email || !body.walletAddress) {
                return c.json({ error: "email and walletAddress are required" }, 400);
            }
            // Validate wallet address format (Algorand base32, 58 chars)
            if (!/^[RPXAZ][23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{56}$/.test(body.walletAddress)) {
                return c.json({ error: "Invalid wallet address format (expected Algorand base32)" }, 400);
            }
            const { attemptId } = await verificationService.initiateVerification({
                email: body.email,
                walletAddress: body.walletAddress,
            });
            return c.json({ attemptId }, 200);
        }
        catch (error) {
            if (error.code) {
                const err = error;
                return c.json({ error: err.message, code: err.code }, err.status);
            }
            return c.json({ error: "Internal server error" }, 500);
        }
    });
    // -----------------------------------------------------------------------
    // POST /verify/email/complete
    // Request: { attemptId: string, code: string, walletAddress: string }
    // Response: { claim: VerificationClaim, isNew: boolean }
    // -----------------------------------------------------------------------
    router.post("/verify/email/complete", async (c) => {
        try {
            const body = await c.req.json();
            if (!body.attemptId ||
                !body.code ||
                !body.walletAddress) {
                return c.json({ error: "attemptId, code, and walletAddress are required" }, 400);
            }
            // Validate code format (6-digit OTP)
            if (!/^\d{6}$/.test(body.code)) {
                return c.json({ error: "Code must be a 6-digit number" }, 400);
            }
            const result = await verificationService.completeVerification({
                attemptId: body.attemptId,
                code: body.code,
                walletAddress: body.walletAddress,
            });
            return c.json(result, 200);
        }
        catch (error) {
            if (error.code) {
                const err = error;
                return c.json({ error: err.message, code: err.code }, err.status);
            }
            return c.json({ error: "Internal server error" }, 500);
        }
    });
    // -----------------------------------------------------------------------
    // GET /verify/wallet/:address
    // Response: { isVerified, claimCount, ... }
    // -----------------------------------------------------------------------
    router.get("/verify/wallet/:address", async (c) => {
        try {
            const walletAddress = c.req.param("address");
            if (!walletAddress ||
                !/^[RPXAZ][23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{56}$/.test(walletAddress)) {
                return c.json({ error: "Invalid wallet address format" }, 400);
            }
            const result = await verificationService.checkVerification(walletAddress);
            return c.json(result, 200);
        }
        catch (error) {
            return c.json({ error: "Internal server error" }, 500);
        }
    });
    // -----------------------------------------------------------------------
    // GET /verify/identity/:hash
    // Response: { found, walletAddresses, claimCount }
    // -----------------------------------------------------------------------
    router.get("/verify/identity/:hash", async (c) => {
        try {
            const identityHash = c.req.param("hash");
            if (!identityHash || !/^[0-9a-f]{64}$/.test(identityHash)) {
                return c.json({ error: "Valid SHA-256 hex hash required" }, 400);
            }
            const result = await verificationService.checkIdentityHash(identityHash);
            return c.json(result, 200);
        }
        catch (error) {
            return c.json({ error: "Internal server error" }, 500);
        }
    });
    // -----------------------------------------------------------------------
    // GET /verify/methods
    // Response: { methods: string[] }
    // -----------------------------------------------------------------------
    router.get("/verify/methods", async (c) => {
        const methods = verificationService.getAvailableMethods();
        return c.json({ methods }, 200);
    });
    // -----------------------------------------------------------------------
    // GET /health
    // Simple health check endpoint
    // -----------------------------------------------------------------------
    router.get("/health", (c) => {
        return c.json({ status: "ok", service: "kya-verification" }, 200);
    });
    return router;
}
