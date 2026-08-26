import { Hono } from 'hono';
import { A2AService, defaultA2AService, A2AHandshakeRequest } from '../services/a2a.js';
import { ListRegistry } from '../services/watchlist-updater.js';

export interface A2ABindings {
  WATCHLIST?: ListRegistry;
}

export function createA2ARoutes(a2aService: A2AService = defaultA2AService) {
  const a2aApp = new Hono<{ Bindings: A2ABindings }>();

  const handleHandshake = async (c: any) => {
    const body = (await c.req.json().catch((err: unknown) => {
      console.error('Failed to parse request JSON body:', err);
      return {};
    })) as A2AHandshakeRequest;
    const watchlist = c.env?.WATCHLIST || {};

    if (!body.initiatorAddress || !body.targetAddress) {
      return c.json(
        {
          success: false,
          error: 'initiatorAddress and targetAddress are required',
        },
        400
      );
    }

    const handshakeResult = await a2aService.executeHandshake(body, watchlist);

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
