/**
 * In-memory OTP store for testing.
 * Production uses Supabase; this stores OTP hashes locally.
 */
export class InMemoryAttemptStore {
    attempts = new Map();
    // Secondary index map for O(1) identifier lookups and zero-allocation rate limit queries
    // Optimization: Maintains a mapping of identifier -> Set<VerificationAttempt> to avoid O(N) linear scans across all attempts.
    byIdentifier = new Map();
    async createAttempt(attempt) {
        const id = crypto.randomUUID();
        const fullAttempt = { id, ...attempt };
        this.attempts.set(id, fullAttempt);
        // Maintain secondary index by identifier
        let idSet = this.byIdentifier.get(fullAttempt.identifier);
        if (!idSet) {
            idSet = new Set();
            this.byIdentifier.set(fullAttempt.identifier, idSet);
        }
        idSet.add(fullAttempt);
        return fullAttempt;
    }
    async getAttempt(id) {
        const attempt = this.attempts.get(id);
        if (!attempt)
            return null;
        if (attempt.expiresAt <= Date.now()) {
            this.removeFromIndex(attempt);
            this.attempts.delete(id);
            return null;
        }
        return attempt;
    }
    async incrementAttempt(id) {
        const attempt = this.attempts.get(id);
        if (!attempt)
            return null;
        attempt.attemptCount += 1;
        this.attempts.set(id, attempt);
        return attempt;
    }
    async deleteAttempt(id) {
        const attempt = this.attempts.get(id);
        if (attempt) {
            this.removeFromIndex(attempt);
            this.attempts.delete(id);
        }
    }
    async cleanupExpired() {
        let count = 0;
        const now = Date.now();
        for (const [id, attempt] of this.attempts) {
            if (attempt.expiresAt <= now) {
                this.removeFromIndex(attempt);
                this.attempts.delete(id);
                count++;
            }
        }
        return count;
    }
    /**
     * Check rate limit for an identifier.
     * Returns number of attempts made in the last hour.
     *
     * Performance optimization:
     * Uses secondary index `byIdentifier` for O(1) lookup of candidate attempts,
     * replacing the previous O(N) linear scan across all stored verification attempts.
     */
    async getRecentAttemptCount(identifier) {
        const idSet = this.byIdentifier.get(identifier);
        if (!idSet || idSet.size === 0)
            return 0;
        const oneHourAgo = Date.now() - 3600000;
        let count = 0;
        for (const attempt of idSet) {
            if (attempt.createdAt >= oneHourAgo) {
                count++;
            }
        }
        return count;
    }
    removeFromIndex(attempt) {
        const idSet = this.byIdentifier.get(attempt.identifier);
        if (idSet) {
            idSet.delete(attempt);
            if (idSet.size === 0) {
                this.byIdentifier.delete(attempt.identifier);
            }
        }
    }
    // Test helpers
    getAll() {
        return new Map(this.attempts);
    }
    size() {
        return this.attempts.size;
    }
    clear() {
        this.attempts.clear();
        this.byIdentifier.clear();
    }
}
