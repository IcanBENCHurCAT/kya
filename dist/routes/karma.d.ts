import { Hono } from 'hono';
export interface KarmaRecord {
    agentAddress: string;
    score: number;
    totalEvents: number;
    lastUpdated: string;
    events: Array<{
        id: string;
        eventType: 'credit' | 'debit' | 'emit';
        amount: number;
        reason: string;
        timestamp: string;
        txid?: string;
    }>;
}
declare const karmaApp: Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
export default karmaApp;
