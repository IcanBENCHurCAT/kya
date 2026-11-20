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
    agentAddress: string;
    karmaScore: number;
    tier: string;
    sanctionsStatus?: 'NO_MATCH_FOUND' | 'POTENTIAL_MATCH' | 'MATCH_REQUIRES_REVIEW';
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
    status: 'NO_MATCH_FOUND' | 'POTENTIAL_MATCH' | 'MATCH_REQUIRES_REVIEW';
    confidence: number;
    details: string;
  };
}

export class KyaApiError extends Error {
  public readonly status: number;
  public readonly body?: unknown;
  public readonly paymentDetails?: unknown;

  constructor(
    message: string,
    status: number,
    body?: unknown,
    paymentDetails?: unknown
  ) {
    super(message);
    this.name = 'KyaApiError';
    this.status = status;
    this.body = body;
    this.paymentDetails = paymentDetails;
    Object.setPrototypeOf(this, KyaApiError.prototype);
  }
}

const PAYMENT_REQUIRED_HEADERS = [
  'PAYMENT-REQUIRED',
  'X-Payment-Required',
  'WWW-Authenticate',
] as const;

export class KyaClient {
  private baseUrl: string;
  private paymentTxId?: string;

  constructor(config: KyaClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
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

  private async parseResponseBody(res: Response): Promise<unknown> {
    if (typeof res.text === 'function') {
      const rawText = await res.text();
      if (rawText.length === 0) {
        return undefined;
      }
      try {
        return JSON.parse(rawText);
      } catch {
        return rawText;
      }
    }

    if (typeof res.json === 'function') {
      try {
        return await res.json();
      } catch {
        return undefined;
      }
    }

    return undefined;
  }

  private parseHeaderValue(value: string): unknown {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }

    try {
      return JSON.parse(trimmed);
    } catch {
      if (
        typeof atob === 'function' &&
        /^[A-Za-z0-9+/=]+$/.test(trimmed) &&
        trimmed.length % 4 === 0
      ) {
        try {
          const decoded = atob(trimmed);
          if (decoded.startsWith('{') || decoded.startsWith('[')) {
            return JSON.parse(decoded);
          }
        } catch {
          // Not valid base64-encoded JSON; preserve raw header string
        }
      }
      return trimmed;
    }
  }

  private extractPaymentDetails(res: Response, body: unknown): unknown {
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      const record = body as Record<string, unknown>;
      if (record.paymentOffer !== undefined) {
        return record.paymentOffer;
      }
      if (record.paymentDetails !== undefined) {
        return record.paymentDetails;
      }
      if (record.accepts !== undefined) {
        return record.accepts;
      }
      if (record.payment !== undefined) {
        return record.payment;
      }
      if (
        record.priceMicroAlgo !== undefined ||
        record.receiverAddress !== undefined ||
        record.payTo !== undefined ||
        record.amount !== undefined
      ) {
        return record;
      }
    }

    if (res.headers && typeof res.headers.get === 'function') {
      for (const headerName of PAYMENT_REQUIRED_HEADERS) {
        const headerVal = res.headers.get(headerName);
        if (headerVal) {
          const parsed = this.parseHeaderValue(headerVal);
          if (parsed !== undefined) {
            return parsed;
          }
        }
      }
    }

    return undefined;
  }

  private buildErrorMessage(res: Response, body: unknown): string {
    let detail = '';

    if (typeof body === 'string') {
      detail = body.trim();
    } else if (body && typeof body === 'object' && !Array.isArray(body)) {
      const record = body as Record<string, unknown>;
      const errorStr = typeof record.error === 'string' ? record.error.trim() : '';
      const messageStr = typeof record.message === 'string' ? record.message.trim() : '';
      const detailStr =
        typeof record.detail === 'string'
          ? record.detail.trim()
          : typeof record.details === 'string'
            ? record.details.trim()
            : '';

      if (errorStr && messageStr && errorStr !== messageStr) {
        detail = `${errorStr}: ${messageStr}`;
      } else {
        detail = messageStr || errorStr || detailStr;
      }
    }

    if (detail) {
      return `KYA API request failed (${res.status}): ${detail}`;
    }

    if (res.status === 402) {
      return 'KYA API request failed (402): Payment Required';
    }

    const statusSuffix = res.statusText ? ` ${res.statusText}` : '';
    return `KYA API request failed (${res.status}${statusSuffix})`;
  }

  private async handleResponse<T>(res: Response): Promise<T> {
    if (!res.ok) {
      const body = await this.parseResponseBody(res);
      const paymentDetails =
        res.status === 402 ? this.extractPaymentDetails(res, body) : undefined;
      const message = this.buildErrorMessage(res, body);
      throw new KyaApiError(message, res.status, body, paymentDetails);
    }

    return res.json() as Promise<T>;
  }

  /**
   * Query Agent Karma profile and event history
   */
  public async getKarma(address: string): Promise<KarmaProfileResponse> {
    const res = await fetch(`${this.baseUrl}/api/v1/karma/${address}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse<KarmaProfileResponse>(res);
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
    return this.handleResponse<KarmaProfileResponse>(res);
  }

  /**
   * Execute A2A pre-flight risk evaluation before initiating bounties or fund transfers
   */
  public async executeA2AHandshake(
    request: A2AHandshakeRequest
  ): Promise<A2AHandshakeResponse> {
    const res = await fetch(`${this.baseUrl}/api/v1/a2a/handshake`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(request),
    });
    return this.handleResponse<A2AHandshakeResponse>(res);
  }

  /**
   * Submit Groth16 Zero-Knowledge identity proof payload to upgrade verification tier
   */
  public async submitZKProof(payload: ZKProofPayload): Promise<any> {
    const res = await fetch(`${this.baseUrl}/api/v1/verify/zk-proof`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    return this.handleResponse<any>(res);
  }

  /**
   * Screen wallet address against sanctions watchlists
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
    return this.handleResponse<ScreeningResponse>(res);
  }
}
