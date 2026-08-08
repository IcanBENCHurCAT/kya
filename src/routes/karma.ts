import { Hono } from 'hono';

export interface KarmaRecord {
  agentAddress: string;
  score: number;
  totalEvents: number;
  lastUpdated: string;
  events: Array<{
    id: string;
    eventType: 'credit' | 'debit' | 'emit';
    amount: number;
    reason: string;
    timestamp: string;
    txid?: string;
  }>;
}

const karmaStore: Map<string, KarmaRecord> = new Map();

const karmaApp = new Hono();

karmaApp.get('/karma/:address', (c) => {
  const address = c.req.param('address');
  const record: KarmaRecord = karmaStore.get(address) || {
    agentAddress: address,
    score: 100,
    totalEvents: 0,
    lastUpdated: new Date().toISOString(),
    events: [],
  };
  return c.json({ success: true, karma: record });
});

karmaApp.post('/karma/event', async (c) => {
  const body = await c.req.json();
  const { agentAddress, eventType, amount, reason, txid } = body;

  if (!agentAddress || !eventType || typeof amount !== 'number') {
    return c.json({ error: 'Invalid parameters' }, 400);
  }

  let record: KarmaRecord = karmaStore.get(agentAddress) || {
    agentAddress,
    score: 100,
    totalEvents: 0,
    lastUpdated: new Date().toISOString(),
    events: [],
  };

  const delta = eventType === 'credit' ? amount : eventType === 'debit' ? -amount : 0;
  record.score = Math.max(0, record.score + delta);
  record.totalEvents += 1;
  record.lastUpdated = new Date().toISOString();
  record.events.push({
    id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    eventType,
    amount,
    reason: reason || 'Karma event',
    timestamp: new Date().toISOString(),
    txid,
  });

  karmaStore.set(agentAddress, record);
  return c.json({ success: true, karma: record });
});

export default karmaApp;
