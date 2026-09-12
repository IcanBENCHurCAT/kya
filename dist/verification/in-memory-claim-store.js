/**
 * In-memory claim store for testing.
 * Production uses Supabase; this stores claims locally.
 */
export class InMemoryClaimStore {
    claims = new Map();
    // Secondary index maps for O(1) lookup speed and zero-allocation queries
    // Optimization: Avoids O(N) linear scans and Array.from allocations over all stored claims.
    byWallet = new Map();
    byIdentityHash = new Map();
    async createClaim(claim) {
        const now = Date.now();
        const fullClaim = {
            id: crypto.randomUUID(),
            ...claim,
            createdAt: now,
            updatedAt: now,
        };
        this.claims.set(fullClaim.id, fullClaim);
        // Maintain secondary index by wallet address
        let walletSet = this.byWallet.get(fullClaim.walletAddress);
        if (!walletSet) {
            walletSet = new Set();
            this.byWallet.set(fullClaim.walletAddress, walletSet);
        }
        walletSet.add(fullClaim);
        // Maintain secondary index by identity hash
        let hashSet = this.byIdentityHash.get(fullClaim.identityHash);
        if (!hashSet) {
            hashSet = new Set();
            this.byIdentityHash.set(fullClaim.identityHash, hashSet);
        }
        hashSet.add(fullClaim);
        return fullClaim;
    }
    async findByWallet(walletAddress) {
        const walletSet = this.byWallet.get(walletAddress);
        if (!walletSet || walletSet.size === 0)
            return null;
        const walletClaims = Array.from(walletSet);
        walletClaims.sort((a, b) => b.verifiedAt - a.verifiedAt);
        return walletClaims[0];
    }
    async findAllForWallet(walletAddress) {
        const walletSet = this.byWallet.get(walletAddress);
        if (!walletSet || walletSet.size === 0)
            return [];
        const walletClaims = Array.from(walletSet);
        return walletClaims.sort((a, b) => b.verifiedAt - a.verifiedAt);
    }
    async findByIdentityHash(identityHash) {
        const hashSet = this.byIdentityHash.get(identityHash);
        if (!hashSet || hashSet.size === 0)
            return [];
        const hashClaims = Array.from(hashSet);
        return hashClaims.sort((a, b) => b.verifiedAt - a.verifiedAt);
    }
    async hasClaim(walletAddress) {
        const walletSet = this.byWallet.get(walletAddress);
        return !!walletSet && walletSet.size > 0;
    }
    async hasIdentityHash(identityHash) {
        const hashSet = this.byIdentityHash.get(identityHash);
        return !!hashSet && hashSet.size > 0;
    }
    async getClaimCount(walletAddress) {
        return this.byWallet.get(walletAddress)?.size ?? 0;
    }
    getAll() {
        return Array.from(this.claims.values());
    }
    size() {
        return this.claims.size;
    }
    clear() {
        this.claims.clear();
        this.byWallet.clear();
        this.byIdentityHash.clear();
    }
}
