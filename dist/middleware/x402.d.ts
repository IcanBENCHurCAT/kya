import type { MiddlewareHandler } from 'hono';
export interface X402Options {
    priceMicroAlgo: number;
    receiverAddress: string;
    treasuryAddress?: string;
    ttlSeconds?: number;
}
export declare function x402PaymentGate(options: X402Options): MiddlewareHandler;
