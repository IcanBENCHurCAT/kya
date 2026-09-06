import { Hono } from 'hono';
import { A2AService, defaultA2AService, A2AHandshakeRequest } from '../services/a2a.js';
import { ListRegistry } from '../services/watchlist-updater.js';

export interface A2ABindings {
  WATCHLIST?: ListRegistry;
}

const MAX_STRING_LENGTH = 255;

export function createA2ARoutes(a2aService: A2AService = defaultA2AService) {
  const a2aApp = new Hono<{ Bindings: A2ABindings }>();

  const handleHandshake = async (c: any) => {
    const body = (await c.req.json().catch((err: unknown) => {
      console.error('Failed to parse request JSON body:', err);
      return {};
    })) as A2AHandshakeRequest;
    const watchlist = c.env?.WATCHLIST || {};

    const { initiatorAddress, targetAddress, minKarmaScore } = body;

    if (
      typeof initiatorAddress !== 'string' ||
      initiatorAddress.trim().length === 0 ||
      initiatorAddress.length > MAX_STRING_LENGTH ||
      typeof targetAddress !== 'string' ||
      targetAddress.trim().length === 0 ||
      targetAddress.length > MAX_STRING_LENGTH
    ) {
      return c.json(
        {
          success: false,
          error: 'initiatorAddress and targetAddress are required',
        },
        400
      );
    }

    if (minKarmaScore !== undefined && typeof minKarmaScore !== 'number') {
      return c.json(
        {
          success: false,
          error: 'minKarmaScore must be a number if provided',
        },
        400
      );
    }

    const handshakeResult = await a2aService.executeHandshake(
      {
        initiatorAddress: initiatorAddress.trim(),
        targetAddress: targetAddress.trim(),
        minKarmaScore,
      },
      watchlist
    );

    return c.json({
      success: true,
      ...handshakeResult,
    });
  };

  a2aApp.post('/a2a/handshake', handleHandshake);
  a2aApp.post('/handshake', handleHandshake);

  return a2aApp;
}

const a2aApp = createA2ARoutes();
export default a2aApp;
