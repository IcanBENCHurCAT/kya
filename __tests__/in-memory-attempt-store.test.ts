import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryAttemptStore } from '../src/verification/in-memory-store.js';

describe('InMemoryAttemptStore', () => {
  let store: InMemoryAttemptStore;

  beforeEach(() => {
    store = new InMemoryAttemptStore();
  });

  it('should create attempt and maintain secondary index', async () => {
    const attempt = await store.createAttempt({
      identifier: 'user1@example.com',
      method: 'email',
      codeHash: 'hash1',
      codeSalt: 'salt1',
      expiresAt: Date.now() + 60000,
      attemptCount: 0,
      maxAttempts: 3,
      createdAt: Date.now(),
    });

    expect(attempt.id).toBeDefined();
    expect(store.size()).toBe(1);

    const count = await store.getRecentAttemptCount('user1@example.com');
    expect(count).toBe(1);
  });

  it('should retrieve active attempt and return null for expired attempt', async () => {
    const attempt1 = await store.createAttempt({
      identifier: 'user1@example.com',
      method: 'email',
      codeHash: 'hash1',
      codeSalt: 'salt1',
      expiresAt: Date.now() + 60000,
      attemptCount: 0,
      maxAttempts: 3,
      createdAt: Date.now(),
    });

    const attempt2 = await store.createAttempt({
      identifier: 'user2@example.com',
      method: 'email',
      codeHash: 'hash2',
      codeSalt: 'salt2',
      expiresAt: Date.now() - 1000, // expired
      attemptCount: 0,
      maxAttempts: 3,
      createdAt: Date.now() - 5000,
    });

    const retrieved1 = await store.getAttempt(attempt1.id);
    expect(retrieved1).toEqual(attempt1);

    const retrieved2 = await store.getAttempt(attempt2.id);
    expect(retrieved2).toBeNull();
    expect(store.size()).toBe(1);
  });

  it('should increment attempt count', async () => {
    const attempt = await store.createAttempt({
      identifier: 'user1@example.com',
      method: 'email',
      codeHash: 'hash1',
      codeSalt: 'salt1',
      expiresAt: Date.now() + 60000,
      attemptCount: 0,
      maxAttempts: 3,
      createdAt: Date.now(),
    });

    const updated = await store.incrementAttempt(attempt.id);
    expect(updated?.attemptCount).toBe(1);
  });

  it('should delete attempt and clean up index', async () => {
    const attempt = await store.createAttempt({
      identifier: 'user1@example.com',
      method: 'email',
      codeHash: 'hash1',
      codeSalt: 'salt1',
      expiresAt: Date.now() + 60000,
      attemptCount: 0,
      maxAttempts: 3,
      createdAt: Date.now(),
    });

    await store.deleteAttempt(attempt.id);
    expect(store.size()).toBe(0);
    expect(await store.getRecentAttemptCount('user1@example.com')).toBe(0);
  });

  it('should cleanup expired attempts and remove them from index', async () => {
    await store.createAttempt({
      identifier: 'user1@example.com',
      method: 'email',
      codeHash: 'hash1',
      codeSalt: 'salt1',
      expiresAt: Date.now() - 1000,
      attemptCount: 0,
      maxAttempts: 3,
      createdAt: Date.now() - 5000,
    });

    await store.createAttempt({
      identifier: 'user2@example.com',
      method: 'email',
      codeHash: 'hash2',
      codeSalt: 'salt2',
      expiresAt: Date.now() + 60000,
      attemptCount: 0,
      maxAttempts: 3,
      createdAt: Date.now(),
    });

    const cleaned = await store.cleanupExpired();
    expect(cleaned).toBe(1);
    expect(store.size()).toBe(1);
    expect(await store.getRecentAttemptCount('user1@example.com')).toBe(0);
    expect(await store.getRecentAttemptCount('user2@example.com')).toBe(1);
  });

  it('should correctly count recent attempts within 1 hour per identifier', async () => {
    const now = Date.now();
    const targetId = 'user1@example.com';
    const otherId = 'user2@example.com';

    // Target - recent
    await store.createAttempt({
      identifier: targetId,
      method: 'email',
      codeHash: 'h1',
      codeSalt: 's1',
      expiresAt: now + 60000,
      attemptCount: 0,
      maxAttempts: 3,
      createdAt: now - 100000,
    });

    // Target - older than 1h
    await store.createAttempt({
      identifier: targetId,
      method: 'email',
      codeHash: 'h2',
      codeSalt: 's2',
      expiresAt: now + 60000,
      attemptCount: 0,
      maxAttempts: 3,
      createdAt: now - 3700000,
    });

    // Other user
    await store.createAttempt({
      identifier: otherId,
      method: 'email',
      codeHash: 'h3',
      codeSalt: 's3',
      expiresAt: now + 60000,
      attemptCount: 0,
      maxAttempts: 3,
      createdAt: now - 50000,
    });

    expect(await store.getRecentAttemptCount(targetId)).toBe(1);
    expect(await store.getRecentAttemptCount(otherId)).toBe(1);
    expect(await store.getRecentAttemptCount('nonexistent@example.com')).toBe(0);
  });
});
