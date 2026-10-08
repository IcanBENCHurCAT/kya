import { Hono } from 'hono';
import { isValidAddress } from 'algosdk';
import { defaultKarmaService, KarmaService } from '../services/karma.js';

export type { KarmaRecord, KarmaEvent, AgentProfile } from '../services/karma.js';

const MAX_STRING_LENGTH = 255;

export function createKarmaRoutes(karmaService: KarmaService = defaultKarmaService) {
  const karmaApp = new Hono();

  const handleGetKarma = async (c: any) => {
    const address = c.req.param('address');
    if (!address || typeof address !== 'string' || address.length > MAX_STRING_LENGTH) {
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
    const body = (await c.req.json().catch(() => ({}))) || {};
    const { agentAddress, eventType, amount, reason, txid } = body;

    const allowedEventTypes = [
      'credit', 'debit', 'emit', 'CREDIT', 'DEBIT', 'EMIT',
      'bounty.posted', 'bounty.claimed', 'bounty.completed',
      'bounty.rejected', 'bounty.disputed', 'dispute.resolved', 'payout.released'
    ];

    // Security: Validate required parameters and strictly enforce finite, positive amount
    // and string type bounds to prevent NaN score corruption, type confusion, and unhandled exceptions.
    if (
      !agentAddress ||
      typeof agentAddress !== 'string' ||
      agentAddress.length > MAX_STRING_LENGTH ||
      !isValidAddress(agentAddress) ||
      !eventType ||
      typeof eventType !== 'string' ||
      typeof amount !== 'number' ||
      !Number.isFinite(amount) ||
      amount < 0 || // allow 0 for 'emit' types
      !allowedEventTypes.includes(eventType)
    ) {
      return c.json({ error: 'Invalid parameters' }, 400);
    }
    
    if (amount === 0 && !eventType.toLowerCase().includes('emit') && !eventType.toLowerCase().includes('bounty.posted') && !eventType.toLowerCase().includes('bounty.claimed') && !eventType.toLowerCase().includes('bounty.disputed') && !eventType.toLowerCase().includes('payout.released')) {
       return c.json({ error: 'Invalid parameters' }, 400);
    }

    // Security: Validate optional reason and txid types and bounds to prevent DoS / payload injection
    // Now reason can be larger to support JSON stringified payload metadata (up to 1024 bytes)
    const MAX_REASON_LENGTH = 1024;
    if (reason !== undefined && (typeof reason !== 'string' || reason.length > MAX_REASON_LENGTH)) {
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
