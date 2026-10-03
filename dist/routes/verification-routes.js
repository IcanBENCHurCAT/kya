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
import { isValidAddress } from "algosdk";
const MAX_STRING_LENGTH = 255;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function createVerificationRoutes(verificationService) {
    const router = new Hono();
    // Route Handlers
    const handleInitiate = async (c) => {
        try {
            const body = ((await c.req.json().catch(() => ({}))) || {});
            if (!body.email ||
                typeof body.email !== "string" ||
                body.email.length > MAX_STRING_LENGTH ||
                !EMAIL_REGEX.test(body.email) ||
                !body.walletAddress ||
                typeof body.walletAddress !== "string" ||
                body.walletAddress.length > MAX_STRING_LENGTH) {
                return c.json({ error: "Valid email address and walletAddress are required" }, 400);
            }
            if (!isValidAddress(body.walletAddress)) {
                return c.json({ error: "Invalid wallet address format (expected Algorand base32)" }, 400);
            }
            const { attemptId } = await verificationService.initiateVerification({
                email: body.email,
                walletAddress: body.walletAddress,
            });
            return c.json({ attemptId }, 200);
        }
        catch (error) {
            console.error("Error in /verify/email/initiate:", error);
            if (error.code) {
                const err = error;
                return c.json({ error: err.message, code: err.code }, err.status);
            }
            return c.json({ error: "Internal server error" }, 500);
        }
    };
    const handleComplete = async (c) => {
        try {
            const body = ((await c.req.json().catch(() => ({}))) || {});
            if (!body.attemptId ||
                typeof body.attemptId !== "string" ||
                body.attemptId.length > MAX_STRING_LENGTH ||
                !body.code ||
                typeof body.code !== "string" ||
                body.code.length > MAX_STRING_LENGTH ||
                !body.walletAddress ||
                typeof body.walletAddress !== "string" ||
                body.walletAddress.length > MAX_STRING_LENGTH) {
                return c.json({ error: "attemptId, code, and walletAddress are required" }, 400);
            }
            if (!/^\d{6}$/.test(body.code)) {
                return c.json({ error: "Code must be a 6-digit number" }, 400);
            }
            if (!isValidAddress(body.walletAddress)) {
                return c.json({ error: "Invalid wallet address format (expected Algorand base32)" }, 400);
            }
            const result = await verificationService.completeVerification({
                attemptId: body.attemptId,
                code: body.code,
                walletAddress: body.walletAddress,
            });
            return c.json(result, 200);
        }
        catch (error) {
            console.error("Error in /verify/email/complete:", error);
            if (error.code) {
                const err = error;
                return c.json({ error: err.message, code: err.code }, err.status);
            }
            return c.json({ error: "Internal server error" }, 500);
        }
    };
    const handleWalletCheck = async (c) => {
        try {
            const walletAddress = c.req.param("address");
            if (!walletAddress || !isValidAddress(walletAddress)) {
                return c.json({ error: "Invalid wallet address format" }, 400);
            }
            const result = await verificationService.checkVerification(walletAddress);
            return c.json(result, 200);
        }
        catch (error) {
            console.error("Error in /verify/wallet/:address:", error);
            if (error.code) {
                const err = error;
                return c.json({ error: err.message, code: err.code }, err.status);
            }
            return c.json({ error: "Internal server error" }, 500);
        }
    };
    const handleIdentityCheck = async (c) => {
        try {
            const rawHash = c.req.param("hash");
            const identityHash = typeof rawHash === "string" ? rawHash.toLowerCase() : "";
            if (!identityHash || !/^[0-9a-f]{64}$/.test(identityHash)) {
                return c.json({ error: "Valid SHA-256 hex hash required" }, 400);
            }
            const result = await verificationService.checkIdentityHash(identityHash);
            return c.json(result, 200);
        }
        catch (error) {
            console.error("Error in /verify/identity/:hash:", error);
            if (error.code) {
                const err = error;
                return c.json({ error: err.message, code: err.code }, err.status);
            }
            return c.json({ error: "Internal server error" }, 500);
        }
    };
    const handleMethods = async (c) => {
        const methods = verificationService.getAvailableMethods();
        return c.json({ methods }, 200);
    };
    // Register routes with and without /verify prefix for sub-app mounting & standalone usage
    router.post("/email/initiate", handleInitiate);
    router.post("/verify/email/initiate", handleInitiate);
    router.post("/email/complete", handleComplete);
    router.post("/verify/email/complete", handleComplete);
    router.get("/wallet/:address", handleWalletCheck);
    router.get("/verify/wallet/:address", handleWalletCheck);
    router.get("/identity/:hash", handleIdentityCheck);
    router.get("/verify/identity/:hash", handleIdentityCheck);
    router.get("/methods", handleMethods);
    router.get("/verify/methods", handleMethods);
    router.get("/health", (c) => c.json({ status: "ok", service: "kya-verification" }, 200));
    return router;
}
