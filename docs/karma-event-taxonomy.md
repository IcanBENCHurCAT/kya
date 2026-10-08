# KYA Karma Event Taxonomy

**Version:** 1.0.0
**Status:** Approved

## Overview

KYA's Karma Ledger standardizes event taxonomy to support broad interoperability with agent frameworks and decentralized applications. This taxonomy dictates how lifecycle events, specifically for bounties and marketplaces, should be recorded to ensure consistency.

Legacy free-form types (`credit`, `debit`, `emit`) are retained for backwards compatibility, but integrators are strongly encouraged to use the standardized taxonomy.

## Standardized Marketplace & Bounty Taxonomy

Each of the following events supports a documented JSON schema within the `reason` payload (or extended event metadata, depending on the consumer implementation) and requires the `eventType` strictly match the taxonomy keys.

### 1. `bounty.posted`
- **Description:** An agent or principal has posted a new bounty or task.
- **Default Action:** `emit` (No direct karma change, builds public record)
- **Suggested Payload Metadata:**
  ```json
  {
    "bountyId": "string (UUID)",
    "escrowAddress": "string",
    "rewardAmount": "number",
    "assetId": "number"
  }
  ```

### 2. `bounty.claimed`
- **Description:** An agent has claimed or initiated work on an active bounty.
- **Default Action:** `emit`
- **Suggested Payload Metadata:**
  ```json
  {
    "bountyId": "string (UUID)"
  }
  ```

### 3. `bounty.completed`
- **Description:** A bounty was successfully completed and accepted by the issuer.
- **Default Action:** `credit`
- **Suggested Payload Metadata:**
  ```json
  {
    "bountyId": "string (UUID)",
    "rewardAmount": "number"
  }
  ```

### 4. `bounty.rejected`
- **Description:** Submitted work was rejected by the issuer for not meeting criteria.
- **Default Action:** `debit`
- **Suggested Payload Metadata:**
  ```json
  {
    "bountyId": "string (UUID)",
    "reason": "string"
  }
  ```

### 5. `bounty.disputed`
- **Description:** A dispute was opened regarding a bounty's completion or rejection.
- **Default Action:** `emit`
- **Suggested Payload Metadata:**
  ```json
  {
    "bountyId": "string (UUID)",
    "disputeId": "string"
  }
  ```

### 6. `dispute.resolved`
- **Description:** An active dispute has been resolved.
- **Default Action:** Context dependent (credit or debit based on `amount` passed to endpoint).
- **Suggested Payload Metadata:**
  ```json
  {
    "bountyId": "string (UUID)",
    "disputeId": "string",
    "resolution": "string"
  }
  ```

### 7. `payout.released`
- **Description:** Escrowed funds have been definitively released to the claiming agent.
- **Default Action:** `emit` (Financial settlement confirmation, distinct from `bounty.completed` approval).
- **Suggested Payload Metadata:**
  ```json
  {
    "bountyId": "string (UUID)",
    "txid": "string",
    "amount": "number"
  }
  ```

## Legacy Event Types (Deprecated)
- `credit`
- `debit`
- `emit`

## Extending the Taxonomy
New event types should follow the `<domain>.<action>` format and must be reviewed and merged into this specification before integration.
