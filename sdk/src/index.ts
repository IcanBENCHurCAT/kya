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

export class KyaClient {
  private baseUrl: string;
  private paymentTxId?: string;

  constructor(config: KyaClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.paymentTxId = config.paymentTxId;
  }

  public setPaymentTxId(txid: string): void {
    this.paymentTxId = txid;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.paymentTxId) {
      headers['X-Payment'] = this.paymentTxId;
    }
    return headers;
  }

  /**
   * Query Agent Karma profile and event history
   */
  public async getKarma(address: string): Promise<KarmaProfileResponse> {
    const res = await fetch(`${this.baseUrl}/api/v1/karma/${address}`, {
      headers: this.getHeaders(),
    });
    return res.json();
  }

  /**
   * Record a Karma credit, debit, or emit event
   */
  public async recordKarmaEvent(event: {
    agentAddress: string;
    eventType: 'credit' | 'debit' | 'emit' | 'CREDIT' | 'DEBIT' | 'EMIT';
    amount: number;
    reason: string;
    txid?: string;
  }): Promise<KarmaProfileResponse> {
    const res = await fetch(`${this.baseUrl}/api/v1/karma/event`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(event),
    });
    return res.json();
  }

  /**
   * Execute A2A pre-flight trust handshake before initiating bounties or fund transfers
   */
  public async executeA2AHandshake(
    request: A2AHandshakeRequest
  ): Promise<A2AHandshakeResponse> {
    const res = await fetch(`${this.baseUrl}/api/v1/a2a/handshake`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(request),
    });
    return res.json();
  }

  /**
   * Submit Groth16 Zero-Knowledge KYC proof payload to upgrade verification tier
   */
  public async submitZKProof(payload: ZKProofPayload): Promise<any> {
    const res = await fetch(`${this.baseUrl}/api/v1/verify/zk-proof`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    return res.json();
  }

  /**
   * Screen wallet address against OFAC SDN sanctions list
   */
  public async screenWallet(
    address: string,
    beneficialOwner?: string
  ): Promise<ScreeningResponse> {
    const res = await fetch(`${this.baseUrl}/api/v1/screen`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ address, beneficialOwner }),
    });
    return res.json();
  }
}
