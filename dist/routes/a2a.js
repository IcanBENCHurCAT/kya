import { Hono } from 'hono';
import { defaultA2AService } from '../services/a2a.js';
export function createA2ARoutes(a2aService = defaultA2AService) {
    const a2aApp = new Hono();
    const handleHandshake = async (c) => {
        const body = (await c.req.json().catch(() => ({})));
        const watchlist = c.env?.WATCHLIST || {};
        if (!body.initiatorAddress || !body.targetAddress) {
            return c.json({
                success: false,
                error: 'initiatorAddress and targetAddress are required',
            }, 400);
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
