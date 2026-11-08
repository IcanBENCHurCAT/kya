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

## 2025-05-18 - SSRF Bypass via Wildcard DNS Services and Embedded IP Subdomains
**Vulnerability:** `isValidCallbackUrl` in `src/verification/webhook.ts` evaluated hostname prefixes and direct IP matches but permitted wildcard DNS resolution domains (e.g., `.nip.io`, `.sslip.io`, `.localtest.me`) and subdomains with embedded private/loopback IPv4 addresses (e.g., `sub.127.0.0.1.domain.com`), allowing SSRF bypasses to local and internal network endpoints.
**Learning:** Checking hostname prefixes or exact string matches is insufficient for callback URL validation when public wildcard DNS services resolve arbitrary subdomain IP representations to internal loopback or private addresses.
**Prevention:** Always check for wildcard DNS domains and extract embedded IPv4 sequences from hostname labels to validate against forbidden private, loopback, link-local, and cloud metadata IP ranges.

## 2025-05-18 - Unvalidated Callback URL in Verification Provider
**Vulnerability:** `initiateVerification` in `src/verification/providers/email-provider.ts` accepted and persisted `callbackUrl` parameters without validating them via `isValidCallbackUrl`, allowing invalid, private, or loopback URLs to be stored as verification attempts.
**Learning:** Validating input parameters exclusively in HTTP route handlers leaves direct service calls and internal provider layer methods exposed to invalid or SSRF callback URLs.
**Prevention:** Always perform strict callback URL validation using `isValidCallbackUrl` directly at the provider / service layer boundary.

## 2025-05-18 - Unbounded Non-Integer Event Amounts in Karma Ledger Route
**Vulnerability:** `POST /api/v1/karma/event` checked `typeof amount === 'number'` and `amount > 0` without validating integer type or upper bound caps, allowing float precision loss and score corruption DoS attacks via massive numeric inputs (e.g. `1e20`).
**Learning:** In JavaScript, `typeof number` and `Number.isFinite()` allow floating-point and oversized numbers that exceed `Number.MAX_SAFE_INTEGER`, causing loss of precision in arithmetic calculations.
**Prevention:** Always validate numeric transaction/ledger amounts with `Number.isInteger(amount)` and bound them with an explicit maximum upper cap (`amount <= MAX_AMOUNT`).

## 2025-05-18 - Premature State Destruction Before Validation in Verification Flow
**Vulnerability:** `completeVerification` in `src/verification/providers/email-provider.ts` deleted active OTP attempt records (`deleteAttempt`) BEFORE validating whether the target wallet address was already verified (`hasClaim`). This allowed attackers or user errors to invalidate active OTP attempts upon 409 Conflict errors.
**Learning:** Destroying temporary authentication or verification attempt state before completing all business logic validation checks causes state loss and enables attempt invalidation DoS attacks.
**Prevention:** Always complete all state validation checks (e.g. checking existing claim records) BEFORE destroying temporary attempt or session records.

## 2025-05-18 - Reflection of Untrusted Input in Identifier Validation Error
**Vulnerability:** `EmailVerificationProvider.validateIdentifier` in `src/verification/providers/email-provider.ts` concatenated raw untrusted input strings directly into thrown `Error` objects (`throw new Error(`Invalid email address: ${identifier}`)`), reflecting un-sanitized user input into application error logs and causing `VerificationService` endpoints to fail with HTTP 500 Internal Server Errors instead of structured 400 Bad Request responses.
**Learning:** Interpolating unvalidated client input into error messages creates log reflection/injection risks and bypasses structured error code routing in HTTP handlers when errors lack `.code` and `.status` properties.
**Prevention:** Throw structured error objects with generic error messages and explicit error codes (`code: "INVALID_IDENTIFIER"`, `status: 400`) instead of interpolating untrusted input into generic Error message strings.

## 2025-05-18 - Missing Global Exception Handler Exposes Internal Error Details
**Vulnerability:** Uncaught exceptions in mounted Hono sub-app endpoints (such as database query errors or unexpected runtime exceptions) defaulted to Hono's fallback error handler, which could leak internal error details, system file paths, or database URLs to clients.
**Learning:** In modular Hono applications with sub-apps mounted under `/api/v1`, uncaught exceptions without local `try...catch` handlers propagate up to the root app instance and require an explicit `app.onError` middleware to sanitize responses.
**Prevention:** Always register a global `app.onError` exception handler on the root Hono application instance to intercept uncaught route errors and return generic HTTP 500 JSON error responses without disclosing internal error details.

## 2025-05-18 - Unhandled Null or Non-Array Watchlist Inputs in Screening Engine
**Vulnerability:** `screenSanctions` and `screenBulk` in `src/services/screening.ts` processed `lists` registries, `entries` lists, and `entry` items without verifying object and array types, causing unhandled `TypeError` exceptions and service crashes (DoS) when encountering malformed or null watchlist data structures.
**Learning:** Assuming sanctions watchlist registry objects, entry arrays, or individual entry properties (`nationalIds`, `aliases`, `addresses`) are always non-null arrays leads to uncaught `TypeError: Cannot read properties of null` or `Cannot read properties of undefined` exceptions during screening loops.
**Prevention:** Perform explicit `typeof` and `Array.isArray()` checks on watchlist registry entries and nested array properties before iterating or reading properties in matching engines.

## 2025-05-18 - SSRF Bypass via IPv4-Compatible IPv6 Representations in Webhook Validation
**Vulnerability:** `isValidCallbackUrl` in `src/verification/webhook.ts` stripped `::ffff:` for IPv4-mapped IPv6 addresses but did not unwrap IPv4-compatible IPv6 addresses (`::...` or `0:0:0:0:0:0:...` without `ffff:`), allowing loopback (`[::127.0.0.1]`), cloud metadata (`[::169.254.169.254]`), and private subnets (`[::10.0.0.1]`) to bypass SSRF validation when Node's URL parser canonicalized them to 2-segment hex pairs (`[::7f00:1]`, `[::a9fe:a9fe]`).
**Learning:** WHATWG URL canonicalizes dotted-decimal IPv4 inside IPv6 brackets into hex words (`[::127.0.0.1]` -> `[::7f00:1]`). If IPv6 hex unwrapping requires an exact `::ffff:` prefix or splits on colon without stripping leading `::`, 2-word IPv4 representations evade conversion and bypass subnet boundary checks.
**Prevention:** Always strip leading `::` or `0:0:0:0:0:0:` prefixes from IPv6 hostnames before parsing terminal 2-segment hex pairs into dotted-decimal IPv4 notation for subnet boundary evaluation.

## 2025-05-19 - Missing Content Security Policy Directives in Secure Headers Middleware
**Vulnerability:** In `src/app.ts`, `secureHeaders()` was invoked without custom options, omitting the `Content-Security-Policy` header on HTML and API responses and leaving endpoints vulnerable to Cross-Site Scripting (XSS), malicious script injections, and clickjacking/framing.
**Learning:** Default invocation of security middleware like Hono's `secureHeaders()` sets basic transport headers (e.g. HSTS, nosniff, frame-options) but defaults `contentSecurityPolicy` to unset, requiring explicit directive configurations tailored to the application's assets and inline script usage.
**Prevention:** Always explicitly define strict `contentSecurityPolicy` directives (`default-src`, `script-src`, `style-src`, `img-src`, `connect-src`, `frame-ancestors 'none'`, `object-src 'none'`) when mounting security header middleware.

## 2026-11-01 - SSRF Bypass via NAT64/SIIT IPv6 Representations and Unchecked CGNAT Ranges
**Vulnerability:** `isValidCallbackUrl` in `src/verification/webhook.ts` failed to unwrap IPv4 addresses embedded in NAT64 (`64:ff9b::/96`, `64:ff9b:1::/96`) and SIIT (`::ffff:0:0/96`) IPv6 addresses (canonicalized by WHATWG URL parsers to terminal 2-hex segments like `[64:ff9b::7f00:1]`), and omitted RFC 6598 Carrier-Grade NAT (`100.64.0.0/10`), Alibaba Cloud metadata (`100.100.100.200`), benchmarking (`198.18.0.0/15`), multicast, and reserved IP ranges from the forbidden IPv4 regex.
**Learning:** Modern networking stacks and clouds utilize translation prefixes (such as RFC 6052 NAT64) and CGNAT subnets for internal VPC communication. Standard regexes that only check standard RFC 1918 ranges allow attackers to target cloud VPC services, container networks, and metadata endpoints via alternate IPv6-mapped or CGNAT notations.
**Prevention:** Always inspect terminal 2-hex segments for any embedded IPv6 translation prefixes (`64:ff9b::`, `::ffff:0:`) and strictly block CGNAT (`100.64.0.0/10`), provider-specific metadata IPs (`100.100.100.200`), documentation ranges, and multicast/reserved subnets.

## 2026-11-02 - x402 Payment Gate Bypass via NaN and Non-Finite Numeric Comparison Inversions
**Vulnerability:** `verifyPaymentTransaction` in `src/middleware/x402.ts` verified on-chain payment transactions using `Number(confirmedRound) <= 0` and `typeof amount !== "number" || amount < minPriceMicroAlgo`. When indexer responses contained non-numeric strings or `NaN` (e.g. `confirmedRound = "unconfirmed"`, `amount = NaN`), `typeof NaN === "number"` evaluated to `true`, and both `NaN <= 0` and `NaN < minPriceMicroAlgo` evaluated to `false`, allowing unconfirmed transactions and zero/invalid payments to bypass verification and access protected endpoints without paying.
**Learning:** In JavaScript/TypeScript, relational comparisons (`<`, `<=`, `>`, `>=`) with `NaN` always return `false`. Checking `typeof val === "number"` and `val < threshold` fails to reject `NaN`, and `Number(str) <= 0` fails to reject non-numeric strings because `NaN <= 0` is false.
**Prevention:** Always use `Number.isInteger(num)` and strictly enforce positive bounds (`num > 0` and `num >= minThreshold`) when validating financial amounts and confirmation rounds.

## 2026-11-03 - Resource Starvation DoS via Indefinite Outbound Webhook HTTP Fetch Stalls
**Vulnerability:** `WebhookService.sendWithRetry` in `src/verification/webhook.ts` executed outbound `fetch` calls to user-supplied callback endpoints without configuring a request timeout or abort signal, allowing slowloris or unresponsive target servers to hold open TCP connections and retain pending promises/buffers indefinitely.
**Learning:** In modern Node.js runtimes, `fetch` calls lack default connection and response timeouts. When external callers provide arbitrary valid callback URLs, a malicious server that delays responding can exhaust available socket handles and heap memory across asynchronous webhook retry workers.
**Prevention:** Always attach an explicit timeout signal (`signal: AbortSignal.timeout(timeoutMs)`) to outbound `fetch` requests and ensure timeout errors trigger structured retry and backoff handling.

## 2026-11-04 - Unbounded In-Memory Cryptographic Key Caches Memory Exhaustion DoS
**Vulnerability:** `pkcs8KeyCache` and `spkiKeyCache` in `src/utils/crypto.ts` stored WebCrypto key promises in unbounded module-level `Map` instances without capacity limits. Callers supplying distinct or rotated public keys during claim verification could cause indefinite memory growth and process crash via heap exhaustion.
**Learning:** Memoizing parsed cryptographic keys (e.g. via `importSPKI`) drastically reduces parsing CPU overhead, but caching without bounding allows attackers or high-churn key rotations to trigger Denial of Service (DoS) through memory leak exhaustion.
**Prevention:** Always bound cryptographic key caches with capacity caps (`MAX_KEY_CACHE_CAP = 1000`) and enforce FIFO or LRU eviction before inserting new key promises.

## 2026-11-05 - Socket Starvation DoS via Indefinite Outbound Email Provider HTTP Stalls
**Vulnerability:** `sendEmail` in `src/utils/email.ts` invoked outbound `fetch("https://api.resend.com/emails", ...)` without an `AbortSignal` timeout, allowing slow or unresponsive external API connections to hold open TCP sockets, retain promises, and cause resource starvation during email OTP verification flows.
**Learning:** Outbound HTTP requests to external third-party service providers (like Resend) in Node.js do not time out by default. If the provider hangs or network degradation occurs, pending asynchronous operations accumulate and exhaust process resources.
**Prevention:** Always configure an explicit request timeout (`signal: AbortSignal.timeout(timeoutMs)`) on outbound external API calls and provide configurable timeout defaults (`DEFAULT_EMAIL_TIMEOUT_MS = 10_000`).

## 2026-11-06 - OTP Rate Limit Bypass via Email Identifier Case-Sensitivity Variations
**Vulnerability:** In `VerificationService.initiateVerification` and `EmailVerificationProvider.initiateVerification`, email identifiers were queried against rate limiting stores (`getRecentAttemptCount`) and stored in verification attempt records without case normalization or whitespace trimming. Attackers could bypass hourly OTP rate limits (10/hr) by varying uppercase/lowercase characters in the email (e.g. `User@example.com` vs `user@example.com`), enabling email bombing and third-party delivery quota exhaustion.
**Learning:** Rate-limiting stores using exact string key lookups (such as JavaScript `Map` or PostgreSQL `=` queries) treat casing variations as distinct keys. Since email providers route all casing variations to the same inbox, case-sensitive rate limiting allows abuse.
**Prevention:** Always normalize email identifiers to canonical lowercase and trimmed format (`email.toLowerCase().trim()`) before evaluating rate limits, persisting verification challenges, and dispatching OTP notifications.

## 2026-11-08 - Highest Reputation Tier Granted to NaN and Non-Finite Karma Scores
**Vulnerability:** In `KarmaService.calculateTier` (`src/services/karma.ts`), score checks sequentially evaluated `score < 300`, `score < 600`, and `score < 850`. For `NaN`, `undefined`, or non-numeric inputs, all relational `<` comparisons evaluated to `false`, falling through to unconditionally return the highest reputation tier (`Tier 3 (Seasoned)`). Additionally, `recordEvent` lacked defensive parameter checks, allowing `NaN` amounts to corrupt agent scores to `NaN`.
**Learning:** In JavaScript and TypeScript, relational comparisons (`<`, `<=`, `>`, `>=`) with `NaN` always return `false`. When tier or permission calculations use a cascade of `< threshold` checks with the highest tier as the fallback return statement, `NaN` values bypass all lower tiers and default directly to maximum privilege or highest reputation.
**Prevention:** Always validate that numeric scores and inputs are finite numbers (`typeof score === 'number' && Number.isFinite(score)`) before performing relational threshold comparisons, and default invalid, non-finite, or non-numeric inputs securely to the lowest unverified tier (`Tier 0 (Unscored)`).
