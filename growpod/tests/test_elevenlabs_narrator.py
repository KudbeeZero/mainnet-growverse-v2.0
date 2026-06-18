"""
Unit coverage for ``ai/elevenlabs_narrator.py`` focused on the branches not
already exercised by ``test_narration.py``:

  * Pure helpers — ``_build_spoken_text``, ``_text_hash``, ``_cache_path`` and
    the ``_CACHE_DIR`` derivation (no mocking).
  * ``generate_narration`` (the lecture-dict entry point) across every cache
    layer: /tmp hit, DB BLOB hit (L3, backfills GCS), GCS hit (L2),
    no-key miss, generate-and-cache, and generate-failure.
  * ``is_course_audio_cached`` / ``get_course_audio_object_path`` lookup logic.
  * DB helper functions (``_db_get_row``, ``_db_get``, ``_db_put``,
    ``_db_set_object_path``, ``_write_tmp_cache``) including their
    swallow-and-log error paths.

The network boundary (``requests.post`` inside ``_call_elevenlabs``) and the
GCS helpers are always mocked — no live ElevenLabs key or bucket is required.
The DB is faked with duck-typed row/session objects so no Session fixture or
conftest is touched.
"""

import os
import sys
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import pytest

from growpodempire.ai import elevenlabs_narrator as narrator
from growpodempire.ai.elevenlabs_narrator import (
    _DEFAULT_VOICE,
    _build_spoken_text,
    _cache_path,
    _db_get,
    _db_get_row,
    _db_put,
    _db_set_object_path,
    _text_hash,
    _voice_for,
    _write_tmp_cache,
    generate_narration,
    get_course_audio_object_path,
    is_course_audio_cached,
)

_FAKE_MP3 = b"ID3\x00\x00\x00" + b"\xff" * 64
_GCS_MP3 = b"ID3\x00gcs" + b"\xff" * 64
_DB_MP3 = b"ID3\x00db" + b"\xff" * 64


# ---------------------------------------------------------------------------
# Fakes for the DB layer (duck-typed; no real SQLAlchemy session needed)
# ---------------------------------------------------------------------------

class _FakeRow:
    def __init__(self, mp3_data=None, object_path=None):
        self.mp3_data = mp3_data
        self.object_path = object_path


class _FakeSession:
    """Minimal stand-in. _db_get_row imports the real LectureAudio model and
    calls session.query(...).filter(...).first(); we short-circuit that whole
    chain to return a preset row so no DB engine is involved."""

    def __init__(self, row=None, flush_raises=False):
        self._row = row
        self.flush_raises = flush_raises
        self.added = []
        self.flush_calls = 0
        self.rollback_calls = 0

    def query(self, *_a, **_k):
        return self

    def filter(self, *_a, **_k):
        return self

    def first(self):
        return self._row

    def add(self, obj):
        self.added.append(obj)

    def flush(self):
        self.flush_calls += 1
        if self.flush_raises:
            raise RuntimeError("flush boom")

    def rollback(self):
        self.rollback_calls += 1


# ---------------------------------------------------------------------------
# 1. Pure helpers — no mocking
# ---------------------------------------------------------------------------

class TestPureHelpers:
    def test_build_spoken_text_combines_all_parts(self):
        lecture = {"title": "Lighting 101", "summary": "PAR matters.", "content": "Body text."}
        text = _build_spoken_text(lecture)
        assert text == "Lighting 101.\n\nPAR matters.\n\nBody text."

    def test_build_spoken_text_skips_missing_fields(self):
        assert _build_spoken_text({"title": "Only Title"}) == "Only Title."
        assert _build_spoken_text({"summary": "just summary"}) == "just summary"
        assert _build_spoken_text({}) == ""

    def test_build_spoken_text_truncates_content_to_3000_chars(self):
        lecture = {"content": "x" * 5000}
        text = _build_spoken_text(lecture)
        assert len(text) == 3000  # only the body, capped at 3000

    def test_text_hash_is_deterministic_16_hex_chars(self):
        h1 = _text_hash("hello world")
        h2 = _text_hash("hello world")
        assert h1 == h2
        assert len(h1) == 16
        assert all(c in "0123456789abcdef" for c in h1)

    def test_text_hash_differs_for_different_text(self):
        assert _text_hash("a") != _text_hash("b")

    def test_cache_path_uses_cache_dir_voice_and_hash(self, monkeypatch, tmp_path):
        monkeypatch.setattr(narrator, "_CACHE_DIR", tmp_path)
        path = _cache_path("VOICE123", "some text")
        assert path.parent == tmp_path
        assert path.name == f"VOICE123_{_text_hash('some text')}.mp3"
        assert path.suffix == ".mp3"

    def test_cache_dir_default_is_a_path(self):
        from pathlib import Path
        assert isinstance(narrator._CACHE_DIR, Path)


# ---------------------------------------------------------------------------
# 2. generate_narration (lecture dict) — cache layers
# ---------------------------------------------------------------------------

_LECTURE = {"title": "Soil Science", "summary": "Dirt is alive.", "content": "Long body."}


class TestGenerateNarration:
    def test_tmp_cache_hit_returns_path_without_api(self, monkeypatch, tmp_path):
        monkeypatch.setattr(narrator, "_CACHE_DIR", tmp_path)
        voice_id = _voice_for(None)
        text = _build_spoken_text(_LECTURE)
        cache_path = _cache_path(voice_id, text)
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        cache_path.write_bytes(_FAKE_MP3)

        with patch("requests.post") as mock_post:
            result = generate_narration(_LECTURE, api_key="k", session=None)

        mock_post.assert_not_called()
        assert result == str(cache_path)

    def test_no_key_full_miss_returns_none(self, monkeypatch, tmp_path):
        monkeypatch.setattr(narrator, "_CACHE_DIR", tmp_path)
        monkeypatch.delenv("ELEVENLABS_API_KEY", raising=False)
        result = generate_narration(_LECTURE, api_key=None, session=None)
        assert result is None

    def test_generate_writes_tmp_and_returns_path(self, monkeypatch, tmp_path):
        monkeypatch.setattr(narrator, "_CACHE_DIR", tmp_path)
        fake_resp = MagicMock()
        fake_resp.content = _FAKE_MP3
        fake_resp.raise_for_status = MagicMock()

        with patch("requests.post", return_value=fake_resp) as mock_post, \
             patch("growpodempire.ai.object_storage.gcs_put", return_value=None):
            result = generate_narration(_LECTURE, api_key="test-key", session=None)

        mock_post.assert_called_once()
        assert result is not None
        from pathlib import Path
        assert Path(result).read_bytes() == _FAKE_MP3

    def test_generate_failure_returns_none(self, monkeypatch, tmp_path):
        monkeypatch.setattr(narrator, "_CACHE_DIR", tmp_path)
        fake_resp = MagicMock()
        fake_resp.raise_for_status.side_effect = Exception("boom 500")

        with patch("requests.post", return_value=fake_resp), \
             patch("growpodempire.ai.object_storage.gcs_put", return_value=None):
            result = generate_narration(_LECTURE, api_key="test-key", session=None)

        assert result is None

    def test_db_blob_hit_backfills_gcs_and_writes_tmp(self, monkeypatch, tmp_path):
        """L3 hit: row has mp3_data but no object_path → gcs_put backfills,
        _db_set_object_path stamps the row, /tmp is written, path returned,
        and ElevenLabs is never called."""
        monkeypatch.setattr(narrator, "_CACHE_DIR", tmp_path)
        row = _FakeRow(mp3_data=_DB_MP3, object_path=None)
        session = _FakeSession(row=row)

        with patch.object(narrator, "_db_get_row", return_value=row), \
             patch("growpodempire.ai.object_storage.gcs_get") as mock_get, \
             patch("growpodempire.ai.object_storage.gcs_put", return_value="audio/x.mp3") as mock_put, \
             patch("requests.post") as mock_post:
            result = generate_narration(_LECTURE, api_key="k", session=session)

        mock_post.assert_not_called()
        mock_get.assert_not_called()  # no object_path → skip L2 download
        mock_put.assert_called_once()
        assert row.object_path == "audio/x.mp3"  # backfilled via _db_set_object_path
        from pathlib import Path
        assert result is not None and Path(result).read_bytes() == _DB_MP3

    def test_gcs_hit_returns_without_db_blob(self, monkeypatch, tmp_path):
        """L2 hit: row has object_path and gcs_get returns bytes → return path,
        no backfill, no API call."""
        monkeypatch.setattr(narrator, "_CACHE_DIR", tmp_path)
        row = _FakeRow(mp3_data=None, object_path="audio/exists.mp3")
        session = _FakeSession(row=row)

        with patch.object(narrator, "_db_get_row", return_value=row), \
             patch("growpodempire.ai.object_storage.gcs_get", return_value=_GCS_MP3) as mock_get, \
             patch("growpodempire.ai.object_storage.gcs_put") as mock_put, \
             patch("requests.post") as mock_post:
            result = generate_narration(_LECTURE, api_key="k", session=session)

        mock_post.assert_not_called()
        mock_get.assert_called_once()
        mock_put.assert_not_called()
        from pathlib import Path
        assert result is not None and Path(result).read_bytes() == _GCS_MP3

    def test_db_row_present_but_empty_falls_through_to_generate(self, monkeypatch, tmp_path):
        """Row exists with no object_path and no mp3_data → no cache hit, so
        with a key it generates."""
        monkeypatch.setattr(narrator, "_CACHE_DIR", tmp_path)
        row = _FakeRow(mp3_data=None, object_path=None)
        session = _FakeSession(row=row)
        fake_resp = MagicMock()
        fake_resp.content = _FAKE_MP3
        fake_resp.raise_for_status = MagicMock()

        with patch.object(narrator, "_db_get_row", return_value=row), \
             patch.object(narrator, "_db_put") as mock_dbput, \
             patch("growpodempire.ai.object_storage.gcs_put", return_value="audio/new.mp3"), \
             patch("requests.post", return_value=fake_resp) as mock_post:
            result = generate_narration(_LECTURE, api_key="k", session=session)

        mock_post.assert_called_once()
        mock_dbput.assert_called_once()
        assert result is not None


# ---------------------------------------------------------------------------
# 3. is_course_audio_cached
# ---------------------------------------------------------------------------

_COURSE = {
    "name": "Intro to Cultivation",
    "department": "cultivation",
    "lecture": {"topic": "Lighting", "objectives": ["Understand PAR"]},
}


class TestIsCourseAudioCached:
    def test_tmp_hit_returns_true(self, monkeypatch, tmp_path):
        monkeypatch.setattr(narrator, "_CACHE_DIR", tmp_path)
        voice_id = _voice_for(_COURSE["department"])
        text = narrator.build_course_spoken_text(_COURSE)
        p = _cache_path(voice_id, text)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(_FAKE_MP3)
        assert is_course_audio_cached(_COURSE, session=None) is True

    def test_no_session_no_tmp_returns_false(self, monkeypatch, tmp_path):
        monkeypatch.setattr(narrator, "_CACHE_DIR", tmp_path)
        assert is_course_audio_cached(_COURSE, session=None) is False

    def test_gcs_object_exists_returns_true(self, monkeypatch, tmp_path):
        monkeypatch.setattr(narrator, "_CACHE_DIR", tmp_path)
        row = _FakeRow(mp3_data=None, object_path="audio/y.mp3")
        with patch.object(narrator, "_db_get_row", return_value=row), \
             patch("growpodempire.ai.object_storage.gcs_exists", return_value=True):
            assert is_course_audio_cached(_COURSE, session=_FakeSession(row=row)) is True

    def test_db_blob_present_returns_true(self, monkeypatch, tmp_path):
        monkeypatch.setattr(narrator, "_CACHE_DIR", tmp_path)
        row = _FakeRow(mp3_data=_DB_MP3, object_path=None)
        with patch.object(narrator, "_db_get_row", return_value=row), \
             patch("growpodempire.ai.object_storage.gcs_exists", return_value=False):
            assert is_course_audio_cached(_COURSE, session=_FakeSession(row=row)) is True

    def test_row_present_but_empty_returns_false(self, monkeypatch, tmp_path):
        monkeypatch.setattr(narrator, "_CACHE_DIR", tmp_path)
        row = _FakeRow(mp3_data=None, object_path=None)
        with patch.object(narrator, "_db_get_row", return_value=row), \
             patch("growpodempire.ai.object_storage.gcs_exists", return_value=False):
            assert is_course_audio_cached(_COURSE, session=_FakeSession(row=row)) is False

    def test_no_row_returns_false(self, monkeypatch, tmp_path):
        monkeypatch.setattr(narrator, "_CACHE_DIR", tmp_path)
        with patch.object(narrator, "_db_get_row", return_value=None):
            assert is_course_audio_cached(_COURSE, session=_FakeSession(row=None)) is False


# ---------------------------------------------------------------------------
# 4. get_course_audio_object_path
# ---------------------------------------------------------------------------

class TestGetCourseAudioObjectPath:
    def test_returns_none_without_session(self):
        assert get_course_audio_object_path(_COURSE, session=None) is None

    def test_returns_object_path_from_row(self):
        row = _FakeRow(object_path="audio/z.mp3")
        with patch.object(narrator, "_db_get_row", return_value=row):
            assert get_course_audio_object_path(_COURSE, session=_FakeSession(row=row)) == "audio/z.mp3"

    def test_returns_none_when_no_row(self):
        with patch.object(narrator, "_db_get_row", return_value=None):
            assert get_course_audio_object_path(_COURSE, session=_FakeSession(row=None)) is None


# ---------------------------------------------------------------------------
# 5. DB helpers
# ---------------------------------------------------------------------------

class TestDbHelpers:
    def test_db_get_row_queries_and_returns_first(self):
        row = _FakeRow(mp3_data=_DB_MP3)
        session = _FakeSession(row=row)
        # LectureAudio import succeeds; query chain returns our fake row.
        assert _db_get_row(session, "VOICE", "text") is row

    def test_db_get_row_swallows_errors_returns_none(self):
        broken = MagicMock()
        broken.query.side_effect = RuntimeError("no table")
        assert _db_get_row(broken, "VOICE", "text") is None

    def test_db_get_returns_blob_when_row_present(self):
        row = _FakeRow(mp3_data=_DB_MP3)
        with patch.object(narrator, "_db_get_row", return_value=row):
            assert _db_get(_FakeSession(row=row), "v", "t") == _DB_MP3

    def test_db_get_returns_none_when_no_row(self):
        with patch.object(narrator, "_db_get_row", return_value=None):
            assert _db_get(_FakeSession(row=None), "v", "t") is None

    def test_db_put_inserts_new_row(self):
        session = _FakeSession(row=None)
        with patch.object(narrator, "_db_get_row", return_value=None):
            _db_put(session, "VOICE", "text", _DB_MP3, object_path="audio/p.mp3")
        assert len(session.added) == 1
        assert session.flush_calls == 1

    def test_db_put_backfills_object_path_on_existing_row(self):
        existing = _FakeRow(mp3_data=_DB_MP3, object_path=None)
        session = _FakeSession(row=existing)
        with patch.object(narrator, "_db_get_row", return_value=existing):
            _db_put(session, "VOICE", "text", _DB_MP3, object_path="audio/back.mp3")
        assert existing.object_path == "audio/back.mp3"
        assert session.flush_calls == 1

    def test_db_put_swallows_errors(self):
        # _db_get_row raising inside _db_put must be caught and logged, not raised.
        with patch.object(narrator, "_db_get_row", side_effect=RuntimeError("db down")):
            _db_put(_FakeSession(), "VOICE", "text", _DB_MP3)  # no exception

    def test_db_set_object_path_updates_and_flushes(self):
        row = _FakeRow(object_path=None)
        session = _FakeSession(row=row)
        _db_set_object_path(session, row, "audio/set.mp3")
        assert row.object_path == "audio/set.mp3"
        assert session.flush_calls == 1

    def test_db_set_object_path_swallows_flush_error(self):
        row = _FakeRow(object_path=None)
        session = _FakeSession(row=row, flush_raises=True)
        # Must not raise even though flush() blows up.
        _db_set_object_path(session, row, "audio/set.mp3")

    def test_write_tmp_cache_creates_dir_and_file(self, monkeypatch, tmp_path):
        target_dir = tmp_path / "nested" / "cache"
        monkeypatch.setattr(narrator, "_CACHE_DIR", target_dir)
        out = target_dir / "v_hash.mp3"
        _write_tmp_cache(out, _FAKE_MP3)
        assert out.read_bytes() == _FAKE_MP3

    def test_write_tmp_cache_swallows_write_error(self, monkeypatch, tmp_path):
        monkeypatch.setattr(narrator, "_CACHE_DIR", tmp_path)
        # path.write_bytes raises → caught and logged, no exception propagates.
        with patch("pathlib.Path.write_bytes", side_effect=OSError("disk full")):
            _write_tmp_cache(tmp_path / "x.mp3", _FAKE_MP3)
