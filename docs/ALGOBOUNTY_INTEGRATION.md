# Algo-Bounty Steward Verification Integration Playbook

This document specifies how to integrate KYA's (Know Your Agent) identity verification flow into a consumer backend (like `algo-bounty` built with FastAPI) to properly verify Stewards according to your protocol's constitution.

## Overview

A "Steward" must verify their identity before they can take critical actions on the bounty platform. Instead of simply setting `steward_verified = True` in your database without actual proof, you can integrate with KYA to provide email-based OTP verification.

The end-to-end integration flow looks like this:
1. **Initiate Verification:** The consumer backend initiates an OTP request to KYA with the Steward's email and Algorand wallet address.
2. **Complete Verification:** The consumer backend receives the OTP from the user and forwards it to KYA to complete verification.
3. **Handle Status:** If successful, KYA returns a signed claim. The consumer backend maps this success to the local `steward_verified` flag.
4. **Sanctions Screening (Optional):** Screen the Steward's wallet and beneficial owner against OFAC sanctions.
5. **Record Karma (Optional):** Reward or track the Steward via KYA Karma ledger.

---

## 1. Initiating Email Verification

When a user attempts to register as a Steward, instead of immediately marking them verified, you must start the KYA verification flow.

**Endpoint:** `POST /api/v1/verify/email/initiate`
**Payload:**
```json
{
  "email": "steward@example.com",
  "walletAddress": "YOUR_ALGORAND_WALLET_ADDRESS"
}
```

**Response:**
Returns an `attemptId` which must be passed to the client (or temporarily stored in your DB) for the second step.
```json
{
  "attemptId": "uuid-string-here"
}
```

## 2. Completing Verification

Once the user receives the OTP in their email, they submit it to your FastAPI backend. Your backend forwards this to KYA.

**Endpoint:** `POST /api/v1/verify/email/complete`
**Payload:**
```json
{
  "attemptId": "uuid-string-here",
  "code": "123456",
  "walletAddress": "YOUR_ALGORAND_WALLET_ADDRESS"
}
```

**Response:**
On success (HTTP 200), KYA will return a claim object indicating the verification succeeded.
```json
{
  "claim": {
     "id": "claim-uuid",
     "walletAddress": "YOUR_ALGORAND_WALLET_ADDRESS",
     "identityHash": "sha256-hash",
     "method": "email",
     "verifiedAt": "2023-10-10T12:00:00Z",
     "signature": "base64-signature"
  },
  "isNew": true
}
```
**Handling State in your Backend:** 
- If KYA responds with HTTP 200, mark `steward_verified = True` in your local database.
- If KYA responds with HTTP 400 (e.g., "Code expired or maximum attempts reached", "Invalid verification code"), or 403, 404, etc., return a failure to the user and keep `steward_verified = False`.

## 3. Querying Existing Status

If you need to check if a wallet is already verified (for example, on login), use the check endpoint.

**Endpoint:** `GET /api/v1/verify/wallet/:address`

**Response:**
```json
{
  "walletAddress": "YOUR_ALGORAND_WALLET_ADDRESS",
  "isVerified": true,
  "claimCount": 1,
  "latestMethod": "email",
  "latestVerifiedAt": "2023-10-10T12:00:00Z",
  "latestIdentityHash": "sha256-hash"
}
```

## 4. Sanctions Screening

As part of your compliance flow, you should screen the Steward's wallet.

**Endpoint:** `POST /api/v1/screen`
**Payload:**
```json
{
  "address": "YOUR_ALGORAND_WALLET_ADDRESS",
  "beneficialOwner": "Jane Doe" 
}
```
*(beneficialOwner is optional)*

If the wallet is flagged, you should reject the Steward registration.

## 5. Recording Karma

If you want to track steward reliability or reward their verified registration, record a Karma event.

**Endpoint:** `POST /api/v1/karma/event`
**Payload:**
```json
{
  "agentAddress": "YOUR_ALGORAND_WALLET_ADDRESS",
  "eventType": "credit",
  "amount": 100,
  "reason": "Steward verified registration"
}
```

---

## Minimal FastAPI Reference Implementation

Below is a reference implementation for `algo-bounty`'s `agents.py` router using KYA's python SDK (`kya-client`).

```python
import os
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from kya_client import KyaClient
from requests.exceptions import RequestException

router = APIRouter()
KYA_SERVICE_URL = os.getenv("KYA_SERVICE_URL", "http://localhost:3000")
kya = KyaClient(KYA_SERVICE_URL)

# Request Models
class InitiateVerificationRequest(BaseModel):
    email: str
    wallet_address: str

class CompleteVerificationRequest(BaseModel):
    attempt_id: str
    code: str
    wallet_address: str

class RegisterStewardRequest(BaseModel):
    wallet_address: str
    name: str

# Endpoints
@router.post("/steward/verify/initiate")
def initiate_steward_verification(req: InitiateVerificationRequest):
    """Step 1: Initiate KYA email OTP"""
    try:
        # Returns {"attemptId": "..."}
        return kya.initiate_email_verification(req.email, req.wallet_address)
    except RequestException as e:
        status = e.response.status_code if e.response else 500
        detail = e.response.json().get("error", str(e)) if e.response else "Internal error"
        raise HTTPException(status_code=status, detail=detail)

@router.post("/steward/verify/complete")
def complete_steward_verification(req: CompleteVerificationRequest):
    """Step 2: Complete KYA OTP and mark Steward as verified"""
    
    # 1. Screen wallet first
    try:
        screen_data = kya.screen_wallet(req.wallet_address)
        if screen_data.get("riskLevel") in ["high", "critical"] or screen_data.get("flagged"):
            raise HTTPException(status_code=403, detail="Wallet failed sanctions screening")
    except RequestException as e:
        # If screening fails completely, we might want to fail safe and reject
        raise HTTPException(status_code=500, detail="Sanctions screening failed")

    # 2. Complete Verification
    try:
        resp = kya.complete_email_verification(req.attempt_id, req.code, req.wallet_address)
        
        # Success! 
        # TODO: Here you update your local DB to mark steward_verified = True
        # e.g., db.execute("UPDATE stewards SET steward_verified = True WHERE wallet = ?", [req.wallet_address])
        
        # 3. Optional: Record Karma for verified registration
        kya.record_karma_event(
            agent_address=req.wallet_address,
            event_type="credit",
            amount=50,
            reason="Steward identity verified"
        )

        return {"status": "success", "message": "Steward verified successfully"}

    except RequestException as e:
        status = e.response.status_code if e.response else 500
        detail = e.response.json().get("error", str(e)) if e.response else "Internal error"
        raise HTTPException(status_code=status, detail=detail)

```
