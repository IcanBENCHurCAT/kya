import type { MiddlewareHandler } from 'hono';
export interface X402Options {
    priceMicroAlgo?: number;
    receiverAddress?: string;
    treasuryAddress?: string;
    ttlSeconds?: number;
}
export interface X402Receipt {
    receiptId: string;
    txid: string;
    payerAddress?: string;
    amountMicroAlgo: number;
    endpoint: string;
    timestamp: string;
}
export declare function resetX402Receipts(): void;
export declare function getX402Receipts(): X402Receipt[];
export declare function x402PaymentGate(options?: X402Options): MiddlewareHandler;
