# Data Model Specifications — Phase 3

## 1. Entities & Types (`src/types/index.ts`)

```typescript
export type HandshakeDecision = 'PROCEED' | 'REJECT' | 'REVIEW';

export interface A2AHandshakeRequest {
  initiatorAddress: string;
  targetAddress: string;
  minKarmaScore?: number;
  requiredVerificationLevel?: number;
}

export interface W3CVerifiableCredential {
  '@context': string[];
  type: string[];
  issuer: string;
  issuanceDate: string;
  credentialSubject: {
    id: string;
    karmaScore: number;
    sanctionsStatus: 'PASS' | 'FLAGGED' | 'FAIL';
    verificationLevel: number;
    decision: HandshakeDecision;
  };
  proof: {
    type: string;
    created: string;
    verificationMethod: string;
    proofPurpose: string;
    proofValue: string;
  };
}

export interface A2AHandshakeResponse {
  decision: HandshakeDecision;
  initiatorAddress: string;
  targetAddress: string;
  targetProfile: {
    karmaScore: number;
    verificationLevel: number;
    sanctionsStatus: 'PASS' | 'FLAGGED' | 'FAIL';
    riskFlags: string[];
  };
  verifiableCredential: W3CVerifiableCredential;
  signature: string;
  timestamp: number;
}

export interface ZKProofPayload {
  agentAddress: string;
  proof: {
    pi_a: string[];
    pi_b: string[][];
    pi_c: string[];
    protocol: string;
  };
  publicSignals: string[];
  claimType: 'KYC_AGE_OVER_18' | 'NON_SANCTIONED_JURISDICTION' | 'ACCREDITED_INVESTOR';
}

export interface ZKVerificationResponse {
  success: boolean;
  agentAddress: string;
  claimType: string;
  newVerificationLevel: number;
  verifiedAt: number;
}

export interface OnChainKarmaBox {
  karmaScore: bigint;
  stakeAmount: bigint;
  riskFlags: number;
  verLevel: number;
  registeredAt: bigint;
  lastUpdated: bigint;
  ownerIdentityHash: Buffer; // 32 bytes
  totalQueriesPaid: bigint;
}
```
