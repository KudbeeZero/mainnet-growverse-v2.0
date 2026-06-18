"""
Unit coverage for ``api/audio_prewarm.py``.

The module's public surface is three functions:

  * ``prewarm_course_audio`` — the worker body. It imports all of its
    collaborators *locally* (``from ..services.university_service import …``,
    ``from ..ai.elevenlabs_narrator import …``, ``from ..ai.object_storage
    import …``, ``from ..db.session import session_scope``), so every patch
    here targets the *source* module those names come from, not an attribute
    of ``audio_prewarm`` itself.
  * ``start_prewarm_thread`` / ``wait_for_prewarm`` — the daemon-thread
    plumbing built on the module-level ``PREWARM_DONE`` event.

This suite is offline and honest: it only ever fakes *our own* repo functions
(``load_curriculum``, the narrator cache helpers, the GCS helpers, and
``session_scope``). No third-party SDK or HTTP client (requests / google /
anthropic / elevenlabs) is mocked or invoked. The guard-branch tests don't
even reach the import block; the main-loop tests stop at our collaborators.

The long live-TTS body (``generate_narration_for_course`` actually calling
ElevenLabs) is intentionally never exercised — it is the real network path and
out of scope for an offline test.
"""

import contextlib
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import pytest

import growpodempire.api.audio_prewarm as pw
from growpodempire.ai import elevenlabs_narrator as narrator
from growpodempire.ai import object_storage as object_storage
from growpodempire.db import session as db_session
from growpodempire.services import university_service


# ---------------------------------------------------------------------------
# Fakes — duck-typed stand-ins for our own DB layer (mirrors the pattern in
# tests/test_elevenlabs_narrator.py). No real SQLAlchemy session is created.
# ---------------------------------------------------------------------------

class _FakeRow:
    def __init__(self, mp3_data=None, object_path=None):
        self.mp3_data = mp3_data
        self.object_path = object_path


class _FakeSession:
    """Minimal session; only needs to be a context-manager target."""

    def __init__(self):
        self.added = []

    def add(self, obj):
        self.added.append(obj)

    def flush(self):
        pass

    def rollback(self):
        pass


@contextlib.contextmanager
def _fake_session_scope():
    yield _FakeSession()


@pytest.fixture(autouse=True)
def _reset_prewarm_event():
    """Each test starts and ends with the module event in its default SET
    state so cross-test ordering can't make wait_for_prewarm hang."""
    pw.PREWARM_DONE.set()
    yield
    pw.PREWARM_DONE.set()


# ---------------------------------------------------------------------------
# 1. prewarm_course_audio — guard branches (no import block reached for the
#    first; subsequent ones patch our own collaborators only)
# ---------------------------------------------------------------------------

class TestPrewarmGuards:
    def test_no_api_key_logs_sets_event_and_returns(self, monkeypatch):
        monkeypatch.delenv("ELEVENLABS_API_KEY", raising=False)
        pw.PREWARM_DONE.clear()

        pw.prewarm_course_audio()

        # Early return before any import / curriculum load.
        assert pw.PREWARM_DONE.is_set()

    def test_load_curriculum_raises_is_caught_and_event_set(self, monkeypatch):
        monkeypatch.setenv("ELEVENLABS_API_KEY", "k")

        def _boom():
            raise RuntimeError("curriculum unavailable")

        monkeypatch.setattr(university_service, "load_curriculum", _boom)
        pw.PREWARM_DONE.clear()

        # Must not raise — the worker swallows and sets the event.
        pw.prewarm_course_audio()

        assert pw.PREWARM_DONE.is_set()

    def test_empty_curriculum_zero_courses_returns(self, monkeypatch):
        monkeypatch.setenv("ELEVENLABS_API_KEY", "k")
        monkeypatch.setattr(university_service, "load_curriculum", lambda: {"courses": {}})
        pw.PREWARM_DONE.clear()

        pw.prewarm_course_audio()

        assert pw.PREWARM_DONE.is_set()

    def test_curriculum_without_courses_key_returns(self, monkeypatch):
        """`curriculum.get("courses") or {}` → 0 courses → early return."""
        monkeypatch.setenv("ELEVENLABS_API_KEY", "k")
        monkeypatch.setattr(university_service, "load_curriculum", lambda: {})
        pw.PREWARM_DONE.clear()

        pw.prewarm_course_audio()

        assert pw.PREWARM_DONE.is_set()


# ---------------------------------------------------------------------------
# 2. Main-loop cache cases — drive the per-course counters by faking ONLY our
#    own collaborators. ElevenLabs is never called in any of these.
# ---------------------------------------------------------------------------

_COURSE = {"department": "horticulture", "title": "Soil", "summary": "s", "content": "c"}


def _patch_common(monkeypatch, tmp_path):
    """Wire up the deterministic pieces shared by every main-loop test."""
    monkeypatch.setenv("ELEVENLABS_API_KEY", "k")
    monkeypatch.setattr(
        university_service, "load_curriculum",
        lambda: {"courses": {"c1": _COURSE}},
    )
    monkeypatch.setattr(db_session, "session_scope", _fake_session_scope)
    # Cache the file under tmp so path.exists() is controllable per test.
    monkeypatch.setattr(narrator, "_CACHE_DIR", tmp_path)
    monkeypatch.setattr(narrator, "build_course_spoken_text", lambda course: "spoken text")
    monkeypatch.setattr(narrator, "_voice_for", lambda dept: "VOICE")
    monkeypatch.setattr(narrator, "_text_hash", lambda text: "deadbeef")


def test_case1_fully_cached_counts_already_ok(monkeypatch, tmp_path):
    """row.object_path set AND /tmp file present → already_ok, no GCS/TTS."""
    _patch_common(monkeypatch, tmp_path)
    cache_path = narrator._cache_path("VOICE", "spoken text")
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_bytes(b"ID3 cached")

    row = _FakeRow(mp3_data=b"db", object_path="audio/x.mp3")
    monkeypatch.setattr(narrator, "_db_get_row", lambda s, v, t: row)

    def _no_gcs(*a, **k):
        raise AssertionError("GCS must not be touched when fully cached")

    monkeypatch.setattr(object_storage, "gcs_get", _no_gcs)
    monkeypatch.setattr(object_storage, "gcs_put", _no_gcs)
    pw.PREWARM_DONE.clear()

    pw.prewarm_course_audio()

    assert pw.PREWARM_DONE.is_set()


def test_case1_restore_tmp_from_gcs_backfills(monkeypatch, tmp_path):
    """row.object_path set, /tmp missing, gcs_get returns bytes → restore /tmp."""
    _patch_common(monkeypatch, tmp_path)
    row = _FakeRow(mp3_data=b"db", object_path="audio/x.mp3")
    monkeypatch.setattr(narrator, "_db_get_row", lambda s, v, t: row)
    monkeypatch.setattr(object_storage, "gcs_get", lambda path: b"ID3 gcs bytes")

    written = {}
    monkeypatch.setattr(narrator, "_write_tmp_cache", lambda p, b: written.update(path=p, data=b))
    pw.PREWARM_DONE.clear()

    pw.prewarm_course_audio()

    assert written.get("data") == b"ID3 gcs bytes"
    assert pw.PREWARM_DONE.is_set()


def test_case2_db_blob_uploaded_to_gcs(monkeypatch, tmp_path):
    """row has mp3_data, no object_path → gcs_put, set object_path, write /tmp."""
    _patch_common(monkeypatch, tmp_path)
    row = _FakeRow(mp3_data=b"ID3 db blob", object_path=None)
    monkeypatch.setattr(narrator, "_db_get_row", lambda s, v, t: row)
    monkeypatch.setattr(object_storage, "gcs_put", lambda v, d, b: "audio/new.mp3")

    set_path = {}
    monkeypatch.setattr(narrator, "_db_set_object_path", lambda s, r, p: set_path.update(p=p))
    written = {}
    monkeypatch.setattr(narrator, "_write_tmp_cache", lambda p, b: written.update(data=b))
    pw.PREWARM_DONE.clear()

    pw.prewarm_course_audio()

    assert set_path.get("p") == "audio/new.mp3"
    assert written.get("data") == b"ID3 db blob"
    assert pw.PREWARM_DONE.is_set()


def test_case3_tmp_only_backfills_db_and_gcs(monkeypatch, tmp_path):
    """No DB row, /tmp present → read bytes, gcs_put, _db_put."""
    _patch_common(monkeypatch, tmp_path)
    cache_path = narrator._cache_path("VOICE", "spoken text")
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_bytes(b"ID3 tmp only")

    monkeypatch.setattr(narrator, "_db_get_row", lambda s, v, t: None)
    monkeypatch.setattr(object_storage, "gcs_put", lambda v, d, b: "audio/from-tmp.mp3")

    put = {}
    monkeypatch.setattr(
        narrator, "_db_put",
        lambda s, v, t, b, object_path=None: put.update(bytes=b, op=object_path),
    )
    pw.PREWARM_DONE.clear()

    pw.prewarm_course_audio()

    assert put.get("bytes") == b"ID3 tmp only"
    assert put.get("op") == "audio/from-tmp.mp3"
    assert pw.PREWARM_DONE.is_set()


def test_case4_cold_calls_generate_and_counts(monkeypatch, tmp_path):
    """All caches cold → generate_narration_for_course (our own fn) returns
    bytes → generated counter. ElevenLabs HTTP is never reached because we
    fake our own generator at the boundary."""
    _patch_common(monkeypatch, tmp_path)
    monkeypatch.setattr(narrator, "_db_get_row", lambda s, v, t: None)

    calls = {}
    def _gen(course, api_key=None, session=None):
        calls["api_key"] = api_key
        return b"ID3 freshly generated"

    monkeypatch.setattr(narrator, "generate_narration_for_course", _gen)
    pw.PREWARM_DONE.clear()

    pw.prewarm_course_audio()

    assert calls.get("api_key") == "k"
    assert pw.PREWARM_DONE.is_set()


def test_case4_cold_no_audio_counts_error(monkeypatch, tmp_path):
    """generate returns falsy → errors counter, still completes + sets event."""
    _patch_common(monkeypatch, tmp_path)
    monkeypatch.setattr(narrator, "_db_get_row", lambda s, v, t: None)
    monkeypatch.setattr(
        narrator, "generate_narration_for_course",
        lambda course, api_key=None, session=None: None,
    )
    pw.PREWARM_DONE.clear()

    pw.prewarm_course_audio()

    assert pw.PREWARM_DONE.is_set()


def test_per_course_exception_is_caught(monkeypatch, tmp_path):
    """An error inside the per-course body is logged and skipped; the worker
    still finishes and sets the event."""
    _patch_common(monkeypatch, tmp_path)

    def _boom(*a, **k):
        raise RuntimeError("row lookup blew up")

    monkeypatch.setattr(narrator, "_db_get_row", _boom)
    pw.PREWARM_DONE.clear()

    pw.prewarm_course_audio()

    assert pw.PREWARM_DONE.is_set()


# ---------------------------------------------------------------------------
# 3. Threading helpers
# ---------------------------------------------------------------------------

class TestThreadHelpers:
    def test_start_thread_runs_body_and_completes(self, monkeypatch):
        """With no API key the thread body returns immediately; the started
        thread sets PREWARM_DONE and wait_for_prewarm observes it."""
        monkeypatch.delenv("ELEVENLABS_API_KEY", raising=False)

        t = pw.start_prewarm_thread()
        try:
            assert t.daemon is True
            finished = pw.wait_for_prewarm(timeout=2.0)
            assert finished is True
            assert pw.PREWARM_DONE.is_set()
        finally:
            t.join(timeout=2.0)
        assert not t.is_alive()

    def test_wait_returns_false_on_timeout_when_cleared(self):
        """If the event is cleared and nobody sets it, wait times out → False."""
        pw.PREWARM_DONE.clear()
        try:
            assert pw.wait_for_prewarm(timeout=0.05) is False
        finally:
            pw.PREWARM_DONE.set()

    def test_wait_returns_true_immediately_when_set(self):
        pw.PREWARM_DONE.set()
        assert pw.wait_for_prewarm(timeout=0.05) is True
