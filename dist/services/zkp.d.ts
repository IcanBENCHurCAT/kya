import { KarmaService } from './karma.js';
export interface ZKProofPoints {
    pi_a: string[];
    pi_b: string[][];
    pi_c: string[];
}
export interface ZKProofPayload {
    agentAddress: string;
    proof: ZKProofPoints;
    publicSignals: string[];
    claimType: string;
}
export interface ZKVerificationResult {
    valid: boolean;
    verificationLevel: string;
    agentAddress: string;
    timestamp: string;
    error?: string;
}
export declare class ZKPVerifierService {
    private karmaService;
    constructor(karmaService?: KarmaService);
    /**
     * Verify Groth16 ZK proof payload.
     * Enforces zero PII storage (GDPR Art. 17).
     */
    verifyProof(payload: ZKProofPayload): Promise<ZKVerificationResult>;
}
export declare const defaultZKPVerifierService: ZKPVerifierService;
