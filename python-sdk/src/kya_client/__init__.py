"""
KYA Service Python Client Library (`kya-client`)
"""

import requests
from typing import Dict, Any, Optional

class KyaClient:
    def __init__(self, base_url: str, payment_txid: Optional[str] = None):
        self.base_url = base_url.rstrip('/')
        self.payment_txid = payment_txid

    def set_payment_txid(self, txid: str) -> None:
        self.payment_txid = txid

    def _get_headers(self) -> Dict[str, str]:
        headers = {'Content-Type': 'application/json'}
        if self.payment_txid:
            headers['X-Payment'] = self.payment_txid
        return headers

    def get_karma(self, address: str) -> Dict[str, Any]:
        """Fetch Karma profile and score for an agent address."""
        url = f"{self.base_url}/api/v1/karma/{address}"
        response = requests.get(url, headers=self._get_headers())
        response.raise_for_status()
        return response.json()

    def record_karma_event(
        self, agent_address: str, event_type: str, amount: int, reason: str, txid: Optional[str] = None
    ) -> Dict[str, Any]:
        """Record a Karma credit, debit, or emit event."""
        url = f"{self.base_url}/api/v1/karma/event"
        payload = {
            "agentAddress": agent_address,
            "eventType": event_type,
            "amount": amount,
            "reason": reason,
        }
        if txid:
            payload["txid"] = txid
        response = requests.post(url, json=payload, headers=self._get_headers())
        response.raise_for_status()
        return response.json()

    def execute_a2a_handshake(
        self, initiator_address: str, target_address: str, min_karma_score: int = 600
    ) -> Dict[str, Any]:
        """Execute A2A pre-flight trust handshake before dispatching funds or claiming bounties."""
        url = f"{self.base_url}/api/v1/a2a/handshake"
        payload = {
            "initiatorAddress": initiator_address,
            "targetAddress": target_address,
            "minKarmaScore": min_karma_score,
        }
        response = requests.post(url, json=payload, headers=self._get_headers())
        response.raise_for_status()
        return response.json()

    def submit_zk_proof(self, agent_address: str, proof: Dict[str, Any], public_signals: list) -> Dict[str, Any]:
        """Submit Groth16 Zero-Knowledge KYC proof payload."""
        url = f"{self.base_url}/api/v1/verify/zk-proof"
        payload = {
            "agentAddress": agent_address,
            "proof": proof,
            "publicSignals": public_signals,
        }
        response = requests.post(url, json=payload, headers=self._get_headers())
        response.raise_for_status()
        return response.json()

    def screen_wallet(self, address: str, beneficial_owner: Optional[str] = None) -> Dict[str, Any]:
        """Screen wallet address against OFAC SDN sanctions lists."""
        url = f"{self.base_url}/api/v1/screen"
        payload = {"address": address}
        if beneficial_owner:
            payload["beneficialOwner"] = beneficial_owner
        response = requests.post(url, json=payload, headers=self._get_headers())
        response.raise_for_status()
        return response.json()
