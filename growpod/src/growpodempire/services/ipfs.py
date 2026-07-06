"""IPFS metadata service — uploads NFT metadata JSON to IPFS.

Selection mirrors the chain provider switch (`chain/factory.py`): a real
Pinata pin when `PINATA_JWT` is configured (production), a real local IPFS
node when `IPFS_API_URL` is explicitly set (self-hosted dev/staging), and
otherwise a deterministic OFFLINE mock hash so local dev/tests/CI never make
a network call or depend on a daemon that probably isn't running. Going live
is a config change only: set `PINATA_JWT` (get one free at pinata.cloud) and
nothing else needs to change in code. See docs/TESTNET_SETUP.md.
"""

import hashlib
import json
import logging
import os
from typing import Optional

import requests

logger = logging.getLogger(__name__)


class IPFSService:
    """IPFS upload client supporting Pinata, a local node, and an offline mock."""

    def __init__(self):
        self.pinata_jwt = os.getenv("PINATA_JWT")
        # Unset by default (no implicit localhost:5001 attempt) — an operator
        # running a self-hosted IPFS node must opt in explicitly.
        self.ipfs_api_url = os.getenv("IPFS_API_URL")
        self.use_pinata = bool(self.pinata_jwt)
        self.use_local_node = bool(self.ipfs_api_url) and not self.use_pinata

    def upload_metadata(self, metadata: dict) -> Optional[str]:
        """Upload metadata JSON to IPFS. Returns IPFS hash (Qm...) or None on failure.

        Args:
            metadata: dict to serialize and upload

        Returns:
            IPFS hash string (e.g., "QmXxxx...") or None if upload fails
        """
        json_data = json.dumps(metadata, sort_keys=True)

        if self.use_pinata:
            return self._upload_to_pinata(json_data)
        if self.use_local_node:
            return self._upload_to_local(json_data)
        return self._mock_hash(json_data)

    def _mock_hash(self, json_str: str) -> str:
        """Deterministic, offline, CID-shaped placeholder.

        NOT a real IPFS hash and nothing is actually pinned anywhere — this
        only runs when neither PINATA_JWT nor IPFS_API_URL is configured, so
        dev/tests/CI get a stable value with zero network dependency, same as
        MockChainProvider for the chain side.
        """
        digest = hashlib.sha256(json_str.encode("utf-8")).hexdigest()
        return f"Qm{digest[:44]}"

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
        except Exception:
            logger.warning("Pinata upload failed", exc_info=True)
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
        except Exception:
            logger.warning("Local IPFS upload failed", exc_info=True)
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
            logger.debug("IPFS metadata fetch failed", exc_info=True)
        return None
