import { Hono } from 'hono';
import { ZKPVerifierService } from '../services/zkp.js';
export declare function createZKProofRoutes(zkpService?: ZKPVerifierService): Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
declare const zkProofApp: Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
export default zkProofApp;
