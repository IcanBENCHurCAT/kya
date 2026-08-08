import { Hono } from 'hono';
import { KarmaService } from '../services/karma.js';
export type { KarmaRecord, KarmaEvent, AgentProfile } from '../services/karma.js';
export declare function createKarmaRoutes(karmaService?: KarmaService): Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
declare const karmaApp: Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
export default karmaApp;
