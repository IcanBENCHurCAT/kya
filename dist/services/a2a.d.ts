import { KarmaService } from './karma.js';
export interface A2AHandshakeRequest {
    initiatorAddress: string;
    targetAddress: string;
    requiredVerificationLevel?: string;
    minKarmaScore?: number;
}
export interface W3CVerifiableCredential {
    '@context': string[];
    id: string;
    type: string[];
    issuer: string;
    issuanceDate: string;
    credentialSubject: {
        id: string;
        agentAddress: string;
        karmaScore: number;
        tier: string;
        sanctionsStatus: 'PASS' | 'FAIL' | 'FLAGGED';
        verifiedAt: string;
    };
    proof?: {
        type: string;
        created: string;
        verificationMethod: string;
        proofPurpose: string;
        jws: string;
    };
}
export interface A2AHandshakeResponse {
    decision: 'PROCEED' | 'REJECT' | 'REVIEW';
    targetProfile?: {
        agentAddress: string;
        karmaScore: number;
        tier: string;
        sanctionsStatus?: 'PASS' | 'FAIL' | 'FLAGGED';
    };
    verifiableCredential?: W3CVerifiableCredential;
    signature?: string;
    timestamp: string;
    riskSummary: {
        karmaPass: boolean;
        sanctionsPass?: boolean;
        sanctionsStatus: 'PASS' | 'FAIL' | 'FLAGGED';
        details: string;
    };
}
export declare class A2AService {
    private karmaService;
    private servicePrivateKey;
    private servicePublicKey;
    private keyId;
    constructor(karmaService?: KarmaService);
    /**
     * Ensure service Ed25519 signing keys are initialized.
     */
    initKeys(): Promise<void>;
    getPublicKey(): string | null;
    /**
     * Execute A2A Pre-Flight Handshake Evaluation.
     */
    executeHandshake(request: A2AHandshakeRequest, watchlist?: Record<string, any>): Promise<A2AHandshakeResponse>;
    /**
     * Helper to verify returned Ed25519 signature
     */
    verifyPassportSignature(params: {
        walletAddress: string;
        identityHash: string;
        verifiedAt: number;
        signature: string;
    }): Promise<boolean>;
}
export declare const defaultA2AService: A2AService;
