import { defaultKarmaService } from './karma.js';
import { screenSanctions } from './screening.js';
import { generateSigningKey, signClaim, verifyClaimSignature } from '../utils/crypto.js';
export class A2AService {
    karmaService;
    servicePrivateKey = null;
    servicePublicKey = null;
    keyId = 'key-a2a-1';
    constructor(karmaService = defaultKarmaService) {
        this.karmaService = karmaService;
    }
    /**
     * Ensure service Ed25519 signing keys are initialized.
     */
    async initKeys() {
        if (!this.servicePrivateKey || !this.servicePublicKey) {
            const keys = await generateSigningKey();
            this.servicePrivateKey = keys.privateKey;
            this.servicePublicKey = keys.publicKey;
        }
    }
    getPublicKey() {
        return this.servicePublicKey;
    }
    /**
     * Execute A2A Pre-Flight Handshake Evaluation.
     */
    async executeHandshake(request, watchlist) {
        await this.initKeys();
        const timestamp = new Date().toISOString();
        const minKarmaScore = request.minKarmaScore ?? 600;
        // 1. Retrieve target profile
        const targetProfile = await this.karmaService.getProfile(request.targetAddress);
        // 2. Perform screening
        const screeningResult = screenSanctions(request.targetAddress, undefined, watchlist || {});
        const sanctionsStatus = screeningResult.status;
        // 3. Compliance rule evaluation
        const karmaPass = targetProfile.score >= minKarmaScore;
        const sanctionsPass = sanctionsStatus === 'PASS';
        let decision = 'PROCEED';
        let details = 'Pre-flight evaluation passed successfully';
        if (!sanctionsPass || !karmaPass) {
            decision = 'REJECT';
            if (!sanctionsPass && !karmaPass) {
                details = `Rejected: Karma score (${targetProfile.score}) below required (${minKarmaScore}) and sanctions status is ${sanctionsStatus}`;
            }
            else if (!sanctionsPass) {
                details = `Rejected: Sanctions status is ${sanctionsStatus}`;
            }
            else {
                details = `Rejected: Karma score (${targetProfile.score}) below required (${minKarmaScore})`;
            }
        }
        const riskSummary = {
            karmaPass,
            sanctionsPass,
            sanctionsStatus,
            details,
        };
        if (decision === 'REJECT') {
            return {
                decision,
                targetProfile: {
                    agentAddress: targetProfile.agentAddress,
                    karmaScore: targetProfile.score,
                    tier: targetProfile.tier,
                    sanctionsStatus,
                },
                timestamp,
                riskSummary,
            };
        }
        // 4. Construct W3C Verifiable Credential JSON-LD Passport
        const vcId = `urn:uuid:${Math.random().toString(36).substring(2, 10)}-${Date.now()}`;
        const verifiedAtUnix = Math.floor(Date.now() / 1000);
        const credentialSubject = {
            id: `did:algorand:${request.targetAddress}`,
            agentAddress: request.targetAddress,
            karmaScore: targetProfile.score,
            tier: targetProfile.tier,
            sanctionsStatus,
            verifiedAt: timestamp,
        };
        // Sign VC claim payload using Ed25519 service key
        const signResult = await signClaim({
            walletAddress: request.targetAddress,
            identityHash: `karma:${targetProfile.score}|sanctions:${sanctionsStatus}`,
            method: 'A2A_PASSPORT',
            verifiedAt: verifiedAtUnix,
            privateKey: this.servicePrivateKey,
            keyId: this.keyId,
        });
        const verifiableCredential = {
            '@context': [
                'https://www.w3.org/2018/credentials/v1',
                'https://schema.kya.network/v1',
            ],
            id: vcId,
            type: ['VerifiableCredential', 'AgentKYAPassport'],
            issuer: 'did:algorand:KYAServiceIssuerAddress',
            issuanceDate: timestamp,
            credentialSubject,
            proof: {
                type: 'Ed25519Signature2020',
                created: timestamp,
                verificationMethod: `did:algorand:KYAServiceIssuerAddress#${this.keyId}`,
                proofPurpose: 'assertionMethod',
                jws: signResult.signature,
            },
        };
        return {
            decision: 'PROCEED',
            targetProfile: {
                agentAddress: targetProfile.agentAddress,
                karmaScore: targetProfile.score,
                tier: targetProfile.tier,
                sanctionsStatus,
            },
            verifiableCredential,
            signature: signResult.signature,
            timestamp,
            riskSummary,
        };
    }
    /**
     * Helper to verify returned Ed25519 signature
     */
    async verifyPassportSignature(params) {
        if (!this.servicePublicKey)
            return false;
        return verifyClaimSignature({
            walletAddress: params.walletAddress,
            identityHash: params.identityHash,
            verifiedAt: params.verifiedAt,
            signature: params.signature,
            publicKey: this.servicePublicKey,
        });
    }
}
export const defaultA2AService = new A2AService();
