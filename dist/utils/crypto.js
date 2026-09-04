/**
 * Cryptographic utilities for claim signing and verification.
 *
 * Uses Ed25519 (via jose library) for:
 * - Generating service key pairs for signing claims
 * - Signing claims with the service private key
 * - Verifying claims with the service public key
 */
import { generateKeyPair, importPKCS8, exportPKCS8, exportSPKI, importSPKI, CompactSign, compactVerify, } from "jose";
/**
 * Generate a new Ed25519 key pair for signing claims.
 * Returns PEM-encoded private and public keys.
 */
export async function generateSigningKey() {
    const { privateKey, publicKey } = await generateKeyPair("EdDSA");
    // jose v5 exportPKCS8/exportSPKI return PEM strings directly
    const pkcs8 = await exportPKCS8(privateKey);
    const spki = await exportSPKI(publicKey);
    return {
        privateKey: pkcs8,
        publicKey: spki,
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
export async function signClaim(params) {
    // jose v5 importPKCS8 takes a PEM string directly (not decoded bytes)
    const privateKey = await importPKCS8(params.privateKey, "EdDSA");
    const message = `${params.walletAddress}|${params.identityHash}|${params.verifiedAt}`;
    const encoder = new TextEncoder();
    // Use jose v5 CompactSign API for EdDSA signing
    const signer = new CompactSign(new TextEncoder().encode(message));
    signer.setProtectedHeader({ alg: "EdDSA" });
    const jws = await signer.sign(privateKey);
    // Extract signature from JWS (part after second dot) and convert to hex
    const signatureHex = Buffer.from(jws.split(".")[2], "base64url").toString("hex");
    return {
        signature: signatureHex,
        keyId: params.keyId,
        verifiedAt: params.verifiedAt,
    };
}
/**
 * Verify a verification claim signature.
 */
export async function verifyClaimSignature(params) {
    // jose v5 importSPKI takes a PEM string directly (not decoded bytes)
    const publicKey = await importSPKI(params.publicKey, "EdDSA");
    const message = `${params.walletAddress}|${params.identityHash}|${params.verifiedAt}`;
    // Reconstruct the compact JWS: base64url(header).base64url(payload).base64url(signature)
    const signatureBytes = Uint8Array.from(params.signature.match(/.{1,2}/g)?.map((hex) => parseInt(hex, 16)) || []);
    const base64urlSignature = Buffer.from(signatureBytes).toString("base64url");
    const base64urlMessage = Buffer.from(message).toString("base64url");
    const base64urlHeader = Buffer.from(JSON.stringify({ alg: "EdDSA" })).toString("base64url");
    const jws = `${base64urlHeader}.${base64urlMessage}.${base64urlSignature}`;
    try {
        const result = await compactVerify(jws, publicKey);
        // Verify the payload matches the expected message
        const decoded = new TextDecoder().decode(result.payload);
        return decoded === message;
    }
    catch {
        return false;
    }
}
/**
 * Create a full signed claim object.
 */
export async function verifyAndSignClaim(params) {
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
        method: params.method,
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
export async function verifyExistingClaim(claim, publicKey) {
    if (!publicKey || !claim.signature) {
        return false;
    }
    return verifyClaimSignature({
        walletAddress: claim.walletAddress,
        identityHash: claim.identityHash,
        verifiedAt: claim.verifiedAt,
        signature: claim.signature,
        publicKey,
    });
}
