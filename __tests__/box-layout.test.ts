import { describe, it, expect } from 'vitest';
import {
  encodeKarmaBox,
  decodeKarmaBox,
  getKarmaBoxKey,
  KARMA_BOX_SIZE,
  KARMA_BOX_KEY_SIZE,
  KARMA_BOX_KEY_PREFIX,
  KARMA_BOX_MBR_MICROALGOS,
  ARC28_EVENTS,
  OnChainKarmaBox,
} from '../src/algorand/box-layout.js';

describe('Algorand 77-Byte Box Storage Encoder & Serializer', () => {
  it('should verify ARC-28 constants and box constants', () => {
    expect(KARMA_BOX_SIZE).toBe(77);
    expect(KARMA_BOX_KEY_SIZE).toBe(34);
    expect(KARMA_BOX_KEY_PREFIX).toBe('k_');
    expect(KARMA_BOX_MBR_MICROALGOS).toBe(46900);

    expect(ARC28_EVENTS.AgentRegistered).toBe('0x4a7e9b12');
    expect(ARC28_EVENTS.KarmaUpdated).toBe('0x8c21f904');
    expect(ARC28_EVENTS.RiskFlagged).toBe('0x1f94d03e');
    expect(ARC28_EVENTS.X402PaymentSettled).toBe('0x3d6a89c1');
  });

  it('should encode and decode OnChainKarmaBox with 100% round-trip symmetry', () => {
    const ownerHash = new Uint8Array(32);
    for (let i = 0; i < 32; i++) ownerHash[i] = i + 1;

    const sampleBox: OnChainKarmaBox = {
      karma_score: 750n,
      stake_amount: 5000000n,
      risk_flags: 2,
      ver_level: 3,
      registered_at: 1700000000n,
      last_updated: 1700000500n,
      owner_identity_hash: ownerHash,
      total_queries_paid: 42n,
    };

    const encoded = encodeKarmaBox(sampleBox);
    expect(encoded).toBeInstanceOf(Uint8Array);
    expect(encoded.length).toBe(77);

    // Verify manual byte offsets
    const buf = Buffer.from(encoded);
    expect(buf.readBigUInt64BE(0)).toBe(750n);
    expect(buf.readBigUInt64BE(8)).toBe(5000000n);
    expect(buf.readUInt32BE(16)).toBe(2);
    expect(buf.readUInt8(20)).toBe(3);
    expect(buf.readBigUInt64BE(21)).toBe(1700000000n);
    expect(buf.readBigUInt64BE(29)).toBe(1700000500n);
    expect(buf.subarray(37, 69)).toEqual(Buffer.from(ownerHash));
    expect(buf.readBigUInt64BE(69)).toBe(42n);

    // Decode and check symmetry
    const decoded = decodeKarmaBox(encoded);
    expect(decoded.karma_score).toBe(750n);
    expect(decoded.stake_amount).toBe(5000000n);
    expect(decoded.risk_flags).toBe(2);
    expect(decoded.ver_level).toBe(3);
    expect(decoded.registered_at).toBe(1700000000n);
    expect(decoded.last_updated).toBe(1700000500n);
    expect(decoded.owner_identity_hash).toEqual(ownerHash);
    expect(decoded.total_queries_paid).toBe(42n);
  });

  it('should throw error when decoding buffer of incorrect size', () => {
    const invalidBuf = new Uint8Array(50);
    expect(() => decodeKarmaBox(invalidBuf)).toThrow(/Invalid buffer/);
  });

  it('should generate 34-byte box key with k_ prefix for valid Algorand address', () => {
    // Valid Algorand address with valid checksum
    const testAddress = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const boxKey = getKarmaBoxKey(testAddress);

    expect(boxKey.length).toBe(34);
    expect(String.fromCharCode(boxKey[0], boxKey[1])).toBe('k_');
  });
});
