import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface AgentProfile {
  agentAddress: string;
  karmaScore: number;
  tier: string;
  riskFlags?: string[];
  verificationLevel?: string;
  registeredAt: string;
  lastUpdated: string;
  ownerHash?: string;
  totalQueriesPaid?: number;
}

export interface KarmaEvent {
  id: string;
  agentAddress: string;
  eventType: 'credit' | 'debit' | 'emit' | 'CREDIT' | 'DEBIT' | 'EMIT';
  amount: number;
  reason: string;
  timestamp: string;
  txid?: string;
}

export interface KarmaRecord {
  agentAddress: string;
  score: number;
  tier: string;
  totalEvents: number;
  lastUpdated: string;
  events: KarmaEvent[];
  riskFlags?: string[];
  registeredAt?: string;
}

export class InMemoryKarmaStore {
  private profiles: Map<string, AgentProfile> = new Map();
  private events: Map<string, KarmaEvent[]> = new Map();

  public getProfile(address: string): AgentProfile | null {
    return this.profiles.get(address) || null;
  }

  public saveProfile(profile: AgentProfile): void {
    this.profiles.set(profile.agentAddress, profile);
  }

  public getEvents(address: string): KarmaEvent[] {
    return this.events.get(address) || [];
  }

  public addEvent(event: KarmaEvent): void {
    const list = this.events.get(event.agentAddress) || [];
    list.push(event);
    this.events.set(event.agentAddress, list);
  }

  public clear(): void {
    this.profiles.clear();
    this.events.clear();
  }
}

function withTimeout<T>(promise: PromiseLike<T>, ms: number = 1000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Supabase request timeout')), ms);
    Promise.resolve(promise)
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export class KarmaService {
  private inMemoryStore: InMemoryKarmaStore;
  private supabase: SupabaseClient | null = null;

  constructor(supabaseUrl?: string, supabaseKey?: string) {
    this.inMemoryStore = new InMemoryKarmaStore();
    const url = supabaseUrl ?? process.env.SUPABASE_URL;
    const key = supabaseKey ?? (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY);

    if (url && key && !url.includes('invalid') && !url.includes('example.com')) {
      try {
        this.supabase = createClient(url, key);
      } catch {
        this.supabase = null;
      }
    }
  }

  public calculateTier(score: number): string {
    if (score < 300) return 'Tier 0 (Unscored)';
    if (score < 600) return 'Tier 1 (Emerging)';
    if (score < 850) return 'Tier 2 (Established)';
    return 'Tier 3 (Seasoned)';
  }

  public async getProfile(address: string): Promise<KarmaRecord> {
    if (this.supabase) {
      try {
        const [profileRes, eventsRes] = await Promise.all([
          withTimeout<any>(
            this.supabase
              .from('agent_profiles')
              .select('*')
              .eq('agent_address', address)
              .single(),
            1000
          ),
          withTimeout<any>(
            this.supabase
              .from('karma_events')
              .select('*')
              .eq('agent_address', address)
              .order('timestamp', { ascending: true }),
            1000
          ),
        ]);

        const profile = profileRes?.data;
        const events = eventsRes?.data;

        if (profile) {
          const mappedEvents: KarmaEvent[] = (events || []).map((e: any) => ({
            id: e.id,
            agentAddress: e.agent_address,
            eventType: e.event_type,
            amount: e.amount,
            reason: e.reason,
            timestamp: e.timestamp,
            txid: e.txid,
          }));

          const score = profile.karma_score ?? 100;
          return {
            agentAddress: address,
            score,
            tier: profile.tier || this.calculateTier(score),
            totalEvents: mappedEvents.length,
            lastUpdated: profile.last_updated || new Date().toISOString(),
            events: mappedEvents,
            riskFlags: profile.risk_flags || [],
            registeredAt: profile.registered_at,
          };
        }
      } catch {
        // Fallback to in-memory store
      }
    }

    // In-memory store logic
    let profile = this.inMemoryStore.getProfile(address);
    const events = this.inMemoryStore.getEvents(address);

    if (!profile) {
      const now = new Date().toISOString();
      profile = {
        agentAddress: address,
        karmaScore: 100,
        tier: 'Tier 0 (Unscored)',
        registeredAt: now,
        lastUpdated: now,
      };
      this.inMemoryStore.saveProfile(profile);
    }

    return {
      agentAddress: address,
      score: profile.karmaScore,
      tier: profile.tier || this.calculateTier(profile.karmaScore),
      totalEvents: events.length,
      lastUpdated: profile.lastUpdated,
      events: [...events],
      registeredAt: profile.registeredAt,
    };
  }

  public async recordEvent(params: {
    agentAddress: string;
    eventType: 'credit' | 'debit' | 'emit' | 'CREDIT' | 'DEBIT' | 'EMIT';
    amount: number;
    reason: string;
    txid?: string;
  }): Promise<KarmaRecord> {
    const { agentAddress, eventType, amount, reason, txid } = params;
    const normalizedType = eventType.toLowerCase() as 'credit' | 'debit' | 'emit';

    let delta = 0;
    if (normalizedType === 'credit') {
      delta = amount;
    } else if (normalizedType === 'debit') {
      delta = -amount;
    }

    const currentRecord = await this.getProfile(agentAddress);
    const newScore = Math.max(0, currentRecord.score + delta);
    const newTier = this.calculateTier(newScore);
    const now = new Date().toISOString();

    const event: KarmaEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      agentAddress,
      eventType: normalizedType,
      amount,
      reason: reason || 'Karma event',
      timestamp: now,
      txid,
    };

    if (this.supabase) {
      try {
        await Promise.all([
          withTimeout<any>(
            this.supabase.from('karma_events').insert({
              id: event.id,
              agent_address: agentAddress,
              event_type: normalizedType,
              amount,
              reason: event.reason,
              txid,
              timestamp: now,
            }),
            1000
          ),
          withTimeout<any>(
            this.supabase.from('agent_profiles').upsert({
              agent_address: agentAddress,
              karma_score: newScore,
              tier: newTier,
              last_updated: now,
            }),
            1000
          ),
        ]);
      } catch {
        // Fallback to in-memory store
      }
    }

    // Always update in-memory store as primary/fallback
    const existingProfile = this.inMemoryStore.getProfile(agentAddress);
    const updatedProfile: AgentProfile = {
      agentAddress,
      karmaScore: newScore,
      tier: newTier,
      registeredAt: existingProfile?.registeredAt || currentRecord.registeredAt || now,
      lastUpdated: now,
    };

    this.inMemoryStore.saveProfile(updatedProfile);
    this.inMemoryStore.addEvent(event);

    return this.getProfile(agentAddress);
  }

  public async getHistory(address: string): Promise<KarmaEvent[]> {
    const profile = await this.getProfile(address);
    return profile.events;
  }

  public clearInMemory(): void {
    this.inMemoryStore.clear();
  }
}

export const defaultKarmaService = new KarmaService();
