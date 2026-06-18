"""
HTTP route coverage for the narration/audio endpoints in api/game_api.py.

Complements tests/test_narration.py (which exercises the narrator *module*
functions directly).  This file targets the Flask route branches that are
reachable with **no ElevenLabs key** in the test environment:

  GET /api/game/narration/<course_key>/<level>
      - unknown course            -> 404 "Course not found"
      - known course, no cache    -> 404 "Audio not yet generated"
      - known course, cached MP3  -> 200 send_file (audio/mpeg)

  GET /api/game/university/courses/<course_key>/audio
      - unknown course            -> 404 "Course not found"
      - known course, no key      -> 204 No Content (graceful, no live call)

No ANTHROPIC/ELEVENLABS keys are configured in the test env, so the live
ElevenLabs path is never taken; generate_narration_for_course returns None.
"""

import os
import sys
from unittest.mock import patch

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from growpodempire.services.university_service import load_curriculum

_FAKE_MP3 = b"ID3\x00\x00\x00" + b"\xff" * 64


@pytest.fixture()
def client(db):
    from growpodempire.api.flask_api import create_app
    return create_app(init_database=False).test_client()


@pytest.fixture(scope="module")
def known_course():
    """Return (course_key, course_dict) for the first curriculum course."""
    courses = load_curriculum().get("courses", {})
    key = next(iter(courses))
    return key, courses[key]


# ---------------------------------------------------------------------------
# GET /api/game/narration/<course_key>/<level>
# ---------------------------------------------------------------------------

class TestServeNarration:
    def test_unknown_course_returns_404(self, client):
        resp = client.get("/api/game/narration/no-such-course/1")
        assert resp.status_code == 404
        assert resp.get_json()["error"] == "Course not found"

    def test_known_course_no_cache_returns_404(self, client, known_course, tmp_path):
        """Known course but the cache dir holds no matching MP3 -> 404."""
        course_key, _ = known_course
        empty_cache = tmp_path / "cache_empty"
        empty_cache.mkdir()
        with patch(
            "growpodempire.ai.elevenlabs_narrator._CACHE_DIR", empty_cache
        ):
            resp = client.get(f"/api/game/narration/{course_key}/1")
        assert resp.status_code == 404
        assert resp.get_json()["error"] == "Audio not yet generated"

    def test_known_course_cached_mp3_is_served(self, client, known_course, tmp_path):
        """A cached MP3 named with the department's voice prefix is streamed."""
        from growpodempire.ai.elevenlabs_narrator import _voice_for

        course_key, course = known_course
        voice_id = _voice_for(course.get("department"))

        cache = tmp_path / "cache_full"
        cache.mkdir()
        mp3_file = cache / f"{voice_id}_deadbeefdeadbeef.mp3"
        mp3_file.write_bytes(_FAKE_MP3)

        with patch(
            "growpodempire.ai.elevenlabs_narrator._CACHE_DIR", cache
        ):
            resp = client.get(f"/api/game/narration/{course_key}/1")

        assert resp.status_code == 200
        assert resp.mimetype == "audio/mpeg"
        assert resp.data == _FAKE_MP3


# ---------------------------------------------------------------------------
# GET /api/game/university/courses/<course_key>/audio
# ---------------------------------------------------------------------------

class TestUniversityCourseAudio:
    def test_unknown_course_returns_404(self, client):
        resp = client.get("/api/game/university/courses/no-such-course/audio")
        assert resp.status_code == 404
        assert resp.get_json()["error"] == "Course not found"

    def test_no_key_returns_204(self, client, known_course):
        """With no ElevenLabs key, generate_narration_for_course returns None
        and the route responds 204 No Content (graceful, no live API call)."""
        course_key, _ = known_course
        resp = client.get(f"/api/game/university/courses/{course_key}/audio")
        assert resp.status_code == 204
        assert resp.data == b""
