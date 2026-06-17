"""
Google Cloud Storage (App Storage) helper for persisting MP3 narration files.

Uses the Replit sidecar for authentication (POST http://127.0.0.1:1106/token),
mirroring the same credential flow used by the TypeScript SDK.
The bucket is configured via DEFAULT_OBJECT_STORAGE_BUCKET_ID env var (set
automatically when App Storage is provisioned via the Replit console).

Object paths follow the pattern: audio/<voice_id>_<text_hash>.mp3

Public interface
----------------
  gcs_put(voice_id, text_hash, mp3_bytes)  -> str object_path  (uploads)
  gcs_get(object_path)                     -> bytes | None      (downloads)
  gcs_exists(object_path)                  -> bool
  is_available()                           -> bool              (bucket configured)
"""

import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

_AUDIO_PREFIX = "audio"
_SIDECAR_TOKEN_URL = "http://127.0.0.1:1106/token"


def _bucket_id() -> Optional[str]:
    return os.environ.get("DEFAULT_OBJECT_STORAGE_BUCKET_ID")


def is_available() -> bool:
    """Return True if App Storage is configured (bucket env var is set)."""
    return bool(_bucket_id())


def _get_access_token() -> Optional[str]:
    """Fetch a short-lived GCS access token from the Replit sidecar."""
    try:
        import requests as _req
        resp = _req.post(_SIDECAR_TOKEN_URL, timeout=5)
        resp.raise_for_status()
        return resp.json().get("access_token")
    except Exception as exc:
        logger.warning("object_storage: failed to fetch sidecar token: %s", exc)
        return None


def _get_bucket():
    """Return a GCS bucket handle authenticated via the Replit sidecar, or None."""
    bucket_id = _bucket_id()
    if not bucket_id:
        return None
    token = _get_access_token()
    if not token:
        return None
    try:
        from google.oauth2.credentials import Credentials
        from google.cloud import storage as gcs

        # Wrap the short-lived bearer token.  The GCS client calls
        # creds.refresh() when it detects expiry; we re-fetch from the sidecar.
        class _SidecarCreds(Credentials):
            def refresh(self, request) -> None:  # type: ignore[override]
                new_token = _get_access_token()
                if new_token:
                    self.token = new_token

        creds = _SidecarCreds(token=token)
        client = gcs.Client(credentials=creds, project="replit")
        return client.bucket(bucket_id)
    except Exception as exc:
        logger.warning("object_storage: failed to create GCS client: %s", exc)
        return None


def object_path_for(voice_id: str, text_hash: str) -> str:
    """Return the canonical GCS object name for a (voice_id, text_hash) pair."""
    return f"{_AUDIO_PREFIX}/{voice_id}_{text_hash}.mp3"


def gcs_put(voice_id: str, text_hash: str, mp3_bytes: bytes) -> Optional[str]:
    """
    Upload *mp3_bytes* to GCS and return the object path.

    Returns None if App Storage is unavailable or the upload fails.
    The returned path is suitable for storage in the DB and later retrieval
    via gcs_get().
    """
    bucket = _get_bucket()
    if bucket is None:
        return None
    path = object_path_for(voice_id, text_hash)
    try:
        blob = bucket.blob(path)
        blob.upload_from_string(mp3_bytes, content_type="audio/mpeg")
        logger.info("object_storage: uploaded %s (%d bytes)", path, len(mp3_bytes))
        return path
    except Exception as exc:
        logger.warning("object_storage: upload failed for %s: %s", path, exc)
        return None


def gcs_get(object_path: str) -> Optional[bytes]:
    """
    Download and return the MP3 bytes at *object_path*.

    Returns None if the object does not exist or the download fails.
    """
    bucket = _get_bucket()
    if bucket is None:
        return None
    try:
        blob = bucket.blob(object_path)
        if not blob.exists():
            return None
        data = blob.download_as_bytes()
        logger.info("object_storage: downloaded %s (%d bytes)", object_path, len(data))
        return data
    except Exception as exc:
        logger.warning("object_storage: download failed for %s: %s", object_path, exc)
        return None


def gcs_exists(object_path: str) -> bool:
    """Return True if the object exists in GCS."""
    bucket = _get_bucket()
    if bucket is None:
        return False
    try:
        return bucket.blob(object_path).exists()
    except Exception as exc:
        logger.warning("object_storage: exists check failed for %s: %s", object_path, exc)
        return False
