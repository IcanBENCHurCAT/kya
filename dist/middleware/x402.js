const usedTxIds = new Map();
export function resetX402Receipts() {
    usedTxIds.clear();
}
export function getX402Receipts() {
    return Array.from(usedTxIds.values());
}
export function x402PaymentGate(options = {}) {
    const price = options.priceMicroAlgo || 1000;
    const receiver = options.receiverAddress || 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const ttl = options.ttlSeconds || 300;
    const tag = options.tag || 'x402-global-challenge';
    return async (c, next) => {
        const path = c.req.path;
        if (path === '/health' ||
            path === '/api/v1/health' ||
            path.includes('/health') ||
            path.includes('/x402') ||
            path.includes('.well-known')) {
            return await next();
        }
        const paymentTxId = c.req.header('X-Payment') || c.req.header('x-payment');
        if (!paymentTxId) {
            return c.json({
                error: 'Payment Required',
                message: 'This endpoint requires an x402 microALGO payment.',
                paymentOffer: {
                    priceMicroAlgo: price,
                    receiverAddress: receiver,
                    expiresInSeconds: ttl,
                    tag: tag,
                    instructions: 'Submit payment transaction to receiverAddress and include transaction ID in X-Payment header.',
                },
                priceMicroAlgo: price,
                receiverAddress: receiver,
                expiresInSeconds: ttl,
                tag: tag,
            }, 402);
        }
        // Replay attack protection: check if txid has already been used
        if (usedTxIds.has(paymentTxId)) {
            return c.json({
                error: 'Bad Request',
                message: 'Transaction ID already redeemed',
            }, 400);
        }
        const receipt = {
            receiptId: `receipt_${paymentTxId}_${Date.now()}`,
            txid: paymentTxId,
            amountMicroAlgo: price,
            endpoint: path,
            timestamp: new Date().toISOString(),
        };
        usedTxIds.set(paymentTxId, receipt);
        c.header('X-Payment-Receipt', receipt.receiptId);
        return await next();
    };
}
