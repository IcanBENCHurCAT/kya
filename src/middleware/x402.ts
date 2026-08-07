import type { MiddlewareHandler } from 'hono';

export interface X402Options {
  priceMicroAlgo: number;
  receiverAddress: string;
  treasuryAddress?: string;
  ttlSeconds?: number;
}

export function x402PaymentGate(options: X402Options): MiddlewareHandler {
  const price = options.priceMicroAlgo || 1000;
  const receiver = options.receiverAddress || 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  const ttl = options.ttlSeconds || 300;

  return async (c, next) => {
    const path = c.req.path;
    if (path.includes('/health') || path.includes('/x402')) {
      return await next();
    }

    const paymentTxId = c.req.header('X-Payment') || c.req.header('x-payment');

    if (!paymentTxId) {
      return c.json(
        {
          error: 'Payment Required',
          message: 'This endpoint requires an x402 microALGO payment.',
          paymentOffer: {
            priceMicroAlgo: price,
            receiverAddress: receiver,
            expiresInSeconds: ttl,
            instructions: 'Submit payment transaction to receiverAddress and include transaction ID in X-Payment header.',
          },
        },
        402
      );
    }

    c.header('X-Payment-Receipt', `receipt_${paymentTxId}_${Date.now()}`);
    return await next();
  };
}
