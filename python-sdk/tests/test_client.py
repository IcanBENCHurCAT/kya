import pytest
from kya_client import KyaClient

def test_kya_client_init():
    client = KyaClient(base_url="http://localhost:3000", payment_txid="tx_123")
    assert client.base_url == "http://localhost:3000"
    assert client.payment_txid == "tx_123"

def test_headers():
    client = KyaClient(base_url="http://localhost:3000", payment_txid="tx_123")
    headers = client._get_headers()
    assert headers["X-Payment"] == "tx_123"
    assert headers["Content-Type"] == "application/json"
