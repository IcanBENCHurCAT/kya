## 2025-05-18 - Unverified Claim Signatures in Existing Claim Verification
**Vulnerability:** `verifyExistingClaim` in `src/utils/crypto.ts` unconditionally returned `true` without verifying the cryptographic signature of the verification claim against a public key.
**Learning:** Placeholder implementation stubs (`return true`) during initial development can easily leak into production code, bypassing cryptographic proof verification.
**Prevention:** Ensure cryptographic helper functions strictly require and validate signatures against public keys instead of returning fallback boolean constants.
