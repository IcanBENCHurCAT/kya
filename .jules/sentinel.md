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

## 2025-05-18 - Type Confusion in ZK Proof Signal Validation
**Vulnerability:** `verifyProof` in `src/services/zkp.ts` checked `publicSignals` using strict string equality (`sig === '0'`), which allowed numeric signals (`[0]`) in JSON payloads to bypass invalid signal rejection and grant unauthorized Karma credit and tier upgrades.
**Learning:** JSON parsers parse unquoted numbers as JavaScript `number` types. Strict string comparison (`=== '0'`) against numeric values evaluates to `false`, allowing type confusion to bypass security filters.
**Prevention:** Always validate runtime types of input array elements (e.g., `typeof sig !== 'string'`) and normalize/trim values before evaluating against security exclusion rules.

## 2025-05-18 - Verification Level Policy Bypass in A2A Handshake
**Vulnerability:** `POST /a2a/handshake` in `src/routes/a2a.ts` dropped `requiredVerificationLevel` from request payloads, and `A2AService.executeHandshake` failed to evaluate `requiredVerificationLevel` against target agent tiers, issuing `PROCEED` decisions and W3C VCs to agents with insufficient verification levels.
**Learning:** When endpoint routes silently drop policy parameters from incoming JSON bodies, risk evaluation engines default to permissive decisions regardless of caller security requirements.
**Prevention:** Always validate and forward required security policy parameters from HTTP handlers, and explicitly check target profile tiers against caller requirements before returning `PROCEED` decisions.
