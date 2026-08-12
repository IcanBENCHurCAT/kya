import * as algosdk from 'algosdk';

/**
 * On-Chain Karma Box structure matching the static 77-byte binary layout.
 */
export interface OnChainKarmaBox {
  karma_score: bigint; // uint64 (offset 0)
  stake_amount: bigint; // uint64 (offset 8)
  risk_flags: number; // uint32 (offset 16)
  ver_level: number; // uint8 (offset 20)
  registered_at: bigint; // uint64 (offset 21)
  last_updated: bigint; // uint64 (offset 29)
  owner_identity_hash: Uint8Array | string; // bytes32 (offset 37)
  total_queries_paid: bigint; // uint64 (offset 69)
}

/** Total box size in bytes */
export const KARMA_BOX_SIZE = 77;
export const BOX_SIZE = KARMA_BOX_SIZE;

/** Box key prefix */
export const KARMA_BOX_KEY_PREFIX = 'k_';
export const BOX_KEY_PREFIX = KARMA_BOX_KEY_PREFIX;

/** Total box key length (2 bytes prefix + 32 bytes pubkey) */
export const KARMA_BOX_KEY_SIZE = 34;
export const BOX_KEY_SIZE = KARMA_BOX_KEY_SIZE;

/** Algorand Minimum Balance Requirement (MBR) constants */
export const MBR_PER_BOX = 2500; // 0.0025 ALGO
export const MBR_PER_BYTE = 400; // 0.0004 ALGO per byte
// Total MBR: 2500 + 400 * (34 + 77) = 2500 + 400 * 111 = 46,900 microALGO (0.0469 ALGO)
export const KARMA_BOX_MBR_MICROALGOS = 46900;
export const MBR_FEE_MICRO_ALGO = KARMA_BOX_MBR_MICROALGOS;

/**
 * ARC-28 Event Selector Constants (4-byte SHA-512/256 truncated selector hex)
 */
export const ARC28_EVENTS = {
  AgentRegistered: '0x4a7e9b12',
  KarmaUpdated: '0x8c21f904',
  RiskFlagged: '0x1f94d03e',
  X402PaymentSettled: '0x3d6a89c1',
} as const;

/**
 * Encode an OnChainKarmaBox object into a 77-byte Uint8Array / Buffer (big-endian).
 */
export function encodeKarmaBox(box: OnChainKarmaBox): Uint8Array {
  let hashBytes: Uint8Array;
  if (typeof box.owner_identity_hash === 'string') {
    hashBytes = Buffer.from(box.owner_identity_hash, 'hex');
  } else {
    hashBytes = box.owner_identity_hash;
  }

  if (hashBytes.length !== 32) {
    throw new Error(
      `owner_identity_hash must be exactly 32 bytes, got ${hashBytes.length}`
    );
  }

  const buf = Buffer.alloc(KARMA_BOX_SIZE);

  buf.writeBigUInt64BE(box.karma_score, 0);
  buf.writeBigUInt64BE(box.stake_amount, 8);
  buf.writeUInt32BE(box.risk_flags, 16);
  buf.writeUInt8(box.ver_level, 20);
  buf.writeBigUInt64BE(box.registered_at, 21);
  buf.writeBigUInt64BE(box.last_updated, 29);
  buf.subarray(37, 69).set(hashBytes);
  buf.writeBigUInt64BE(box.total_queries_paid, 69);

  return new Uint8Array(buf);
}

/**
 * Decode a 77-byte Uint8Array / Buffer into an OnChainKarmaBox object.
 */
export function decodeKarmaBox(buffer: Uint8Array): OnChainKarmaBox {
  if (buffer.length !== KARMA_BOX_SIZE) {
    throw new Error(
      `Invalid buffer size for Karma Box: expected ${KARMA_BOX_SIZE} bytes, got ${buffer.length}`
    );
  }

  const buf = Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  const karma_score = buf.readBigUInt64BE(0);
  const stake_amount = buf.readBigUInt64BE(8);
  const risk_flags = buf.readUInt32BE(16);
  const ver_level = buf.readUInt8(20);
  const registered_at = buf.readBigUInt64BE(21);
  const last_updated = buf.readBigUInt64BE(29);
  const owner_identity_hash = new Uint8Array(buf.subarray(37, 69));
  const total_queries_paid = buf.readBigUInt64BE(69);

  return {
    karma_score,
    stake_amount,
    risk_flags,
    ver_level,
    registered_at,
    last_updated,
    owner_identity_hash,
    total_queries_paid,
  };
}

/**
 * Helper utility to generate the 34-byte box key for an agent address (`k_` + 32-byte public key).
 */
export function getKarmaBoxKey(agentAddress: string): Uint8Array {
  let pubKey: Uint8Array;
  try {
    const decoded = algosdk.decodeAddress(agentAddress);
    pubKey = decoded.publicKey;
  } catch {
    // If not a valid Algorand base32 checksum address, pad or hash string to 32 bytes
    const buf = Buffer.alloc(32);
    buf.write(agentAddress, 'utf-8');
    pubKey = new Uint8Array(buf);
  }
  const prefix = Buffer.from(KARMA_BOX_KEY_PREFIX, 'utf-8');
  const key = Buffer.concat([prefix, Buffer.from(pubKey)]);
  return new Uint8Array(key);
}
