"""
Offline coverage for the honest, non-network logic in
``growpodempire.ai.object_storage``.

These tests deliberately cover ONLY the pure path builder, the config/guard
branches, and the bucket-unavailable early-returns. They do NOT mock
``google.cloud.storage``, ``google.oauth2``, or ``requests`` — the live GCS /
sidecar paths (``_get_access_token`` network round-trip and the real
upload/download) are the documented live boundary and are intentionally left
uncovered here.

To reach the bucket-unavailable guards without any network call we force
``_get_bucket()`` to return ``None`` the honest way: either by ensuring
``DEFAULT_OBJECT_STORAGE_BUCKET_ID`` is unset (so ``_get_bucket`` returns at the
``if not bucket_id`` line before touching the SDK) or by monkeypatching our own
module-level ``_get_bucket``.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import growpodempire.ai.object_storage as obj  # noqa: E402


# --------------------------------------------------------------------------- #
# object_path_for — deterministic pure path builder
# --------------------------------------------------------------------------- #

def test_object_path_for_exact_format():
    assert obj.object_path_for("voiceA", "deadbeef") == "audio/voiceA_deadbeef.mp3"


def test_object_path_for_is_deterministic():
    first = obj.object_path_for("v1", "abc123")
    second = obj.object_path_for("v1", "abc123")
    assert first == second == "audio/v1_abc123.mp3"


def test_object_path_for_differs_on_voice():
    assert obj.object_path_for("v1", "h") != obj.object_path_for("v2", "h")


def test_object_path_for_differs_on_hash():
    assert obj.object_path_for("v1", "h1") != obj.object_path_for("v1", "h2")


def test_object_path_for_uses_audio_prefix():
    path = obj.object_path_for("anyvoice", "anyhash")
    assert path.startswith(obj._AUDIO_PREFIX + "/")
    assert path.endswith(".mp3")


# --------------------------------------------------------------------------- #
# is_available / _bucket_id — config branch
# --------------------------------------------------------------------------- #

def test_is_available_false_when_bucket_unset(monkeypatch):
    monkeypatch.delenv("DEFAULT_OBJECT_STORAGE_BUCKET_ID", raising=False)
    # Reset the module-level cache so prior state cannot leak in.
    monkeypatch.setattr(obj, "_bucket_cache", (None, 0.0), raising=False)
    assert obj._bucket_id() is None
    assert obj.is_available() is False


def test_is_available_true_when_bucket_set(monkeypatch):
    monkeypatch.setenv("DEFAULT_OBJECT_STORAGE_BUCKET_ID", "my-bucket")
    monkeypatch.setattr(obj, "_bucket_cache", (None, 0.0), raising=False)
    assert obj._bucket_id() == "my-bucket"
    assert obj.is_available() is True


# --------------------------------------------------------------------------- #
# _get_bucket returns None (no network) when no bucket id is configured
# --------------------------------------------------------------------------- #

def test_get_bucket_returns_none_without_bucket_id(monkeypatch):
    monkeypatch.delenv("DEFAULT_OBJECT_STORAGE_BUCKET_ID", raising=False)
    monkeypatch.setattr(obj, "_bucket_cache", (None, 0.0), raising=False)
    # No bucket id -> returns at the `if not bucket_id` guard, never touching
    # the sidecar or the Google SDK.
    assert obj._get_bucket() is None


# --------------------------------------------------------------------------- #
# gcs_put / gcs_get / gcs_exists — bucket-unavailable early-return guards
# --------------------------------------------------------------------------- #

def test_gcs_put_returns_none_when_bucket_unavailable_via_env(monkeypatch):
    monkeypatch.delenv("DEFAULT_OBJECT_STORAGE_BUCKET_ID", raising=False)
    monkeypatch.setattr(obj, "_bucket_cache", (None, 0.0), raising=False)
    assert obj.gcs_put("voice", "hash", b"\x00\x01") is None


def test_gcs_get_returns_none_when_bucket_unavailable_via_env(monkeypatch):
    monkeypatch.delenv("DEFAULT_OBJECT_STORAGE_BUCKET_ID", raising=False)
    monkeypatch.setattr(obj, "_bucket_cache", (None, 0.0), raising=False)
    assert obj.gcs_get("audio/voice_hash.mp3") is None


def test_gcs_exists_returns_false_when_bucket_unavailable_via_env(monkeypatch):
    monkeypatch.delenv("DEFAULT_OBJECT_STORAGE_BUCKET_ID", raising=False)
    monkeypatch.setattr(obj, "_bucket_cache", (None, 0.0), raising=False)
    assert obj.gcs_exists("audio/voice_hash.mp3") is False


# The same guards, forced via monkeypatching our own _get_bucket to None.
# This proves the early-return is keyed off `_get_bucket() is None` and never
# touches the Google SDK regardless of how None arises.

def test_gcs_put_guard_via_patched_get_bucket(monkeypatch):
    monkeypatch.setattr(obj, "_get_bucket", lambda: None)
    assert obj.gcs_put("v", "h", b"data") is None


def test_gcs_get_guard_via_patched_get_bucket(monkeypatch):
    monkeypatch.setattr(obj, "_get_bucket", lambda: None)
    assert obj.gcs_get("audio/v_h.mp3") is None


def test_gcs_exists_guard_via_patched_get_bucket(monkeypatch):
    monkeypatch.setattr(obj, "_get_bucket", lambda: None)
    assert obj.gcs_exists("audio/v_h.mp3") is False
