"""
Unit coverage for the COURSE-level twin in ``ai/elevenlabs_narrator.py`` and
the ``_db_put`` concurrent-insert recovery branch — the regions not exercised
by ``test_elevenlabs_narrator.py`` (which covers the lecture-dict entry point).

Specifically:
  * ``generate_narration_for_course`` cache resolution (lines 256-291) across
    its cache layers WITHOUT ever reaching the real ElevenLabs TTS HTTP path:
      - /tmp hit (L1) → returns on-disk bytes.
      - GCS hit (L2) → ``gcs_get`` returns bytes, /tmp backfilled.
      - DB BLOB hit (L3) → ``gcs_put`` backfills object storage + stamps the
        row via ``_db_set_object_path``, /tmp written.
      - empty row fall-through (no object_path, no mp3_data) → with no key,
        returns None (the final real-generate branch is intentionally NOT
        exercised — that needs the HTTP boundary mocked, out of scope here).
  * ``_db_put`` IntegrityError concurrent-insert rollback (lines 362-369):
    the first ``flush`` raises ``sqlalchemy.exc.IntegrityError`` once, then the
    re-queried winner row gets its ``object_path`` backfilled after rollback.

NO ElevenLabs HTTP SDK call is mocked and NO network call is made anywhere in
this module — the real TTS-generate path is never invoked. Only our OWN module
functions (object_storage.gcs_get / gcs_put) and an owned duck-typed fake
SQLAlchemy session/row are used, mirroring the established pattern in
``test_elevenlabs_narrator.py``. ``sqlalchemy.exc.IntegrityError`` is our ORM's
own exception type, not a cloud SDK boundary.
"""

import os
import sys
from unittest.mock import patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import pytest
from sqlalchemy.exc import IntegrityError

import growpodempire.ai.elevenlabs_narrator as nar

_GCS_MP3 = b"ID3\x00gcs-course" + b"\xff" * 64
_DB_MP3 = b"ID3\x00db-course" + b"\xff" * 64
_TMP_MP3 = b"ID3\x00tmp-course" + b"\xff" * 64


# ---------------------------------------------------------------------------
# Owned fakes for the DB layer (duck-typed; no real SQLAlchemy session needed)
# ---------------------------------------------------------------------------

class _FakeRow:
    def __init__(self, mp3_data=None, object_path=None):
        self.mp3_data = mp3_data
        self.object_path = object_path


class _FakeSession:
    """Minimal stand-in mirroring test_elevenlabs_narrator._FakeSession.

    ``_db_get_row`` is patched directly in the course tests, so the query
    chain here only matters for ``_db_put``'s internal re-query. To model a
    concurrent insert, ``first()`` returns ``initial_row`` until a flush has
    raised IntegrityError, after which it returns ``winner_row`` (the row the
    competing transaction committed)."""

    def __init__(self, row=None, integrity_then=None, winner_row=None):
        self._row = row
        self._winner_row = winner_row
        self._integrity_then = integrity_then  # how many flushes raise IntegrityError
        self.added = []
        self.flush_calls = 0
        self.rollback_calls = 0
        self._raised = False

    def query(self, *_a, **_k):
        return self

    def filter(self, *_a, **_k):
        return self

    def first(self):
        if self._raised and self._winner_row is not None:
            return self._winner_row
        return self._row

    def add(self, obj):
        self.added.append(obj)

    def flush(self):
        self.flush_calls += 1
        if self._integrity_then and self.flush_calls <= self._integrity_then:
            self._raised = True
            raise IntegrityError("INSERT", {}, Exception("duplicate key"))

    def rollback(self):
        self.rollback_calls += 1


_COURSE = {
    "name": "Intro to Cultivation",
    "department": "cultivation",
    "lecture": {"topic": "Lighting", "objectives": ["Understand PAR"]},
}


# ---------------------------------------------------------------------------
# 1. generate_narration_for_course — cache layers (no TTS HTTP ever reached)
# ---------------------------------------------------------------------------

class TestGenerateNarrationForCourse:
    def test_tmp_hit_returns_bytes_without_session_or_api(self, monkeypatch, tmp_path):
        """L1 /tmp hit: returns on-disk bytes; never touches DB, GCS, or TTS."""
        monkeypatch.setattr(nar, "_CACHE_DIR", tmp_path)
        voice_id = nar._voice_for(_COURSE["department"])
        text = nar.build_course_spoken_text(_COURSE)
        path = nar._cache_path(voice_id, text)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(_TMP_MP3)

        with patch("growpodempire.ai.object_storage.gcs_get") as mock_get, \
             patch("growpodempire.ai.object_storage.gcs_put") as mock_put:
            result = nar.generate_narration_for_course(_COURSE, api_key="k", session=None)

        assert result == _TMP_MP3
        mock_get.assert_not_called()
        mock_put.assert_not_called()

    def test_gcs_hit_returns_bytes_and_backfills_tmp(self, monkeypatch, tmp_path):
        """L2 GCS hit: row has object_path, our own gcs_get returns bytes →
        bytes returned, /tmp backfilled, no gcs_put, TTS never reached."""
        monkeypatch.setattr(nar, "_CACHE_DIR", tmp_path)
        row = _FakeRow(mp3_data=None, object_path="audio/course-exists.mp3")
        session = _FakeSession(row=row)

        with patch.object(nar, "_db_get_row", return_value=row), \
             patch("growpodempire.ai.object_storage.gcs_get", return_value=_GCS_MP3) as mock_get, \
             patch("growpodempire.ai.object_storage.gcs_put") as mock_put:
            result = nar.generate_narration_for_course(_COURSE, api_key="k", session=session)

        assert result == _GCS_MP3
        mock_get.assert_called_once_with("audio/course-exists.mp3")
        mock_put.assert_not_called()
        # /tmp was backfilled with the GCS bytes
        voice_id = nar._voice_for(_COURSE["department"])
        text = nar.build_course_spoken_text(_COURSE)
        assert nar._cache_path(voice_id, text).read_bytes() == _GCS_MP3

    def test_db_blob_hit_backfills_gcs_and_writes_tmp(self, monkeypatch, tmp_path):
        """L3 DB-BLOB hit: row has mp3_data but no object_path → our own
        gcs_put backfills object storage, _db_set_object_path stamps the row,
        /tmp is written, bytes returned, TTS never reached."""
        monkeypatch.setattr(nar, "_CACHE_DIR", tmp_path)
        row = _FakeRow(mp3_data=_DB_MP3, object_path=None)
        session = _FakeSession(row=row)

        with patch.object(nar, "_db_get_row", return_value=row), \
             patch("growpodempire.ai.object_storage.gcs_get") as mock_get, \
             patch("growpodempire.ai.object_storage.gcs_put", return_value="audio/course-new.mp3") as mock_put:
            result = nar.generate_narration_for_course(_COURSE, api_key="k", session=session)

        assert result == _DB_MP3
        mock_get.assert_not_called()  # no object_path → L2 skipped
        mock_put.assert_called_once()
        assert row.object_path == "audio/course-new.mp3"  # _db_set_object_path stamped it
        assert session.flush_calls == 1  # the backfill flush
        voice_id = nar._voice_for(_COURSE["department"])
        text = nar.build_course_spoken_text(_COURSE)
        assert nar._cache_path(voice_id, text).read_bytes() == _DB_MP3

    def test_db_blob_hit_gcs_put_returns_none_skips_backfill(self, monkeypatch, tmp_path):
        """L3 DB-BLOB hit when object storage is unavailable: gcs_put returns
        None → no _db_set_object_path, but bytes are still returned + /tmp
        written. TTS never reached."""
        monkeypatch.setattr(nar, "_CACHE_DIR", tmp_path)
        row = _FakeRow(mp3_data=_DB_MP3, object_path=None)
        session = _FakeSession(row=row)

        with patch.object(nar, "_db_get_row", return_value=row), \
             patch("growpodempire.ai.object_storage.gcs_get") as mock_get, \
             patch("growpodempire.ai.object_storage.gcs_put", return_value=None) as mock_put:
            result = nar.generate_narration_for_course(_COURSE, api_key="k", session=session)

        assert result == _DB_MP3
        mock_get.assert_not_called()
        mock_put.assert_called_once()
        assert row.object_path is None  # backfill skipped
        assert session.flush_calls == 0

    def test_empty_row_no_key_falls_through_to_none(self, monkeypatch, tmp_path):
        """Row present but empty (no object_path, no mp3_data) → no cache hit;
        with no key the function returns None WITHOUT reaching the TTS path."""
        monkeypatch.setattr(nar, "_CACHE_DIR", tmp_path)
        monkeypatch.delenv("ELEVENLABS_API_KEY", raising=False)
        row = _FakeRow(mp3_data=None, object_path=None)
        session = _FakeSession(row=row)

        with patch.object(nar, "_db_get_row", return_value=row), \
             patch("growpodempire.ai.object_storage.gcs_get") as mock_get, \
             patch("growpodempire.ai.object_storage.gcs_put") as mock_put:
            result = nar.generate_narration_for_course(_COURSE, api_key=None, session=session)

        assert result is None
        mock_get.assert_not_called()  # no object_path → L2 skipped
        mock_put.assert_not_called()

    def test_object_path_set_but_gcs_get_empty_falls_through_to_none(self, monkeypatch, tmp_path):
        """Row has object_path but gcs_get returns None (object purged), and no
        mp3_data → mp3 stays None, empty fall-through; no key → None. TTS not
        reached."""
        monkeypatch.setattr(nar, "_CACHE_DIR", tmp_path)
        monkeypatch.delenv("ELEVENLABS_API_KEY", raising=False)
        row = _FakeRow(mp3_data=None, object_path="audio/purged.mp3")
        session = _FakeSession(row=row)

        with patch.object(nar, "_db_get_row", return_value=row), \
             patch("growpodempire.ai.object_storage.gcs_get", return_value=None) as mock_get, \
             patch("growpodempire.ai.object_storage.gcs_put") as mock_put:
            result = nar.generate_narration_for_course(_COURSE, api_key=None, session=session)

        assert result is None
        mock_get.assert_called_once_with("audio/purged.mp3")
        mock_put.assert_not_called()

    def test_no_session_no_key_returns_none(self, monkeypatch, tmp_path):
        """No /tmp, no session, no key → None, with no GCS or TTS activity."""
        monkeypatch.setattr(nar, "_CACHE_DIR", tmp_path)
        monkeypatch.delenv("ELEVENLABS_API_KEY", raising=False)
        result = nar.generate_narration_for_course(_COURSE, api_key=None, session=None)
        assert result is None


# ---------------------------------------------------------------------------
# 2. _db_put IntegrityError concurrent-insert rollback (lines 362-369)
# ---------------------------------------------------------------------------

class TestDbPutConcurrentInsert:
    def test_integrity_error_rolls_back_and_backfills_winner(self):
        """First flush raises IntegrityError (a competing tx inserted the row);
        _db_put must roll back, re-query the winner, and backfill its
        object_path."""
        winner = _FakeRow(mp3_data=_DB_MP3, object_path=None)
        # initial re-query inside _db_put (existing check) returns None →
        # attempts insert → flush raises IntegrityError → rollback → re-query
        # returns the winner row.
        session = _FakeSession(row=None, integrity_then=1, winner_row=winner)

        # Patch _db_get_row to mirror the session's view: None before the
        # collision, the winner row after.
        calls = {"n": 0}

        def fake_get_row(_s, _v, _t):
            calls["n"] += 1
            # 1st call (existing check) → None; subsequent (post-rollback) → winner
            return None if calls["n"] == 1 else winner

        with patch.object(nar, "_db_get_row", side_effect=fake_get_row):
            nar._db_put(session, "VOICE", "text", _DB_MP3, object_path="audio/winner.mp3")

        assert session.rollback_calls == 1
        assert winner.object_path == "audio/winner.mp3"  # winner backfilled
        # flush_calls: 1 (failed insert) + 1 (backfill) == 2
        assert session.flush_calls == 2

    def test_integrity_error_winner_already_has_path_no_backfill(self):
        """If the winner row already carries an object_path, the rollback path
        runs but does NOT overwrite it (and skips the backfill flush)."""
        winner = _FakeRow(mp3_data=_DB_MP3, object_path="audio/already.mp3")
        session = _FakeSession(row=None, integrity_then=1, winner_row=winner)

        calls = {"n": 0}

        def fake_get_row(_s, _v, _t):
            calls["n"] += 1
            return None if calls["n"] == 1 else winner

        with patch.object(nar, "_db_get_row", side_effect=fake_get_row):
            nar._db_put(session, "VOICE", "text", _DB_MP3, object_path="audio/new.mp3")

        assert session.rollback_calls == 1
        assert winner.object_path == "audio/already.mp3"  # untouched
        assert session.flush_calls == 1  # only the failed insert; no backfill flush

    def test_integrity_error_no_winner_found_swallows(self):
        """After rollback the re-query finds no winner (or no object_path
        supplied) → the condition is skipped and no exception escapes."""
        session = _FakeSession(row=None, integrity_then=1, winner_row=None)

        calls = {"n": 0}

        def fake_get_row(_s, _v, _t):
            calls["n"] += 1
            return None

        with patch.object(nar, "_db_get_row", side_effect=fake_get_row):
            nar._db_put(session, "VOICE", "text", _DB_MP3, object_path="audio/x.mp3")

        assert session.rollback_calls == 1
        assert session.flush_calls == 1  # failed insert only; nothing to backfill
