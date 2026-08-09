/**
 * On-Chain Karma Box structure matching the static 77-byte binary layout.
 */
export interface OnChainKarmaBox {
    karma_score: bigint;
    stake_amount: bigint;
    risk_flags: number;
    ver_level: number;
    registered_at: bigint;
    last_updated: bigint;
    owner_identity_hash: Uint8Array | string;
    total_queries_paid: bigint;
}
/** Total box size in bytes */
export declare const KARMA_BOX_SIZE = 77;
export declare const BOX_SIZE = 77;
/** Box key prefix */
export declare const KARMA_BOX_KEY_PREFIX = "k_";
export declare const BOX_KEY_PREFIX = "k_";
/** Total box key length (2 bytes prefix + 32 bytes pubkey) */
export declare const KARMA_BOX_KEY_SIZE = 34;
export declare const BOX_KEY_SIZE = 34;
/** Algorand Minimum Balance Requirement (MBR) constants */
export declare const MBR_PER_BOX = 2500;
export declare const MBR_PER_BYTE = 400;
export declare const KARMA_BOX_MBR_MICROALGOS = 46900;
export declare const MBR_FEE_MICRO_ALGO = 46900;
/**
 * ARC-28 Event Selector Constants (4-byte SHA-512/256 truncated selector hex)
 */
export declare const ARC28_EVENTS: {
    readonly AgentRegistered: "0x4a7e9b12";
    readonly KarmaUpdated: "0x8c21f904";
    readonly RiskFlagged: "0x1f94d03e";
    readonly X402PaymentSettled: "0x3d6a89c1";
};
/**
 * Encode an OnChainKarmaBox object into a 77-byte Uint8Array / Buffer (big-endian).
 */
export declare function encodeKarmaBox(box: OnChainKarmaBox): Uint8Array;
/**
 * Decode a 77-byte Uint8Array / Buffer into an OnChainKarmaBox object.
 */
export declare function decodeKarmaBox(buffer: Uint8Array): OnChainKarmaBox;
/**
 * Helper utility to generate the 34-byte box key for an agent address (`k_` + 32-byte public key).
 */
export declare function getKarmaBoxKey(agentAddress: string): Uint8Array;
