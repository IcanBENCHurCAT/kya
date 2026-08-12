/**
 * KYA Service TypeScript SDK Client
 *
 * Provides a clean interface for querying Karma profiles, executing A2A handshakes,
 * submitting Groth16 ZK-KYC proofs, sanctions screening, and handling x402 payment headers.
 */
export interface KyaClientConfig {
    baseUrl: string;
    paymentTxId?: string;
    treasuryAddress?: string;
}
export interface KarmaProfileResponse {
    success: boolean;
    karma: {
        agentAddress: string;
        score: number;
        tier: string;
        totalEvents: number;
        lastUpdated: string;
        events: Array<{
            id: string;
            eventType: string;
            amount: number;
            reason: string;
            timestamp: string;
            txid?: string;
        }>;
    };
}
export interface A2AHandshakeRequest {
    initiatorAddress: string;
    targetAddress: string;
    requiredVerificationLevel?: string;
    minKarmaScore?: number;
}
export interface A2AHandshakeResponse {
    success: boolean;
    decision: 'PROCEED' | 'REJECT' | 'REVIEW';
    targetProfile: {
        address: string;
        karmaScore: number;
        tier: string;
        sanctionsStatus: 'PASS' | 'FAIL' | 'FLAGGED';
    };
    verifiableCredential?: Record<string, any>;
    signature?: string;
    timestamp: string;
}
export interface ZKProofPayload {
    agentAddress: string;
    proof: {
        pi_a: string[];
        pi_b: string[][];
        pi_c: string[];
    };
    publicSignals: string[];
    claimType?: string;
}
export interface ScreeningResponse {
    success: boolean;
    result: {
        screened: string;
        match: boolean;
        status: 'PASS' | 'FAIL' | 'FLAGGED';
        confidence: number;
        details: string;
    };
}
export declare class KyaClient {
    private baseUrl;
    private paymentTxId?;
    constructor(config: KyaClientConfig);
    setPaymentTxId(txid: string): void;
    private getHeaders;
    /**
     * Query Agent Karma profile and event history
     */
    getKarma(address: string): Promise<KarmaProfileResponse>;
    /**
     * Record a Karma credit, debit, or emit event
     */
    recordKarmaEvent(event: {
        agentAddress: string;
        eventType: 'credit' | 'debit' | 'emit' | 'CREDIT' | 'DEBIT' | 'EMIT';
        amount: number;
        reason: string;
        txid?: string;
    }): Promise<KarmaProfileResponse>;
    /**
     * Execute A2A pre-flight trust handshake before initiating bounties or fund transfers
     */
    executeA2AHandshake(request: A2AHandshakeRequest): Promise<A2AHandshakeResponse>;
    /**
     * Submit Groth16 Zero-Knowledge KYC proof payload to upgrade verification tier
     */
    submitZKProof(payload: ZKProofPayload): Promise<any>;
    /**
     * Screen wallet address against OFAC SDN sanctions list
     */
    screenWallet(address: string, beneficialOwner?: string): Promise<ScreeningResponse>;
}
