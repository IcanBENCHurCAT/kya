# Feature Specification: On-Chain Karma Hardening & Non-Custodial Trust Infrastructure (KYA v3.0)

**Feature Branch**: `feature/phase5-onchain-karma-hardening`

**Created**: 2026-08-23

**Status**: Draft

**Input**: User description: "make sure you have latest from origin and then /speckit-specify - On-chain Karma software and smart contract architecture with legal, game-theoretic, and blockchain investor hardening"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Bilateral Point-of-Sale Screening with Strict Fail-Closed Watchlist Reliability (Priority: P1)

As an autonomous AI agent or client application, I want to submit micro-payments directly to the KYA Gateway for point-of-sale screening and identity risk evaluation without third-party fund routing or custody, so that my queries are executed compliantly under a strict fail-closed security posture (returning standard service error if official upstream watchlists become unreachable) and accompanied by non-reliance probabilistic risk disclosures.

**Why this priority**: Core operational integrity. Prevents criminal strict liability exposure and money transmission violations by establishing pure bilateral SaaS bandwidth billing and eliminating false-clear responses during upstream feed outages.

**Independent Test**: Can be fully tested by querying the screening endpoint under simulated feed failure (confirming `503 Service Unavailable` fail-closed behavior with zero mock fallback) and with valid x402 payments (confirming probabilistic scoring output and signed verifiable credential issuance).

**Acceptance Scenarios**:

1. **Given** official sanctions data feeds are live and responsive, **When** an agent pays the micro-fee and submits a target identifier, **Then** the service returns probabilistic confidence scores, raw matching vectors, and a cryptographically signed verification credential containing standard regulatory disclaimers.
2. **Given** official sanctions data feeds are unreachable or stale past the freshness window, **When** an agent submits a screening request, **Then** the service immediately rejects the query with a service unavailable status rather than falling back to unverified mock lists.

---

### User Story 2 - Composable On-Chain Reputation Verification with Versioned Box Storage (Priority: P2)

As a decentralized smart contract or autonomous bounty escrow, I want to synchronously inspect a counterparty agent's on-chain Karma score, verification tier, and risk flags within the same atomic transaction group, so that my smart contract can enforce risk-based collateral requirements, credit limits, and execution authorizations without relying on off-chain centralized oracles.

**Why this priority**: Essential blockchain utility. Without synchronous on-chain read composability, on-chain box storage provides no unique technical justification over free off-chain verifiable credentials.

**Independent Test**: Can be fully tested by deploying an escrow contract that executes an atomic read against the agent's reputation box before releasing escrowed funds, verifying execution gating based on threshold scores.

**Acceptance Scenarios**:

1. **Given** an agent with a valid on-chain reputation box meeting minimum score thresholds, **When** a smart contract reads the box during an atomic transaction group, **Then** the transaction executes successfully and emits a standardized audit event.
2. **Given** an agent with insufficient score or active risk flags, **When** the smart contract inspects the box, **Then** the atomic execution reverts with a policy violation error.

---

### User Story 3 - Anti-Whitewashing & Challenge-Locked Registration Reclamation (Priority: P3)

As an honest participant in the agent economy, I want rogue or slashed agents to be prevented from costlessly wiping their negative reputation by deleting and immediately recreating identities, so that bad actors cannot repeatedly exploit task counterparties without enduring unbonding delay windows or loss of storage deposits upon defecting.

**Why this priority**: Prevents sybil churn and game-theoretic whitewashing loops where the cost of identity disposal is zero.

**Independent Test**: Can be fully tested by flagging an agent profile for non-performance, initiating deregistration, and verifying that the storage deposit is locked in a dispute challenge window rather than refunded immediately.

**Acceptance Scenarios**:

1. **Given** an honest agent in good standing, **When** the agent initiates deregistration, **Then** the storage deposit enters an unbonding challenge window and is fully refunded upon completion of the holding period without disputes.
2. **Given** an agent with verified breach of contract or active sanctions flags, **When** deregistration is triggered, **Then** the storage deposit is forfeit/burned rather than returned.

---

### User Story 4 - Rate-Bounded Dynamic Price Discovery & Anti-Proxying Verification (Priority: P4)

As the protocol gateway operator, I want dynamic discounts earned by high-reputation agents to be cryptographically bound to their own signing keys and bounded by transaction volume caps, so that high-karma agents cannot operate unauthorized discount resale proxies that allow malicious low-reputation actors to bypass risk pricing.

**Why this priority**: Protects protocol economic revenue and maintains the deterrent effect of risk penalties against malicious or unverified actors.

**Independent Test**: Can be fully tested by attempting to submit queries from mismatched signing keys or exceeding query-to-stake volume limits, confirming that the effective discount decays gracefully to zero.

**Acceptance Scenarios**:

1. **Given** a high-reputation agent submitting requests with matching cryptographic request signatures, **When** the query volume is within normal operational limits, **Then** the discounted fee is applied.
2. **Given** a query burst exceeding the volume-to-stake threshold, **When** additional queries are submitted, **Then** the dynamic discount scales down toward base pricing to eliminate resale arbitrage margins.

---

### User Story 5 - Multi-Source Behavioral Karma & Pluggable Oracle Ingestion (Priority: P2)

As an autonomous agent, I want my Karma score to reflect positive behavioral track records from diverse activities—including direct native protocol interactions (such as passing ZK-KYC attestations, running verified hardware enclaves, and maintaining dispute-free operational history) as well as signed attestations from trusted third-party oracles (such as compute platforms, prediction markets, DEX market making, and future bounty protocols like algo-bounty)—so that my reputation is portable, decentralized, and not dependent on any single centralized platform.

**Why this priority**: Decouples KYA from any single downstream application, enabling immediate standalone utility for rewarding good behavior while remaining future-proof for third-party platforms.

**Independent Test**: Can be tested by awarding karma credits via native behavioral events (e.g. ZK identity verification) and via simulated authorized third-party oracle attestations, verifying that composite scores aggregate with proper source weightings.

**Acceptance Scenarios**:

1. **Given** an agent completes a native behavioral milestone (such as a valid ZK-KYC proof submission), **When** the event is processed, **Then** the agent's karma score is incremented with the corresponding native behavioral weighting and emitted on-chain.
2. **Given** an authorized third-party oracle submits a signed positive performance attestation, **When** the cryptographic signature and source authority are verified, **Then** the agent's reputation box is credited with the source-calibrated weight.

---

### User Story 6 - Self-Hosted Node Operator Deployment & Decentralized Gateway Rewards (Priority: P2)

As a community node operator or cloud developer, I want to easily deploy an open-source, containerized instance of the KYA Gateway to my own cloud infrastructure (OCI, AWS, GCP, or bare-metal) with my own payout wallet configured, so that I can serve compliance traffic to autonomous agents, contribute to network decentralization, and directly earn 100% of the x402 micro-payment query fees paid by clients routed through my gateway node.

**Why this priority**: Decentralizes the compliance infrastructure, eliminates single-operator point-of-failure vulnerabilities, and establishes permissionless open-source economic incentives for community operators.

**Independent Test**: Can be tested by launching a fresh Docker container with custom environment variables (`KYA_TREASURY_ADDRESS=<operator_wallet>`), issuing a paid x402 screening request, and verifying that the micro-payment settles directly into the operator's wallet while providing full screening and karma verification services.

**Acceptance Scenarios**:

1. **Given** a new node operator cloning the open-source repository, **When** they run the standardized container launcher with their Algorand address, **Then** the service boots in production mode, downloads live watchlists, and immediately serves x402-gated requests.
2. **Given** an AI agent directing an API query to a community node operator's endpoint, **When** the x402 payment challenge is satisfied on-chain, **Then** the micro-funds settle directly to the operator's configured address and the verification payload is returned.

---

### Edge Cases

- What happens when upstream watchlist feeds undergo unexpected network partitioning? The system fails closed with explicit error messaging.
- How does the system handle smart contract schema upgrades? The box layout includes an explicit version byte prefix that enables backwards compatibility and lazy migrations on write.
- What happens when an inactive agent leaves storage locked indefinitely? An automated lifecycle tombstone mechanism allows garbage collection of unbonded inactive records after their reputation half-life.
- What happens when a self-hosted node operator runs an out-of-date image? Nodes publish version and watchlist timestamp metadata on `/.well-known/agent-card.json` allowing agent clients to verify freshness before routing requests.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST process point-of-sale micro-payments strictly as direct bilateral compensation for computational services, never acting as an escrow or custodian of third-party transaction funds.
- **FR-002**: Sanctions screening engine MUST operate under a fail-closed architecture, terminating with service error codes upon upstream feed timeout rather than using mock or static fallback data in production.
- **FR-003**: System MUST provide probabilistic risk evaluation metrics alongside raw signal indicators rather than absolute punitive legal declarations.
- **FR-004**: Verifiable credentials emitted by the system MUST incorporate standard legal disclaimers stating that outputs represent informational algorithmic heuristics and not statutory legal certifications.
- **FR-005**: On-chain reputation records MUST utilize a version-prefixed binary layout supporting atomic inspection by external smart contracts.
- **FR-006**: On-chain storage records MUST contain privacy-preserving zero-knowledge verification nullifiers rather than static, un-salted, or reversible personal identity hashes.
- **FR-007**: System MUST enforce an unbonding challenge window on storage deposit refunds upon agent deregistration.
- **FR-008**: System MUST support standardized on-chain event emission for all registration, update, and flag state transitions.
- **FR-009**: Payment gateway MUST verify that the cryptographic signature over request payloads matches the paying identity to prevent proxy arbitrage.
- **FR-010**: Fee discount calculations MUST include volume-saturation decay factors based on 24-hour query counts relative to bonded stake.
- **FR-011**: On-chain reputation score decay MUST follow a deterministic temporal half-life during periods of operational dormancy.
- **FR-012**: System MUST provide an automated tombstone mechanism to sweep and reclaim storage allocations for abandoned inactive profiles.
- **FR-013**: System MUST provide a dispute submission and resolution flow for contested performance flags before permanent reputation degradation.
- **FR-014**: New agent onboarding MUST provide a progressive risk multiplier curve and verifiable sandbox progression to prevent cold-start deadlocks.
- **FR-015**: All smart contract state modifications MUST support ABI-compliant standard interfaces.
- **FR-016**: System MUST support a pluggable, multi-source behavioral Karma scoring model that ingests positive reputation signals from:
  - Direct protocol behaviors (e.g., successful ZK-KYC verification, sustained fault-free API usage, unbonding without incident, sandbox challenge completions);
  - Authorized third-party oracle attestations (e.g., decentralized compute providers, task escrows, prediction markets, and future bounty platforms);
  - Weighted composite aggregation that prevents single-oracle manipulation.
- **FR-017**: All external karma events MUST include cryptographically verifiable source origins and reason codes.
- **FR-018**: System MUST support fully reproducible, 1-click open-source container deployment (Docker / Compose / Terraform) allowing any independent operator to host a gateway node.
- **FR-019**: Gateway node configuration MUST allow operators to specify their own direct payout address (`KYA_TREASURY_ADDRESS`), ensuring 100% of x402 revenue generated by their node flows directly to them without intermediary rent extraction.

### Key Entities

- **Agent Identity**: Represents an autonomous entity characterized by its cryptographic public key, verification level, and zero-knowledge verification nullifier.
- **Reputation Box Record**: The on-chain binary state containing version identifier, composite karma score, bonded stake, risk bitmask, and lifecycle timestamps.
- **Karma Attestation Source**: An authorized oracle or native subsystem that emits signed behavioral reputation events with calibrated weightings.
- **Node Operator**: An independent community host operating an open-source KYA Gateway instance to earn direct x402 fee rewards.
- **Sanctions Assertion**: A point-in-time compliance evaluation containing matched watchlist identifiers, fuzzy confidence metrics, and cryptographic timestamp proof.
- **Dispute Escrow**: A temporary holding state for bonded collateral and storage deposits undergoing performance verification or unbonding cooldowns.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of screening operations during upstream feed degradation terminate with fail-closed errors with zero false-clear mock responses emitted.
- **SC-002**: External smart contracts can synchronously read an agent's reputation state within a single atomic transaction group in under 15 milliseconds.
- **SC-003**: Zero raw personal data or reversible identity hashes stored on public immutable blockchain state.
- **SC-004**: 100% of proxying and discount arbitrage attempts with mismatched payload keys are detected and rejected at the gateway.
- **SC-005**: Storage deposit reclamation attempts undergo mandatory holding verification with zero immediate unbonding leaks on contested profiles.
- **SC-006**: New honest agents can complete identity initialization and sandbox progression within 60 minutes without requiring manual human administrative intervention.
- **SC-007**: Authorized external oracles and native behavioral subsystems can submit signed karma credit events with end-to-end verification in under 5 seconds.
- **SC-008**: An independent community node operator can deploy and launch a fully functional, revenue-generating KYA gateway node in under 5 minutes using provided container templates.

## Assumptions

- Autonomous agents have standard cryptographic key generation and message-signing capabilities.
- Third-party blockchain networks support atomic transaction grouping and state inspection primitives.
- Upstream public sanctions data feeds provide standard cryptographic or TLS authenticity attestations.
- Storage deposits remain fully recoverable upon completion of unbonding dispute periods for non-malicious actors.
- Karma scoring is agnostic to specific bounty platforms and designed to aggregate behavioral signals from any authorized oracle or native action.
- The platform remains fully open-source (AGPL-3.0), permitting permissionless node deployment with direct operator revenue capture.
