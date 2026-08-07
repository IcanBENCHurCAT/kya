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
import { VerificationService } from "../verification/service.js";
export declare function createVerificationRoutes(verificationService: VerificationService): Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
