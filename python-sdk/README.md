# KYA Python Client Library (`kya-client`)

Python client library for integrating **KYA (Know Your Agent)** service into Python backends (FastAPI Gateway in `algo-bounty`), CLI tools, and autonomous AI agent frameworks (ElizaOS, AutoGen, LangChain).

---

## 🛠️ Installation

```bash
pip install kya-client
```

---

## 🚀 Quickstart

```python
from kya_client import KyaClient

client = KyaClient(base_url="http://localhost:3000", payment_txid="OPTIONAL_X402_TXID")

# 1. Check Agent Karma Profile
profile = client.get_karma("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")
print(f"Karma Score: {profile['karma']['score']}, Tier: {profile['karma']['tier']}")

# 2. Execute A2A Handshake before Escrow Claim (algo-bounty)
handshake = client.execute_a2a_handshake(
    initiator_address="CREATOR_ADDRESS...",
    target_address="WORKER_ADDRESS...",
    min_karma_score=600
)

if handshake["decision"] == "PROCEED":
    print("A2A Handshake Passed! W3C VC Passport:", handshake["verifiableCredential"])
else:
    print("Handshake Rejected!")
```

---

## 📜 License

AGPL-3.0-or-later — See LICENSE file.
