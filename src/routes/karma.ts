import { Hono } from 'hono';
import { isValidAddress } from 'algosdk';
import { defaultKarmaService, KarmaService } from '../services/karma.js';

export type { KarmaRecord, KarmaEvent, AgentProfile } from '../services/karma.js';

const MAX_STRING_LENGTH = 255;

export function createKarmaRoutes(karmaService: KarmaService = defaultKarmaService) {
  const karmaApp = new Hono();

  const handleGetKarma = async (c: any) => {
    const address = c.req.param('address');
    if (!address) {
      return c.json({ error: 'Address parameter is required' }, 400);
    }
    if (!isValidAddress(address)) {
      return c.json({ error: 'Invalid Algorand address format' }, 400);
    }
    const record = await karmaService.getProfile(address);
    return c.json({
      success: true,
      karma: record,
      score: record.score,
      tier: record.tier,
      totalEvents: record.totalEvents,
      lastUpdated: record.lastUpdated,
      events: record.events,
    });
  };

  const handlePostKarmaEvent = async (c: any) => {
    const body = await c.req.json().catch(() => ({}));
    const { agentAddress, eventType, amount, reason, txid } = body;

    // Security: Validate required parameters and strictly enforce finite, positive amount
    // to prevent NaN score corruption, negative credits/debits, and overflow exploits.
    if (
      !agentAddress ||
      !isValidAddress(agentAddress) ||
      !eventType ||
      typeof amount !== 'number' ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !['credit', 'debit', 'emit', 'CREDIT', 'DEBIT', 'EMIT'].includes(eventType)
    ) {
      return c.json({ error: 'Invalid parameters' }, 400);
    }

    // Security: Validate optional reason and txid types and bounds to prevent DoS / payload injection
    if (reason !== undefined && (typeof reason !== 'string' || reason.length > MAX_STRING_LENGTH)) {
      return c.json({ error: 'Invalid parameters' }, 400);
    }

    if (txid !== undefined && (typeof txid !== 'string' || txid.length > MAX_STRING_LENGTH)) {
      return c.json({ error: 'Invalid parameters' }, 400);
    }

    const record = await karmaService.recordEvent({
      agentAddress,
      eventType,
      amount,
      reason,
      txid,
    });

    return c.json({
      success: true,
      karma: record,
      score: record.score,
      tier: record.tier,
      totalEvents: record.totalEvents,
      lastUpdated: record.lastUpdated,
      events: record.events,
    });
  };

  karmaApp.get('/karma/:address', handleGetKarma);
  karmaApp.get('/:address', handleGetKarma);
  karmaApp.post('/karma/event', handlePostKarmaEvent);
  karmaApp.post('/event', handlePostKarmaEvent);

  return karmaApp;
}

const karmaApp = createKarmaRoutes();
export default karmaApp;
