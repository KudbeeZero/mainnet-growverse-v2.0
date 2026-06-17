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
import time
from typing import Optional

logger = logging.getLogger(__name__)

_AUDIO_PREFIX = "audio"
_SIDECAR_TOKEN_URL = "http://127.0.0.1:1106/token"

# How many seconds before token expiry we consider the token stale and refresh.
_TOKEN_REFRESH_MARGIN = 60

# Fallback TTL (seconds) when the sidecar response omits ``expires_in``.
_TOKEN_DEFAULT_TTL = 3600

# Module-level bucket cache: (bucket_handle, expiry_monotonic_seconds)
# expiry == 0.0 means "no valid cache".
_bucket_cache: tuple = (None, 0.0)


def _bucket_id() -> Optional[str]:
    return os.environ.get("DEFAULT_OBJECT_STORAGE_BUCKET_ID")


def is_available() -> bool:
    """Return True if App Storage is configured (bucket env var is set)."""
    return bool(_bucket_id())


def _get_access_token() -> Optional[tuple]:
    """Fetch a short-lived GCS access token from the Replit sidecar.

    Returns ``(token_str, expiry_monotonic)`` on success, ``None`` on failure.
    Retries **once** before giving up so a transient sidecar hiccup does not
    immediately break the entire prewarm run.
    """
    last_exc = None
    for attempt in range(1, 3):
        try:
            import requests as _req

            resp = _req.post(_SIDECAR_TOKEN_URL, timeout=5)
            resp.raise_for_status()
            data = resp.json()
            token = data.get("access_token")
            if not token:
                logger.warning(
                    "object_storage: sidecar returned no access_token (attempt %d/2)", attempt
                )
                continue
            expires_in = float(data.get("expires_in", _TOKEN_DEFAULT_TTL))
            expiry = time.monotonic() + expires_in
            return token, expiry
        except Exception as exc:
            last_exc = exc
            logger.warning(
                "object_storage: failed to fetch sidecar token (attempt %d/2): %s",
                attempt,
                exc,
            )

    logger.warning("object_storage: giving up on sidecar token after 2 attempts: %s", last_exc)
    return None


def _get_bucket():
    """Return a GCS bucket handle authenticated via the Replit sidecar.

    The bucket and its credentials are **cached** for the lifetime of the token.
    A new sidecar round-trip is only made when the cached token has less than
    ``_TOKEN_REFRESH_MARGIN`` seconds left, keeping a prewarm of N courses at
    O(1) sidecar calls instead of O(N).

    If token refresh fails and a stale bucket handle exists, the stale handle
    is returned so callers can still attempt GCS operations (the underlying
    ``_SidecarCreds.refresh()`` will retry at the GCS level).  Returns ``None``
    only when there is no cached handle at all and the sidecar is unreachable.
    """
    global _bucket_cache

    bucket_id = _bucket_id()
    if not bucket_id:
        return None

    cached_bucket, expiry = _bucket_cache
    if cached_bucket is not None and time.monotonic() < expiry - _TOKEN_REFRESH_MARGIN:
        return cached_bucket

    result = _get_access_token()
    if result is None:
        if cached_bucket is not None:
            logger.warning(
                "object_storage: token refresh failed; reusing stale bucket handle"
            )
            return cached_bucket
        return None

    token, token_expiry = result
    try:
        from google.oauth2.credentials import Credentials
        from google.cloud import storage as gcs

        # Wrap the short-lived bearer token.  The GCS client calls
        # creds.refresh() when it detects expiry; we re-fetch from the sidecar.
        class _SidecarCreds(Credentials):
            def refresh(self, request) -> None:  # type: ignore[override]
                res = _get_access_token()
                if res:
                    self.token = res[0]

        creds = _SidecarCreds(token=token)
        client = gcs.Client(credentials=creds, project="replit")
        bucket = client.bucket(bucket_id)
        _bucket_cache = (bucket, token_expiry)
        return bucket
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
