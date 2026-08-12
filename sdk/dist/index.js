/**
 * KYA Service TypeScript SDK Client
 *
 * Provides a clean interface for querying Karma profiles, executing A2A handshakes,
 * submitting Groth16 ZK-KYC proofs, sanctions screening, and handling x402 payment headers.
 */
export class KyaClient {
    baseUrl;
    paymentTxId;
    constructor(config) {
        this.baseUrl = config.baseUrl.replace(/\/$/, '');
        this.paymentTxId = config.paymentTxId;
    }
    setPaymentTxId(txid) {
        this.paymentTxId = txid;
    }
    getHeaders() {
        const headers = {
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
    async getKarma(address) {
        const res = await fetch(`${this.baseUrl}/api/v1/karma/${address}`, {
            headers: this.getHeaders(),
        });
        return res.json();
    }
    /**
     * Record a Karma credit, debit, or emit event
     */
    async recordKarmaEvent(event) {
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
    async executeA2AHandshake(request) {
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
    async submitZKProof(payload) {
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
    async screenWallet(address, beneficialOwner) {
        const res = await fetch(`${this.baseUrl}/api/v1/screen`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ address, beneficialOwner }),
        });
        return res.json();
    }
}
