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

## 2025-05-18 - Unhandled Type Confusion in Address and Payload Verification Routes
**Vulnerability:** `POST /api/v1/karma/event`, `POST /api/v1/verify/zk-proof`, `POST /verify/email/initiate`, and `POST /verify/email/complete` accepted non-string JSON inputs (e.g., objects, numbers) and passed them directly to `isValidAddress` or `bcrypt.compareSync`, triggering unhandled `TypeError` exceptions and HTTP 500 server errors.
**Learning:** Checking truthiness (`!param`) on JSON payload values is insufficient because non-string JSON values like `{}` or `123` evaluate as truthy, causing SDK and cryptographic library functions expecting strings to throw unhandled runtime exceptions.
**Prevention:** Always perform explicit `typeof param === 'string'` and length bound checks before passing JSON payload inputs to third-party SDK routines or cryptographic comparison functions.

## 2025-05-18 - Unvalidated Screening Configuration Overrides Bypass Sanctions Screening
**Vulnerability:** `POST /api/v1/screen` and `POST /api/v1/screen/bulk` allowed client payloads to supply arbitrary `config` overrides without type or range checks. Invalid numeric thresholds (e.g., `failThreshold: "invalid"` or `failThreshold: 999`) caused score evaluation `highestScore >= settings.failThreshold` to evaluate to `false`, returning `NO_MATCH_FOUND` for sanctioned targets.
**Learning:** Merging unvalidated client JSON objects directly into internal configuration objects enables callers to manipulate threshold logic, bypass compliance gates, or inject malformed properties.
**Prevention:** Always strictly validate and bound client-supplied configuration overrides (enforcing type checks, finite numbers, and range limits [0, 1]) before merging into business logic options.

## 2025-05-18 - Uppercase Hex Rejection in Identity Hash Verification Lookup
**Vulnerability:** `GET /verify/identity/:hash` in `src/routes/verification-routes.ts` validated SHA-256 identity hash parameters using strict lowercase regex `/^[0-9a-f]{64}$/`, causing uppercase hex hashes (e.g. `E3B0...`) to be rejected with HTTP 400 errors and breaking identity lookups.
**Learning:** SHA-256 hexadecimal representations can be generated in uppercase or lowercase depending on the client environment. Validating strict lowercase hex without parameter normalization breaks valid identity hash checks.
**Prevention:** Always convert hex input parameters to lowercase using `.toLowerCase()` before applying regex validation and querying hash indexes.

## 2025-05-18 - Call Stack Overflow in Persistent Audit Log Loading
**Vulnerability:** `loadAuditLog` in `src/services/audit.ts` used spread argument syntax `auditLog.push(...data)` when loading audit entries from JSON storage on disk, causing `RangeError: Maximum call stack size exceeded` crashes when the audit log contained large record counts (>= 125,000 entries).
**Learning:** In V8 and JavaScript runtimes, spreading arrays (`...array`) converts elements into function arguments on the call stack, hitting engine argument limits (~65k-125k arguments) and causing application startup crashes.
**Prevention:** Always use explicit iterative loops or chunked batch processing instead of argument spread syntax when populating arrays from external files or unbounded datasets.

## 2025-05-18 - Unhandled Null or Non-Object Input Crashes in Sanctions Watchlist Parsers
**Vulnerability:** `parseOFACJSON` and `parseOFACCSV` in `src/services/ofac.ts` processed external or unit-test payload inputs without verifying input types or object element bounds, causing unhandled `TypeError` exceptions and service crashes when receiving `null`, primitive, or non-object payload structures.
**Learning:** Assuming external data feeds or parser arguments are always valid non-null objects leads to uncaught `TypeError: Cannot read properties of null` exceptions when handling network feed anomalies or malformed inputs.
**Prevention:** Always perform explicit `typeof` and `Array.isArray()` checks at parser boundaries before accessing properties or invoking array methods.

## 2025-05-18 - Unbounded In-Memory Wallet Identities Store Memory Exhaustion
**Vulnerability:** `walletIdentities` Map in `src/services/resolution.ts` grew unbounded as callers invoked `registerWalletIdentity` via `POST /api/v1/register`, allowing unauthenticated Denial of Service (DoS) attacks via memory exhaustion.
**Learning:** In-memory maps populated by external API endpoints must be bounded using capacity caps and FIFO/LRU eviction to prevent heap allocation exhaustion.
**Prevention:** Always enforce a capacity limit (`MAX_CAP = 10000`) and FIFO eviction on in-memory Map stores populated by API requests.
