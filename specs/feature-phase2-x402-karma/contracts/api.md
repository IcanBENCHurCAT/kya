# Interface Contracts

## REST API Endpoints

### Unauthenticated (Any gated route)
- **Response**: `402 Payment Required`
- **Body**:
  ```json
  {
    "priceMicroAlgo": 1000,
    "receiverAddress": "ALGO_ADDRESS",
    "expiresInSeconds": 300
  }
  ```

### `POST /api/v1/karma/event`
- **Headers**: `X-Payment: <txid>`
- **Body**:
  ```json
  {
    "agentAddress": "ALGO_ADDRESS",
    "eventType": "CREDIT",
    "amount": 10,
    "reason": "Successful service completion"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "score": 10,
    "totalEvents": 1
  }
  ```

### `GET /api/v1/karma/:address`
- **Headers**: `X-Payment: <txid>`
- **Response**: `200 OK`
  ```json
  {
    "score": 10,
    "totalEvents": 1,
    "lastUpdated": "2026-08-08T12:00:00Z"
  }
  ```
