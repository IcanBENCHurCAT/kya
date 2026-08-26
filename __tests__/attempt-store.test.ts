import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AttemptStore } from '../src/verification/attempt-store.js';
import { createClient } from '@supabase/supabase-js';

vi.mock('@supabase/supabase-js', () => {
  return {
    createClient: vi.fn(),
  };
});

describe('AttemptStore', () => {
  const dummyDbUrl = 'https://example.supabase.co';
  const dummyServiceKey = 'service-role-key-123';

  let mockSupabase: any;
  let mockFrom: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockFrom = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
    };

    mockSupabase = {
      from: vi.fn().mockReturnValue(mockFrom),
    };

    vi.mocked(createClient).mockReturnValue(mockSupabase as any);
  });

  it('should initialize Supabase client with autoRefreshToken disabled', () => {
    new AttemptStore(dummyDbUrl, dummyServiceKey);
    expect(createClient).toHaveBeenCalledWith(dummyDbUrl, dummyServiceKey, {
      auth: { autoRefreshToken: false },
    });
  });

  describe('createAttempt', () => {
    it('should create attempt successfully and map snake_case columns to camelCase domain model', async () => {
      const store = new AttemptStore(dummyDbUrl, dummyServiceKey);
      const input = {
        identifier: 'user@example.com',
        method: 'email' as const,
        codeHash: 'hash123',
        codeSalt: 'salt456',
        expiresAt: 1700000000000,
        attemptCount: 0,
        maxAttempts: 3,
        createdAt: 1699990000000,
      };

      const mockDbRow = {
        id: 'attempt-uuid-1',
        identifier: 'user@example.com',
        method: 'email',
        code_hash: 'hash123',
        code_salt: 'salt456',
        expires_at: 1700000000000,
        attempt_count: 0,
        max_attempts: 3,
        created_at: 1699990000000,
      };

      mockFrom.single.mockResolvedValueOnce({ data: mockDbRow, error: null });

      const result = await store.createAttempt(input);

      expect(mockSupabase.from).toHaveBeenCalledWith('verification_attempts');
      expect(mockFrom.insert).toHaveBeenCalledWith({
        identifier: input.identifier,
        method: input.method,
        code_hash: input.codeHash,
        code_salt: input.codeSalt,
        expires_at: input.expiresAt,
        attempt_count: input.attemptCount,
        max_attempts: input.maxAttempts,
        created_at: input.createdAt,
      });
      expect(result).toEqual({
        id: 'attempt-uuid-1',
        identifier: 'user@example.com',
        method: 'email',
        codeHash: 'hash123',
        codeSalt: 'salt456',
        expiresAt: 1700000000000,
        attemptCount: 0,
        maxAttempts: 3,
        createdAt: 1699990000000,
      });
    });

    it('should throw error when Supabase insert fails', async () => {
      const store = new AttemptStore(dummyDbUrl, dummyServiceKey);
      mockFrom.single.mockResolvedValueOnce({ data: null, error: { message: 'DB connection error' } });

      await expect(
        store.createAttempt({
          identifier: 'user@example.com',
          method: 'email',
          codeHash: 'hash',
          codeSalt: 'salt',
          expiresAt: Date.now() + 60000,
          attemptCount: 0,
          maxAttempts: 3,
          createdAt: Date.now(),
        })
      ).rejects.toThrow('Failed to create attempt: DB connection error');
    });
  });

  describe('getAttempt', () => {
    it('should retrieve active attempt by ID when not expired', async () => {
      const store = new AttemptStore(dummyDbUrl, dummyServiceKey);
      const mockDbRow = {
        id: 'attempt-uuid-1',
        identifier: '+15551234567',
        method: 'phone',
        code_hash: 'hash_phone',
        code_salt: 'salt_phone',
        expires_at: Date.now() + 300000,
        attempt_count: 1,
        max_attempts: 3,
        created_at: Date.now() - 10000,
      };

      mockFrom.single.mockResolvedValueOnce({ data: mockDbRow, error: null });

      const result = await store.getAttempt('attempt-uuid-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('verification_attempts');
      expect(mockFrom.eq).toHaveBeenCalledWith('id', 'attempt-uuid-1');
      expect(mockFrom.gt).toHaveBeenCalledWith('expires_at', expect.any(Number));
      expect(result).toEqual({
        id: 'attempt-uuid-1',
        identifier: '+15551234567',
        method: 'phone',
        codeHash: 'hash_phone',
        codeSalt: 'salt_phone',
        expiresAt: mockDbRow.expires_at,
        attemptCount: 1,
        maxAttempts: 3,
        createdAt: mockDbRow.created_at,
      });
    });

    it('should return null when attempt is not found or error occurs', async () => {
      const store = new AttemptStore(dummyDbUrl, dummyServiceKey);
      mockFrom.single.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });

      const result = await store.getAttempt('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('incrementAttempt', () => {
    it('should increment attempt count and return updated attempt', async () => {
      const store = new AttemptStore(dummyDbUrl, dummyServiceKey);
      const mockDbRow = {
        id: 'attempt-uuid-1',
        identifier: 'test@example.com',
        method: 'email',
        code_hash: 'hash',
        code_salt: 'salt',
        expires_at: Date.now() + 60000,
        attempt_count: 2,
        max_attempts: 3,
        created_at: Date.now() - 1000,
      };

      mockFrom.single.mockResolvedValueOnce({ data: mockDbRow, error: null });

      const result = await store.incrementAttempt('attempt-uuid-1');

      expect(mockFrom.update).toHaveBeenCalledWith({ attempt_count: { increment: 1 } });
      expect(mockFrom.eq).toHaveBeenCalledWith('id', 'attempt-uuid-1');
      expect(result).toEqual({
        id: 'attempt-uuid-1',
        identifier: 'test@example.com',
        method: 'email',
        codeHash: 'hash',
        codeSalt: 'salt',
        expiresAt: mockDbRow.expires_at,
        attemptCount: 2,
        maxAttempts: 3,
        createdAt: mockDbRow.created_at,
      });
    });

    it('should return null if update fails or record not found', async () => {
      const store = new AttemptStore(dummyDbUrl, dummyServiceKey);
      mockFrom.single.mockResolvedValueOnce({ data: null, error: { message: 'Row not found' } });

      const result = await store.incrementAttempt('invalid-id');
      expect(result).toBeNull();
    });
  });

  describe('deleteAttempt', () => {
    it('should delete attempt by ID successfully', async () => {
      const store = new AttemptStore(dummyDbUrl, dummyServiceKey);
      mockFrom.eq.mockResolvedValueOnce({ error: null });

      await store.deleteAttempt('attempt-uuid-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('verification_attempts');
      expect(mockFrom.delete).toHaveBeenCalled();
      expect(mockFrom.eq).toHaveBeenCalledWith('id', 'attempt-uuid-1');
    });

    it('should throw error when deletion fails', async () => {
      const store = new AttemptStore(dummyDbUrl, dummyServiceKey);
      mockFrom.eq.mockResolvedValueOnce({ error: { message: 'Delete restriction' } });

      await expect(store.deleteAttempt('attempt-uuid-1')).rejects.toThrow(
        'Failed to delete attempt: Delete restriction'
      );
    });
  });

  describe('cleanupExpired', () => {
    it('should delete expired attempts and return deleted count', async () => {
      const store = new AttemptStore(dummyDbUrl, dummyServiceKey);
      mockFrom.select.mockResolvedValueOnce({ count: 5, error: null });

      const count = await store.cleanupExpired();

      expect(mockFrom.delete).toHaveBeenCalled();
      expect(mockFrom.lt).toHaveBeenCalledWith('expires_at', expect.any(Number));
      expect(mockFrom.select).toHaveBeenCalledWith('count');
      expect(count).toBe(5);
    });

    it('should return 0 if count is null or undefined', async () => {
      const store = new AttemptStore(dummyDbUrl, dummyServiceKey);
      mockFrom.select.mockResolvedValueOnce({ count: null, error: null });

      const count = await store.cleanupExpired();
      expect(count).toBe(0);
    });

    it('should throw error when cleanup fails', async () => {
      const store = new AttemptStore(dummyDbUrl, dummyServiceKey);
      mockFrom.select.mockResolvedValueOnce({ count: null, error: { message: 'Cleanup failed' } });

      await expect(store.cleanupExpired()).rejects.toThrow(
        'Failed to cleanup expired attempts: Cleanup failed'
      );
    });
  });

  describe('getRecentAttemptCount', () => {
    it('should query and return attempt count in the last hour for identifier', async () => {
      const store = new AttemptStore(dummyDbUrl, dummyServiceKey);
      mockFrom.gte.mockResolvedValueOnce({ count: 3, error: null });

      const count = await store.getRecentAttemptCount('user@example.com');

      expect(mockFrom.select).toHaveBeenCalledWith('count', { count: 'exact' });
      expect(mockFrom.eq).toHaveBeenCalledWith('identifier', 'user@example.com');
      expect(mockFrom.gte).toHaveBeenCalledWith('created_at', expect.any(Number));
      expect(count).toBe(3);
    });

    it('should return 0 when count is null or undefined', async () => {
      const store = new AttemptStore(dummyDbUrl, dummyServiceKey);
      mockFrom.gte.mockResolvedValueOnce({ count: null, error: null });

      const count = await store.getRecentAttemptCount('user@example.com');
      expect(count).toBe(0);
    });

    it('should throw error when rate limit query fails', async () => {
      const store = new AttemptStore(dummyDbUrl, dummyServiceKey);
      mockFrom.gte.mockResolvedValueOnce({ count: null, error: { message: 'Query error' } });

      await expect(store.getRecentAttemptCount('user@example.com')).rejects.toThrow(
        'Rate limit check failed: Query error'
      );
    });
  });
});
