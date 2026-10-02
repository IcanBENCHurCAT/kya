import type { MiddlewareHandler } from "hono";
import { AlgorandClient } from "../algorand/client.js";
export interface X402Options {
    priceMicroAlgo?: number;
    receiverAddress?: string;
    treasuryAddress?: string;
    ttlSeconds?: number;
    tag?: string;
    algorandClient?: AlgorandClient;
    skipOnChainVerification?: boolean;
}
export interface PaymentVerificationResult {
    valid: boolean;
    error?: string;
    payerAddress?: string;
}
export declare function verifyPaymentTransaction(txid: string, expectedReceiver: string, minPriceMicroAlgo: number, client: AlgorandClient): Promise<PaymentVerificationResult>;
export interface X402Receipt {
    receiptId: string;
    txid: string;
    payerAddress?: string;
    amountMicroAlgo: number;
    endpoint: string;
    timestamp: string;
}
export declare const MAX_RECEIPTS_CAP = 10000;
export declare function resetX402Receipts(): void;
export declare function getX402Receipts(): X402Receipt[];
export declare function x402PaymentGate(options?: X402Options): MiddlewareHandler;
