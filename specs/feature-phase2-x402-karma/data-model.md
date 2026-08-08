# Data Model

## Entities

### AgentProfile
- `agentAddress` (String/Address, PK)
- `karmaScore` (Integer, default 0)
- `tier` (String)
- `registeredAt` (Timestamp)
- `ownerHash` (String)

### KarmaEvent
- `id` (UUID, PK)
- `agentAddress` (String/Address, FK)
- `eventType` (Enum: CREDIT, DEBIT, EMIT)
- `amount` (Integer)
- `reason` (String)
- `timestamp` (Timestamp)
- `txid` (String)

### X402Receipt
- `receiptId` (UUID, PK)
- `txid` (String, unique)
- `payerAddress` (String/Address)
- `amountMicroAlgo` (Integer)
- `endpoint` (String)
- `timestamp` (Timestamp)

## Supabase Tables
Defined in `002_karma_ledger.sql` with RLS policies enabled.
