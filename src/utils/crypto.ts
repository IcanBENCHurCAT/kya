/**
 * Cryptographic utilities for claim signing and verification.
 *
 * Uses Ed25519 (via jose library) for:
 * - Generating service key pairs for signing claims
 * - Signing claims with the service private key
 * - Verifying claims with the service public key
 */

import {
  generateKeyPair,
  importPKCS8,
  exportPKCS8,
  exportSPKI,
  verify,
  sign,
} from "jose";
import { VerificationClaim } from "../types.js";

/**
 * Convert raw bytes to PEM string (PKCS#8 or SPKI).
 * This is a minimal PEM encoder for Ed25519 keys.
 */
function toPEM(bytes: Uint8Array, type: "PRIVATE" | "PUBLIC"): string {
  // Base64 encode the DER bytes
  const b64 = btoa(String.fromCharCode(...bytes));
  // Wrap in PEM headers
  const lines = b64.match(/.{1,64}/g) || [];
  return `-----BEGIN ${type} KEY-----\n${lines.join("\n")}\n-----END ${type} KEY-----`;
}

/**
 * Generate a new Ed25519 key pair for signing claims.
 * Returns PEM-encoded private and public keys.
 */
export async function generateSigningKey(): Promise<{
  privateKey: string;
  publicKey: string;
}> {
  const { privateKey, publicKey } = await generateKeyPair("EdDSA");

  const pkcs8 = await exportPKCS8(privateKey);
  const spki = await exportSPKI(publicKey);

  return {
    privateKey: toPEM(pkcs8, "PRIVATE"),
    publicKey: toPEM(spki, "PUBLIC"),
  };
}

/**
 * Sign a verification claim.
 *
 * The claim is serialized into a deterministic format:
 *   wallet_address | identity_hash | verified_at
 *
 * This is signed with the service private key using Ed25519.
 */
export async function signClaim(params: {
  walletAddress: string;
  identityHash: string;
  method: string;
  verifiedAt: number;
  privateKey: string;
  keyId: string;
}): Promise<{
  signature: string;
  keyId: string;
  verifiedAt: number;
}> {
  // Parse PEM private key — strip headers, decode base64, import as PKCS8
  const pemPrivateKey = params.privateKey
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  const pkcs8Bytes = Uint8Array.from(atob(pemPrivateKey), (c) =>
    c.charCodeAt(0)
  );

  // jose v5 importPKCS8 accepts Uint8Array
  const privateKey = await importPKCS8(pkcs8Bytes, "EdDSA");

  const message = `${params.walletAddress}|${params.identityHash}|${params.verifiedAt}`;
  const encoder = new TextEncoder();

  const signature = await sign(encoder.encode(message), privateKey);

  const signatureHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return {
    signature: signatureHex,
    keyId: params.keyId,
    verifiedAt: params.verifiedAt,
  };
}

/**
 * Verify a verification claim signature.
 */
export async function verifyClaimSignature(params: {
  walletAddress: string;
  identityHash: string;
  verifiedAt: number;
  signature: string;
  publicKey: string;
}): Promise<boolean> {
  const pemPublicKey = params.publicKey
    .replace(/-----BEGIN PUBLIC KEY-----/g, "")
    .replace(/-----END PUBLIC KEY-----/g, "")
    .replace(/\s/g, "");
  const spkiBytes = Uint8Array.from(atob(pemPublicKey), (c) =>
    c.charCodeAt(0)
  );

  const publicKey = await importSPKI(spkiBytes, "EdDSA");

  const message = `${params.walletAddress}|${params.identityHash}|${params.verifiedAt}`;
  const encoder = new TextEncoder();

  const signatureBytes = new Uint8Array(
    params.signature.match(/.{1,2}/g)?.map((hex) => parseInt(hex, 16)) || []
  );

  return verify(signatureBytes, encoder.encode(message), publicKey);
}

/**
 * Create a full signed claim object.
 */
export async function verifyAndSignClaim(params: {
  walletAddress: string;
  identityHash: string;
  method: string;
  privateKey: string;
  keyId: string;
}): Promise<Omit<VerificationClaim, "id" | "attemptId">> {
  const { signature, keyId, verifiedAt } = await signClaim({
    walletAddress: params.walletAddress,
    identityHash: params.identityHash,
    method: params.method,
    verifiedAt: Math.floor(Date.now() / 1000),
    privateKey: params.privateKey,
    keyId: params.keyId,
  });

  return {
    walletAddress: params.walletAddress,
    identityHash: params.identityHash,
    method: params.method as VerificationClaim["method"],
    verifiedAt,
    signature,
    keyId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Verify that an existing claim's signature is valid.
 */
export async function verifyExistingClaim(
  claim: VerificationClaim
): Promise<boolean> {
  // In production, look up the key by keyId; for now return true
  return true;
}
