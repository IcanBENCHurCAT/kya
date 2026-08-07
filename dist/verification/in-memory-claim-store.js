/**
 * In-memory claim store for testing.
 * Production uses Supabase; this stores claims locally.
 */
export class InMemoryClaimStore {
    claims = new Map();
    async createClaim(claim) {
        const now = Date.now();
        const fullClaim = {
            id: crypto.randomUUID(),
            ...claim,
            createdAt: now,
            updatedAt: now,
        };
        this.claims.set(fullClaim.id, fullClaim);
        return fullClaim;
    }
    async findByWallet(walletAddress) {
        const walletClaims = Array.from(this.claims.values()).filter((c) => c.walletAddress === walletAddress);
        if (walletClaims.length === 0)
            return null;
        walletClaims.sort((a, b) => b.verifiedAt - a.verifiedAt);
        return walletClaims[0];
    }
    async findAllForWallet(walletAddress) {
        return Array.from(this.claims.values())
            .filter((c) => c.walletAddress === walletAddress)
            .sort((a, b) => b.verifiedAt - a.verifiedAt);
    }
    async findByIdentityHash(identityHash) {
        return Array.from(this.claims.values())
            .filter((c) => c.identityHash === identityHash)
            .sort((a, b) => b.verifiedAt - a.verifiedAt);
    }
    async hasClaim(walletAddress) {
        return Array.from(this.claims.values()).some((c) => c.walletAddress === walletAddress);
    }
    async hasIdentityHash(identityHash) {
        return Array.from(this.claims.values()).some((c) => c.identityHash === identityHash);
    }
    async getClaimCount(walletAddress) {
        return Array.from(this.claims.values()).filter((c) => c.walletAddress === walletAddress).length;
    }
    getAll() {
        return Array.from(this.claims.values());
    }
    size() {
        return this.claims.size;
    }
    clear() {
        this.claims.clear();
    }
}
