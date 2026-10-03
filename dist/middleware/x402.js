import { AlgorandClient } from "../algorand/client.js";
export async function verifyPaymentTransaction(txid, expectedReceiver, minPriceMicroAlgo, client) {
    try {
        const res = await client.getTransactionByID(txid);
        if (!res) {
            return { valid: false, error: "Transaction not found on Algorand network" };
        }
        const tx = res.transaction || res.tx || res;
        if (!tx || typeof tx !== "object") {
            return { valid: false, error: "Invalid transaction payload from indexer" };
        }
        const confirmedRound = tx["confirmed-round"] ?? tx.confirmedRound ?? tx["confirmedRound"] ?? 0;
        if (!confirmedRound || Number(confirmedRound) <= 0) {
            return { valid: false, error: "Transaction is not confirmed on-chain" };
        }
        const txType = tx["tx-type"] ?? tx.txType ?? tx.type;
        if (txType !== "pay") {
            return { valid: false, error: `Invalid transaction type '${txType}', expected 'pay'` };
        }
        const payerAddress = tx.sender ?? tx.snd ?? tx["sender"];
        const paymentFields = tx["payment-transaction"] ?? tx.paymentTransaction ?? tx.paymentTxnFields ?? tx;
        const receiver = paymentFields?.receiver ?? paymentFields?.rcv;
        const amount = paymentFields?.amount ?? paymentFields?.amt ?? 0;
        if (!receiver || receiver !== expectedReceiver) {
            return {
                valid: false,
                error: `Transaction receiver '${receiver}' does not match expected address '${expectedReceiver}'`,
            };
        }
        if (typeof amount !== "number" || amount < minPriceMicroAlgo) {
            return {
                valid: false,
                error: `Transaction amount ${amount} microALGO is less than required ${minPriceMicroAlgo} microALGO`,
            };
        }
        return {
            valid: true,
            payerAddress: typeof payerAddress === "string" ? payerAddress : undefined,
        };
    }
    catch (err) {
        return {
            valid: false,
            error: `Failed to verify payment transaction on-chain: ${err?.message || String(err)}`,
        };
    }
}
// Maximum number of redeemed payment receipts stored in memory for replay protection
export const MAX_RECEIPTS_CAP = 10000;
const usedTxIds = new Map();
export function resetX402Receipts() {
    usedTxIds.clear();
}
export function getX402Receipts() {
    return Array.from(usedTxIds.values());
}
export function x402PaymentGate(options = {}) {
    const price = options.priceMicroAlgo || 1000;
    const defaultEscrow = "W5IRXJWPSXNUJVSN2MOEJGTDGKUGFKUDVPTR5ZQVMDG5O4KYD5M3QPG3TE";
    const receiver = options.receiverAddress ||
        options.treasuryAddress ||
        process.env.KYA_TREASURY_ADDRESS ||
        process.env.ESCROW_ADDRESS ||
        defaultEscrow;
    const ttl = options.ttlSeconds || 300;
    const tag = options.tag || "x402-global-challenge";
    return async (c, next) => {
        const path = c.req.path;
        if (path === "/health" ||
            path === "/api/v1/health" ||
            path.includes("/health") ||
            path.includes("/x402") ||
            path.includes(".well-known")) {
            return await next();
        }
        const paymentTxId = c.req.header("X-Payment") || c.req.header("x-payment");
        if (!paymentTxId) {
            return c.json({
                error: "Payment Required",
                message: "This endpoint requires an x402 microALGO payment.",
                paymentOffer: {
                    priceMicroAlgo: price,
                    receiverAddress: receiver,
                    expiresInSeconds: ttl,
                    tag: tag,
                    instructions: "Submit payment transaction to receiverAddress and include transaction ID in X-Payment header.",
                },
                priceMicroAlgo: price,
                receiverAddress: receiver,
                expiresInSeconds: ttl,
                tag: tag,
            }, 402);
        }
        // Security: Validate payment transaction ID length and format to prevent payload injection / memory exhaustion
        if (typeof paymentTxId !== "string" ||
            paymentTxId.trim().length === 0 ||
            paymentTxId.length > 128 ||
            !/^[a-zA-Z0-9_\-=]+$/.test(paymentTxId)) {
            return c.json({
                error: "Bad Request",
                message: "Invalid transaction ID format",
            }, 400);
        }
        // Replay attack protection: check if txid has already been used
        if (usedTxIds.has(paymentTxId)) {
            return c.json({
                error: "Bad Request",
                message: "Transaction ID already redeemed",
            }, 400);
        }
        let payerAddress;
        const skipVerification = options.skipOnChainVerification ??
            (process.env.NODE_ENV === "test" || process.env.VITEST ? !options.algorandClient : false);
        if (!skipVerification) {
            const client = options.algorandClient || new AlgorandClient();
            const verification = await verifyPaymentTransaction(paymentTxId, receiver, price, client);
            if (!verification.valid) {
                return c.json({
                    error: "Payment Required",
                    message: verification.error || "Payment transaction verification failed",
                    paymentOffer: {
                        priceMicroAlgo: price,
                        receiverAddress: receiver,
                        expiresInSeconds: ttl,
                        tag: tag,
                        instructions: "Submit payment transaction to receiverAddress and include transaction ID in X-Payment header.",
                    },
                }, 402);
            }
            payerAddress = verification.payerAddress;
        }
        const receipt = {
            receiptId: `receipt_${paymentTxId}_${Date.now()}`,
            txid: paymentTxId,
            payerAddress,
            amountMicroAlgo: price,
            endpoint: path,
            timestamp: new Date().toISOString(),
        };
        // Performance optimization: Bounded FIFO eviction prevents unbounded memory growth
        // and V8 garbage collection pauses under high micro-payment traffic volume.
        if (usedTxIds.size >= MAX_RECEIPTS_CAP) {
            const oldestKey = usedTxIds.keys().next().value;
            if (oldestKey !== undefined) {
                usedTxIds.delete(oldestKey);
            }
        }
        usedTxIds.set(paymentTxId, receipt);
        c.header("X-Payment-Receipt", receipt.receiptId);
        return await next();
    };
}
