## 2025-05-18 - Unverified Claim Signatures in Existing Claim Verification
**Vulnerability:** `verifyExistingClaim` in `src/utils/crypto.ts` unconditionally returned `true` without verifying the cryptographic signature of the verification claim against a public key.
**Learning:** Placeholder implementation stubs (`return true`) during initial development can easily leak into production code, bypassing cryptographic proof verification.
**Prevention:** Ensure cryptographic helper functions strictly require and validate signatures against public keys instead of returning fallback boolean constants.

## 2025-05-18 - Missing Wallet Address Validation in Claim Completion Route
**Vulnerability:** `POST /verify/email/complete` in `src/routes/verification-routes.ts` processed `walletAddress` parameters without verifying address validity or format using `isValidAddress`.
**Learning:** Custom hand-written regexes for Algorand addresses can be fragile and fail checksum/Base32 validation. Using standard library functions like `algosdk.isValidAddress` ensures complete validation across all routes.
**Prevention:** Always validate wallet address parameters across all verification completion endpoints using official SDK helper functions (`algosdk.isValidAddress`).

## 2025-05-18 - Unchecked Environment Bindings in Hono Request Context
**Vulnerability:** Routes in `src/routes/screening.ts` destructured `c.env` directly (e.g. `const { WATCHLIST } = c.env;`), causing unhandled runtime `TypeError` exceptions and potential Denial of Service (DoS) when requests executed without an attached environment object.
**Learning:** In Hono, `c.env` can be `undefined` depending on the runtime or server setup. Direct destructuring or property access on `c.env` without fallbacks triggers unhandled server errors.
**Prevention:** Always access environment bindings defensively using fallbacks or optional chaining (`const { WATCHLIST } = c.env || {}; const watchlist = WATCHLIST || {};`).
