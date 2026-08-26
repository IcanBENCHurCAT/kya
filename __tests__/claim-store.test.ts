import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClaimStore } from '../src/verification/claim-store.js';
import { createClient } from '@supabase/supabase-js';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

describe('ClaimStore', () => {
  const mockDatabaseUrl = 'https://example.supabase.co';
  const mockServiceRoleKey = 'test-service-key';

  let mockSupabase: any;
  let claimStore: ClaimStore;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSupabase = {
      from: vi.fn(),
    };

    (createClient as any).mockReturnValue(mockSupabase);
    claimStore = new ClaimStore(mockDatabaseUrl, mockServiceRoleKey);
  });

  it('should initialize Supabase client with autoRefreshToken false', () => {
    expect(createClient).toHaveBeenCalledWith(
      mockDatabaseUrl,
      mockServiceRoleKey,
      { auth: { autoRefreshToken: false } }
    );
  });

  describe('createClaim', () => {
    it('should create and return a claim on success', async () => {
      const inputClaim = {
        walletAddress: 'WALLET123',
        identityHash: 'HASH123',
        method: 'email' as const,
        verifiedAt: 1000,
        signature: 'SIG123',
        keyId: 'KEY123',
        attemptId: 'ATTEMPT123',
      };

      const mockDbRow = {
        id: 'CLAIM_ID_1',
        wallet_address: 'WALLET123',
        identity_hash: 'HASH123',
        method: 'email',
        verified_at: 1000,
        signature: 'SIG123',
        key_id: 'KEY123',
        attempt_id: 'ATTEMPT123',
        created_at: 1700000000000,
        updated_at: 1700000000000,
      };

      const mockSingle = vi.fn().mockResolvedValue({ data: mockDbRow, error: null });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
      mockSupabase.from.mockReturnValue({ insert: mockInsert });

      const result = await claimStore.createClaim(inputClaim);

      expect(mockSupabase.from).toHaveBeenCalledWith('verification_claims');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          wallet_address: 'WALLET123',
          identity_hash: 'HASH123',
          method: 'email',
          verified_at: 1000,
          signature: 'SIG123',
          key_id: 'KEY123',
          attempt_id: 'ATTEMPT123',
        })
      );
      expect(result).toEqual({
        id: 'CLAIM_ID_1',
        walletAddress: 'WALLET123',
        identityHash: 'HASH123',
        method: 'email',
        verifiedAt: 1000,
        signature: 'SIG123',
        keyId: 'KEY123',
        attemptId: 'ATTEMPT123',
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
      });
    });

    it('should throw an error if insertion fails', async () => {
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database constraint failed' },
      });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
      mockSupabase.from.mockReturnValue({ insert: mockInsert });

      await expect(
        claimStore.createClaim({
          walletAddress: 'WALLET123',
          identityHash: 'HASH123',
          method: 'email',
          verifiedAt: 1000,
          signature: 'SIG123',
          keyId: 'KEY123',
          attemptId: 'ATTEMPT123',
        })
      ).rejects.toThrow('Failed to create claim: Database constraint failed');
    });
  });

  describe('findByWallet', () => {
    it('should return claim if found', async () => {
      const mockDbRow = {
        id: 'CLAIM_ID_1',
        wallet_address: 'WALLET123',
        identity_hash: 'HASH123',
        method: 'email',
        verified_at: 1000,
        signature: 'SIG123',
        key_id: 'KEY123',
        attempt_id: 'ATTEMPT123',
        created_at: 1700000000000,
        updated_at: 1700000000000,
      };

      const mockSingle = vi.fn().mockResolvedValue({ data: mockDbRow, error: null });
      const mockLimit = vi.fn().mockReturnValue({ single: mockSingle });
      const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockSupabase.from.mockReturnValue({ select: mockSelect });

      const result = await claimStore.findByWallet('WALLET123');

      expect(mockSupabase.from).toHaveBeenCalledWith('verification_claims');
      expect(mockEq).toHaveBeenCalledWith('wallet_address', 'WALLET123');
      expect(mockOrder).toHaveBeenCalledWith('verified_at', { ascending: false });
      expect(mockLimit).toHaveBeenCalledWith(1);
      expect(result).toEqual({
        id: 'CLAIM_ID_1',
        walletAddress: 'WALLET123',
        identityHash: 'HASH123',
        method: 'email',
        verifiedAt: 1000,
        signature: 'SIG123',
        keyId: 'KEY123',
        attemptId: 'ATTEMPT123',
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
      });
    });

    it('should return null if not found or on error', async () => {
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      });
      const mockLimit = vi.fn().mockReturnValue({ single: mockSingle });
      const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockSupabase.from.mockReturnValue({ select: mockSelect });

      const result = await claimStore.findByWallet('UNKNOWN_WALLET');
      expect(result).toBeNull();
    });
  });

  describe('findAllForWallet', () => {
    it('should return all claims for a wallet', async () => {
      const mockRows = [
        {
          id: 'CLAIM_1',
          wallet_address: 'WALLET123',
          identity_hash: 'HASH1',
          method: 'email',
          verified_at: 2000,
          signature: 'SIG1',
          key_id: 'KEY1',
          attempt_id: 'ATTEMPT1',
          created_at: 1700000000000,
          updated_at: 1700000000000,
        },
        {
          id: 'CLAIM_2',
          wallet_address: 'WALLET123',
          identity_hash: 'HASH2',
          method: 'gov-id',
          verified_at: 1000,
          signature: 'SIG2',
          key_id: 'KEY2',
          attempt_id: 'ATTEMPT2',
          created_at: 1600000000000,
          updated_at: 1600000000000,
        },
      ];

      const mockOrder = vi.fn().mockResolvedValue({ data: mockRows, error: null });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockSupabase.from.mockReturnValue({ select: mockSelect });

      const results = await claimStore.findAllForWallet('WALLET123');

      expect(mockEq).toHaveBeenCalledWith('wallet_address', 'WALLET123');
      expect(mockOrder).toHaveBeenCalledWith('verified_at', { ascending: false });
      expect(results.length).toBe(2);
      expect(results[0].id).toBe('CLAIM_1');
      expect(results[1].id).toBe('CLAIM_2');
    });

    it('should return empty array when data is null', async () => {
      const mockOrder = vi.fn().mockResolvedValue({ data: null, error: null });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockSupabase.from.mockReturnValue({ select: mockSelect });

      const results = await claimStore.findAllForWallet('EMPTY_WALLET');
      expect(results).toEqual([]);
    });

    it('should throw an error on database error', async () => {
      const mockOrder = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Connection timeout' },
      });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockSupabase.from.mockReturnValue({ select: mockSelect });

      await expect(claimStore.findAllForWallet('WALLET123')).rejects.toThrow(
        'Failed to find claims: Connection timeout'
      );
    });
  });

  describe('findByIdentityHash', () => {
    it('should return claims by identity hash', async () => {
      const mockRows = [
        {
          id: 'CLAIM_1',
          wallet_address: 'WALLET1',
          identity_hash: 'HASH_ABC',
          method: 'email',
          verified_at: 2000,
          signature: 'SIG1',
          key_id: 'KEY1',
          attempt_id: 'ATTEMPT1',
          created_at: 1700000000000,
          updated_at: 1700000000000,
        },
      ];

      const mockOrder = vi.fn().mockResolvedValue({ data: mockRows, error: null });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockSupabase.from.mockReturnValue({ select: mockSelect });

      const results = await claimStore.findByIdentityHash('HASH_ABC');

      expect(mockEq).toHaveBeenCalledWith('identity_hash', 'HASH_ABC');
      expect(results.length).toBe(1);
      expect(results[0].walletAddress).toBe('WALLET1');
    });

    it('should return empty array if data is null', async () => {
      const mockOrder = vi.fn().mockResolvedValue({ data: null, error: null });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockSupabase.from.mockReturnValue({ select: mockSelect });

      const results = await claimStore.findByIdentityHash('NON_EXISTENT');
      expect(results).toEqual([]);
    });

    it('should throw an error on database error', async () => {
      const mockOrder = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'DB error' },
      });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockSupabase.from.mockReturnValue({ select: mockSelect });

      await expect(claimStore.findByIdentityHash('HASH_ABC')).rejects.toThrow(
        'Failed to find claims by hash: DB error'
      );
    });
  });

  describe('hasClaim', () => {
    it('should return true if count > 0', async () => {
      const mockEq = vi.fn().mockResolvedValue({ count: 2, error: null });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockSupabase.from.mockReturnValue({ select: mockSelect });

      const result = await claimStore.hasClaim('WALLET123');

      expect(mockSelect).toHaveBeenCalledWith('count', { count: 'exact' });
      expect(mockEq).toHaveBeenCalledWith('wallet_address', 'WALLET123');
      expect(result).toBe(true);
    });

    it('should return false if count is 0 or undefined', async () => {
      const mockEq = vi.fn().mockResolvedValue({ count: 0, error: null });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockSupabase.from.mockReturnValue({ select: mockSelect });

      const result = await claimStore.hasClaim('WALLET_NONE');
      expect(result).toBe(false);
    });

    it('should throw an error on failure', async () => {
      const mockEq = vi.fn().mockResolvedValue({
        count: null,
        error: { message: 'Query error' },
      });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockSupabase.from.mockReturnValue({ select: mockSelect });

      await expect(claimStore.hasClaim('WALLET123')).rejects.toThrow(
        'Claim check failed: Query error'
      );
    });
  });

  describe('hasIdentityHash', () => {
    it('should return true if count > 0', async () => {
      const mockEq = vi.fn().mockResolvedValue({ count: 1, error: null });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockSupabase.from.mockReturnValue({ select: mockSelect });

      const result = await claimStore.hasIdentityHash('HASH123');

      expect(mockSelect).toHaveBeenCalledWith('count', { count: 'exact' });
      expect(mockEq).toHaveBeenCalledWith('identity_hash', 'HASH123');
      expect(result).toBe(true);
    });

    it('should return false if count is 0', async () => {
      const mockEq = vi.fn().mockResolvedValue({ count: 0, error: null });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockSupabase.from.mockReturnValue({ select: mockSelect });

      const result = await claimStore.hasIdentityHash('HASH_NONE');
      expect(result).toBe(false);
    });

    it('should throw an error on failure', async () => {
      const mockEq = vi.fn().mockResolvedValue({
        count: null,
        error: { message: 'Hash query error' },
      });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockSupabase.from.mockReturnValue({ select: mockSelect });

      await expect(claimStore.hasIdentityHash('HASH123')).rejects.toThrow(
        'Identity hash check failed: Hash query error'
      );
    });
  });

  describe('getClaimCount', () => {
    it('should return count of claims', async () => {
      const mockEq = vi.fn().mockResolvedValue({ count: 5, error: null });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockSupabase.from.mockReturnValue({ select: mockSelect });

      const count = await claimStore.getClaimCount('WALLET123');

      expect(mockSelect).toHaveBeenCalledWith('count', { count: 'exact' });
      expect(mockEq).toHaveBeenCalledWith('wallet_address', 'WALLET123');
      expect(count).toBe(5);
    });

    it('should return 0 when count is null', async () => {
      const mockEq = vi.fn().mockResolvedValue({ count: null, error: null });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockSupabase.from.mockReturnValue({ select: mockSelect });

      const count = await claimStore.getClaimCount('WALLET123');
      expect(count).toBe(0);
    });

    it('should throw an error on failure', async () => {
      const mockEq = vi.fn().mockResolvedValue({
        count: null,
        error: { message: 'Count error' },
      });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockSupabase.from.mockReturnValue({ select: mockSelect });

      await expect(claimStore.getClaimCount('WALLET123')).rejects.toThrow(
        'Claim count failed: Count error'
      );
    });
  });
});
