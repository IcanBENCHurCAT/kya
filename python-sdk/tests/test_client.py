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

from unittest.mock import patch, MagicMock
import requests

def test_get_karma_success():
    client = KyaClient(base_url="http://localhost:3000")
    address = "TESTADDRESS12345"
    expected_data = {"address": address, "karmaScore": 750, "status": "active"}

    mock_response = MagicMock()
    mock_response.json.return_value = expected_data
    mock_response.raise_for_status.return_value = None

    with patch("requests.get", return_value=mock_response) as mock_get:
        res = client.get_karma(address)

        mock_get.assert_called_once_with(
            "http://localhost:3000/api/v1/karma/TESTADDRESS12345",
            headers={"Content-Type": "application/json"}
        )
        assert res == expected_data

def test_get_karma_with_payment_txid():
    client = KyaClient(base_url="http://localhost:3000", payment_txid="tx_payment_999")
    address = "TESTADDRESS12345"
    expected_data = {"address": address, "karmaScore": 800}

    mock_response = MagicMock()
    mock_response.json.return_value = expected_data

    with patch("requests.get", return_value=mock_response) as mock_get:
        res = client.get_karma(address)

        mock_get.assert_called_once_with(
            "http://localhost:3000/api/v1/karma/TESTADDRESS12345",
            headers={"Content-Type": "application/json", "X-Payment": "tx_payment_999"}
        )
        assert res == expected_data

def test_get_karma_error_status():
    client = KyaClient(base_url="http://localhost:3000")
    address = "UNKNOWNADDRESS"

    mock_response = MagicMock()
    mock_response.raise_for_status.side_effect = requests.exceptions.HTTPError("404 Client Error: Not Found")

    with patch("requests.get", return_value=mock_response):
        with pytest.raises(requests.exceptions.HTTPError):
            client.get_karma(address)
