# Quickstart & Validation

1. **Start the API in dev mode**:
   ```bash
   npm run dev
   ```

2. **Verify x402 payment challenge**:
   ```bash
   curl -i http://localhost:3000/api/v1/karma/SOME_ADDRESS
   # Expect: HTTP/1.1 402 Payment Required
   ```

3. **Verify Payment Authentication**:
   ```bash
   curl -i -H "X-Payment: VALID_TXID" http://localhost:3000/api/v1/karma/SOME_ADDRESS
   # Expect: HTTP/1.1 200 OK
   ```

4. **Verify Health endpoint (exempt)**:
   ```bash
   curl -i http://localhost:3000/health
   # Expect: HTTP/1.1 200 OK
   ```
