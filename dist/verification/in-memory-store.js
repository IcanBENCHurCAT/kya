/**
 * In-memory OTP store for testing.
 * Production uses Supabase; this stores OTP hashes locally.
 */
export class InMemoryAttemptStore {
    attempts = new Map();
    async createAttempt(attempt) {
        const id = crypto.randomUUID();
        const fullAttempt = { id, ...attempt };
        this.attempts.set(id, fullAttempt);
        return fullAttempt;
    }
    async getAttempt(id) {
        const attempt = this.attempts.get(id);
        if (!attempt)
            return null;
        if (attempt.expiresAt <= Date.now()) {
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
        this.attempts.delete(id);
    }
    async cleanupExpired() {
        let count = 0;
        for (const [id, attempt] of this.attempts) {
            if (attempt.expiresAt <= Date.now()) {
                this.attempts.delete(id);
                count++;
            }
        }
        return count;
    }
    async getRecentAttemptCount(identifier) {
        const oneHourAgo = Date.now() - 3600000;
        let count = 0;
        for (const attempt of this.attempts.values()) {
            if (attempt.identifier === identifier && attempt.createdAt >= oneHourAgo) {
                count++;
            }
        }
        return count;
    }
    // Test helpers
    getAll() {
        return new Map(this.attempts);
    }
    size() {
        return this.attempts.size;
    }
}
