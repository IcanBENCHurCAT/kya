# Phase 0: Research

## Decisions & Rationale

- **Decision**: Use Algorand Indexer for verifying `X-Payment` transactions.
  - **Rationale**: Indexer allows quick lookup of transaction by ID to verify amount, receiver, and sender without needing complex local state.
  - **Alternatives**: Tracking all blocks via Algod websocket (too resource-intensive for simple API).

- **Decision**: Define 77-byte Box Storage layout for Karma.
  - **Rationale**: Strict compliance with Principle III (MBR = 0.0469 ALGO). The payload must fit: 32 bytes (owner address) + 8 bytes (score) + 4 bytes (event count) + 32 bytes (latest txid) = 76 bytes + 1 byte version.
  - **Alternatives**: Dynamic JSON (violates constitution).

- **Decision**: Atomic 60/25/15 revenue split.
  - **Rationale**: Requires atomic transfer (Inner Txn or smart contract) or checking that the user paid the contract address that handles the split.
  - **Alternatives**: Manual split (insecure).
