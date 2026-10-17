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
/**
 * Security: Bound maximum size of in-memory karma store to prevent memory exhaustion (DoS).
 */
export declare const MAX_PROFILES_CAP = 10000;
export declare const MAX_EVENTS_PER_AGENT_CAP = 1000;
export declare class InMemoryKarmaStore {
    private profiles;
    private events;
    getProfile(address: string): AgentProfile | null;
    saveProfile(profile: AgentProfile): void;
    getEvents(address: string): KarmaEvent[];
    addEvent(event: KarmaEvent): void;
    clear(): void;
}
export declare class KarmaService {
    private inMemoryStore;
    private supabase;
    constructor(supabaseUrl?: string, supabaseKey?: string);
    calculateTier(score: number): string;
    getProfile(address: string): Promise<KarmaRecord>;
    recordEvent(params: {
        agentAddress: string;
        eventType: 'credit' | 'debit' | 'emit' | 'CREDIT' | 'DEBIT' | 'EMIT';
        amount: number;
        reason: string;
        txid?: string;
    }): Promise<KarmaRecord>;
    getHistory(address: string): Promise<KarmaEvent[]>;
    clearInMemory(): void;
}
export declare const defaultKarmaService: KarmaService;
