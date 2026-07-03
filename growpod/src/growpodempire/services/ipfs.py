"""IPFS metadata service — uploads NFT metadata JSON to IPFS.

Supports both Pinata (production) and local IPFS node (dev).
Falls back gracefully if IPFS is unavailable.
"""

import json
import os
from typing import Optional

import requests


class IPFSService:
    """IPFS upload client supporting Pinata and local nodes."""

    def __init__(self):
        self.pinata_jwt = os.getenv("PINATA_JWT")
        self.ipfs_api_url = os.getenv("IPFS_API_URL", "http://localhost:5001")
        self.use_pinata = bool(self.pinata_jwt)

    def upload_metadata(self, metadata: dict) -> Optional[str]:
        """Upload metadata JSON to IPFS. Returns IPFS hash (Qm...) or None on failure.

        Args:
            metadata: dict to serialize and upload

        Returns:
            IPFS hash string (e.g., "QmXxxx...") or None if upload fails
        """
        json_data = json.dumps(metadata)

        if self.use_pinata:
            return self._upload_to_pinata(json_data)
        else:
            return self._upload_to_local(json_data)

    def _upload_to_pinata(self, json_str: str) -> Optional[str]:
        """Upload to Pinata (managed IPFS hosting)."""
        try:
            files = {"file": ("metadata.json", json_str, "application/json")}
            headers = {"Authorization": f"Bearer {self.pinata_jwt}"}
            response = requests.post(
                "https://api.pinata.cloud/pinning/pinFileToIPFS",
                files=files,
                headers=headers,
                timeout=10,
            )
            if response.status_code == 200:
                return response.json().get("IpfsHash")
        except Exception as e:
            print(f"Pinata upload failed: {e}")
        return None

    def _upload_to_local(self, json_str: str) -> Optional[str]:
        """Upload to local IPFS node."""
        try:
            files = {"file": ("metadata.json", json_str)}
            response = requests.post(
                f"{self.ipfs_api_url}/api/v0/add",
                files=files,
                timeout=10,
            )
            if response.status_code == 200:
                return response.json().get("Hash")
        except Exception as e:
            print(f"Local IPFS upload failed: {e}")
        return None

    def get_metadata(self, ipfs_hash: str) -> Optional[dict]:
        """Fetch metadata from IPFS by hash."""
        try:
            response = requests.get(
                f"https://gateway.pinata.cloud/ipfs/{ipfs_hash}",
                timeout=5,
            )
            if response.status_code == 200:
                return response.json()
        except Exception:
            pass
        return None
