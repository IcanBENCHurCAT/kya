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

## 2025-05-18 - Invalid Supabase Object Update Syntax Bypasses OTP Rate Limiting
**Vulnerability:** `incrementAttempt` in `src/verification/attempt-store.ts` passed `{ attempt_count: { increment: 1 } }` to Supabase `update()`. PostgREST serialized this as JSON object `{ "increment": 1 }`, causing PostgreSQL to throw an integer type error, silently fail the update, and allow attackers to brute force 6-digit OTP codes without hitting attempt limits.
**Learning:** PostgREST/Supabase JavaScript client does not support object expressions like `{ increment: 1 }` for numeric database columns. Unhandled DB errors in update calls result in silent rate-limiting bypasses.
**Prevention:** Always fetch current records to compute explicit numeric increments or use database RPC functions when updating numeric counts with Supabase.

## 2025-05-18 - Server-Side Request Forgery (SSRF) and Weak URL Validation in Webhooks
**Vulnerability:** `POST /verify/email/initiate` validated `callbackUrl` using simple `startsWith("http")` string check, and `WebhookService` dispatched POST requests without checking target hostnames. This allowed callers to specify loopback (`127.0.0.1`, `localhost`), private IP ranges (`10.x`, `172.16-31.x`, `192.168.x`), and cloud metadata IPs (`169.254.169.254`) as webhook targets.
**Learning:** Checking string prefixes like `startsWith("http")` is insufficient for outbound HTTP request targets because loopback, internal IPs, and cloud metadata services use valid `http://` or `https://` URLs.
**Prevention:** Always validate callback URLs with `new URL()`, enforce `http:`/`https:` schemes, and block loopback, private IPv4/IPv6 subnets, cloud metadata IPs, and internal domain names (`.local`, `.internal`) before sending outbound requests.

## 2025-05-18 - Unbounded Array Flooding in ZK Proof Verification Payload
**Vulnerability:** `verifyProof` in `src/services/zkp.ts` checked array types for `publicSignals` and proof point arrays (`pi_a`, `pi_b`, `pi_c`) without enforcing maximum array length or element string length bounds, enabling Denial of Service (DoS) attacks via memory exhaustion and CPU starvation during array iteration.
**Learning:** Array type checking (`Array.isArray()`) without strict length caps allows malicious payloads with oversized nested arrays to consume excessive CPU cycles and memory during processing loops.
**Prevention:** Always bound array lengths (e.g. `publicSignals.length <= 100`, `proof.pi_a.length <= 10`) and individual string element lengths (`<= 255`) before iterating over payload arrays.

## 2025-05-18 - SSRF Bypass via IPv6-Mapped IPv4 and IPv6 Loopback Addresses in Webhooks
**Vulnerability:** `isValidCallbackUrl` in `src/verification/webhook.ts` checked exact string matches for `127.0.0.1` and `/^169\.254\./` without unwrapping IPv6-mapped IPv4 representations (e.g. `[::ffff:127.0.0.1]`, `[::ffff:169.254.169.254]`) or checking extended IPv4 loopback ranges (`127.0.0.0/8`) and IPv6 unspecified/loopback (`[::]`), allowing SSRF bypasses to cloud metadata and internal services.
**Learning:** URL parsers represent IPv6-mapped IPv4 addresses in hex notation (`[::ffff:7f00:1]`), which bypass naive regex and literal hostname filters while resolving to internal IPv4 network addresses during HTTP requests.
**Prevention:** Extract embedded IPv4 addresses from IPv6-mapped IPv4 representations (`::ffff:`) before checking against forbidden private, loopback (`127.0.0.0/8`), link-local (`169.254.0.0/16`), and metadata IP ranges.

## 2025-05-18 - Unbounded In-Memory Karma Ledger Store Memory Exhaustion
**Vulnerability:** `InMemoryKarmaStore` in `src/services/karma.ts` stored agent profiles and event arrays in un-bounded `Map` instances, allowing unauthenticated Denial of Service (DoS) attacks via memory exhaustion when receiving high-volume karma queries or event POST requests.
**Learning:** In-memory fallback stores populated by public API endpoints will grow indefinitely unless explicit capacity caps and FIFO/LRU eviction mechanisms are enforced at the data store level.
**Prevention:** Always bound in-memory profile maps (`MAX_PROFILES_CAP = 10000`) and per-agent event history arrays (`MAX_EVENTS_PER_AGENT_CAP = 1000`) with FIFO eviction across all stateful service stores.

## 2025-05-18 - SSRF Bypass via Non-Canonical IPv4 Representations in Webhooks
**Vulnerability:** `isValidCallbackUrl` in `src/verification/webhook.ts` evaluated hostname strings against regex prefix patterns (e.g. `/^127\./`, `/^10\./`) without normalizing non-canonical IPv4 representations (octal `0177.0.0.1`, hex `0x7f.0.0.1`, DWORD integer `2130706433`, or truncated 1/2/3-part formats).
**Learning:** URL parsers pass hostname strings through to HTTP client libraries without normalizing octal/hex/integer formats, allowing attackers to bypass prefix regex filters while `fetch` resolves the host to loopback (`127.0.0.1`) or private network addresses.
**Prevention:** Normalize all IPv4 hostname representations into standard 4-octet dotted-decimal notation (`A.B.C.D`) before checking against forbidden private, loopback, link-local, and metadata IP ranges.

## 2025-05-18 - Unbounded In-Memory OTP Attempt and Claim Stores Memory Exhaustion
**Vulnerability:** `InMemoryAttemptStore` and `InMemoryClaimStore` in `src/verification/` stored OTP verification attempts and claims in unbounded `Map` and secondary index `Set` structures without capacity caps, enabling unauthenticated Denial of Service (DoS) attacks via memory exhaustion when running without database credentials.
**Learning:** In-memory fallback stores that maintain secondary index maps (e.g. `byIdentifier`, `byWallet`, `byIdentityHash`) must evict entries from both primary storage and secondary indexes when capacity caps are reached to prevent memory leaks and inconsistent index state.
**Prevention:** Always bound in-memory attempt and claim stores with capacity caps (`MAX_CAP = 10000`), perform FIFO eviction on primary maps, and clean up corresponding entries from secondary index sets.
