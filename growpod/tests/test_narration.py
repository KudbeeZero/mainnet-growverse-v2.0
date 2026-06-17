"""
Tests for ElevenLabs narration quality across all curriculum departments.

Verifies:
  1. build_course_spoken_text produces non-empty text ≤ 5000 chars for every
     course in the live curriculum YAML.
  2. _voice_for returns an explicitly-mapped (non-fallback) voice for every
     known department key in the curriculum.
  3. generate_narration_for_course returns bytes when the API key is present
     (HTTP call mocked) and None when the key is absent.
"""

import os
import sys
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from growpodempire.ai.elevenlabs_narrator import (
    _DEPT_VOICES,
    _DEFAULT_VOICE,
    _voice_for,
    build_course_spoken_text,
    generate_narration_for_course,
)
from growpodempire.services.university_service import load_curriculum

ELEVENLABS_CHAR_LIMIT = 5000


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def curriculum():
    return load_curriculum()


@pytest.fixture(scope="module")
def all_courses(curriculum):
    return curriculum.get("courses", {})


@pytest.fixture(scope="module")
def all_departments(curriculum):
    return list(curriculum.get("departments", {}).keys())


# ---------------------------------------------------------------------------
# 1. build_course_spoken_text: non-empty and within ElevenLabs char limit
# ---------------------------------------------------------------------------

class TestBuildCourseSpokenText:
    def test_every_course_produces_non_empty_text(self, all_courses):
        empty = []
        for key, course in all_courses.items():
            text = build_course_spoken_text(course)
            if not text or not text.strip():
                empty.append(key)
        assert empty == [], f"Courses with empty spoken text: {empty}"

    def test_every_course_within_char_limit(self, all_courses):
        over_limit = []
        for key, course in all_courses.items():
            text = build_course_spoken_text(course)
            if len(text) > ELEVENLABS_CHAR_LIMIT:
                over_limit.append((key, len(text)))
        assert over_limit == [], (
            f"Courses exceeding {ELEVENLABS_CHAR_LIMIT}-char limit: {over_limit}"
        )

    def test_spoken_text_includes_course_name(self, all_courses):
        missing_name = []
        for key, course in all_courses.items():
            name = course.get("name", "")
            text = build_course_spoken_text(course)
            if name and name not in text:
                missing_name.append(key)
        assert missing_name == [], (
            f"Courses whose name is absent from spoken text: {missing_name}"
        )

    def test_spoken_text_includes_lecture_topic(self, all_courses):
        missing_topic = []
        for key, course in all_courses.items():
            lecture = course.get("lecture") or {}
            topic = lecture.get("topic", "")
            text = build_course_spoken_text(course)
            if topic and topic not in text:
                missing_topic.append(key)
        assert missing_topic == [], (
            f"Courses whose lecture topic is absent from spoken text: {missing_topic}"
        )


# ---------------------------------------------------------------------------
# 2. _voice_for: every curriculum department has an explicit voice mapping
# ---------------------------------------------------------------------------

class TestVoiceForDepartment:
    def test_every_department_is_explicitly_mapped(self, all_departments):
        """Each curriculum department key must appear in _DEPT_VOICES so that
        _voice_for doesn't silently fall back to the default."""
        unmapped = [d for d in all_departments if d not in _DEPT_VOICES]
        assert unmapped == [], (
            f"Departments missing from _DEPT_VOICES: {unmapped}. "
            "Add them to elevenlabs_narrator._DEPT_VOICES."
        )

    def test_every_department_maps_to_non_default_voice(self, all_departments):
        """Each explicitly mapped department must resolve to a voice that is
        NOT _DEFAULT_VOICE.  The default is reserved for unknown/future
        departments so that faculty personas are always distinguishable from
        the generic fallback."""
        using_default = [
            dept for dept in all_departments
            if _voice_for(dept) == _DEFAULT_VOICE
        ]
        assert using_default == [], (
            f"Departments that still resolve to _DEFAULT_VOICE: {using_default}. "
            "Assign each a distinct voice ID in elevenlabs_narrator._DEPT_VOICES."
        )

    def test_voice_for_unknown_dept_returns_default(self):
        assert _voice_for("nonexistent_dept") == _DEFAULT_VOICE

    def test_voice_for_none_returns_default(self):
        assert _voice_for(None) == _DEFAULT_VOICE

    def test_voice_for_known_dept_returns_mapped_voice(self, all_departments):
        for dept in all_departments:
            voice = _voice_for(dept)
            assert voice == _DEPT_VOICES[dept], (
                f"_voice_for('{dept}') returned {voice!r} but "
                f"_DEPT_VOICES['{dept}'] is {_DEPT_VOICES[dept]!r}"
            )

    def test_at_least_two_distinct_voices_across_departments(self, all_departments):
        """The voice map should contain more than one distinct voice ID so that
        different faculty personas actually sound different."""
        voices = {_voice_for(dept) for dept in all_departments}
        assert len(voices) >= 2, (
            "All curriculum departments map to the same voice — "
            "check _DEPT_VOICES in elevenlabs_narrator.py."
        )


# ---------------------------------------------------------------------------
# Course ↔ department integrity
# ---------------------------------------------------------------------------

class TestCourseDepartmentIntegrity:
    """Verify that every course references a department that is both declared
    in curriculum.yaml and mapped to a voice persona in _DEPT_VOICES."""

    def test_every_course_has_a_department_field(self, all_courses):
        missing = [k for k, c in all_courses.items() if not c.get("department")]
        assert missing == [], (
            f"Courses with no 'department' field: {missing}. "
            "Add a department key to each course in curriculum.yaml."
        )

    def test_every_course_department_is_declared(self, curriculum, all_courses):
        known_depts = set(curriculum.get("departments", {}).keys())
        bad = [
            (k, c["department"])
            for k, c in all_courses.items()
            if c.get("department") not in known_depts
        ]
        assert bad == [], (
            f"Courses whose department is not in curriculum departments: {bad}. "
            "Add the department to the 'departments' section of curriculum.yaml."
        )

    def test_every_course_department_has_a_voice(self, all_courses):
        missing_voice = [
            (k, c["department"])
            for k, c in all_courses.items()
            if c.get("department") and c["department"] not in _DEPT_VOICES
        ]
        assert missing_voice == [], (
            f"Courses whose department has no voice mapping: {missing_voice}. "
            "Add the department to elevenlabs_narrator._DEPT_VOICES."
        )


# ---------------------------------------------------------------------------
# 3. generate_narration_for_course: bytes with key, None without
# ---------------------------------------------------------------------------

_FAKE_MP3 = b"ID3\x00\x00\x00" + b"\xff" * 128  # plausible MP3 header bytes


class TestGenerateNarrationForCourse:
    """Tests for generate_narration_for_course.

    Each test patches `growpodempire.ai.elevenlabs_narrator._CACHE_DIR` to an
    isolated tmp directory so that the persistent on-disk /tmp cache never bleeds
    across test runs.  (_CACHE_DIR is resolved at module-import time, so setting
    NARRATION_CACHE_DIR in the environment is not sufficient.)
    """

    def _sample_course(self, all_courses):
        """Return the first course dict for testing."""
        return next(iter(all_courses.values()))

    def test_returns_none_when_no_api_key(self, all_courses, monkeypatch, tmp_path):
        monkeypatch.delenv("ELEVENLABS_API_KEY", raising=False)
        course = self._sample_course(all_courses)

        with patch("growpodempire.ai.elevenlabs_narrator._CACHE_DIR", tmp_path):
            result = generate_narration_for_course(course, api_key=None, session=None)

        assert result is None

    def test_returns_bytes_when_api_key_set(self, all_courses, monkeypatch, tmp_path):
        monkeypatch.setenv("ELEVENLABS_API_KEY", "test-key-123")
        course = self._sample_course(all_courses)

        fake_response = MagicMock()
        fake_response.content = _FAKE_MP3
        fake_response.raise_for_status = MagicMock()

        with patch("growpodempire.ai.elevenlabs_narrator._CACHE_DIR", tmp_path), \
             patch("requests.post", return_value=fake_response) as mock_post, \
             patch("growpodempire.ai.object_storage.gcs_put", return_value=None):
            result = generate_narration_for_course(course, api_key=None, session=None)

        mock_post.assert_called_once()
        assert isinstance(result, bytes), f"Expected bytes, got {type(result)}"
        assert len(result) > 0

    def test_api_key_arg_takes_precedence_over_env(self, all_courses, monkeypatch, tmp_path):
        monkeypatch.delenv("ELEVENLABS_API_KEY", raising=False)
        course = self._sample_course(all_courses)

        fake_response = MagicMock()
        fake_response.content = _FAKE_MP3
        fake_response.raise_for_status = MagicMock()

        with patch("growpodempire.ai.elevenlabs_narrator._CACHE_DIR", tmp_path), \
             patch("requests.post", return_value=fake_response), \
             patch("growpodempire.ai.object_storage.gcs_put", return_value=None):
            result = generate_narration_for_course(
                course, api_key="direct-key-456", session=None
            )

        assert isinstance(result, bytes)

    def test_returns_none_on_elevenlabs_api_error(self, all_courses, monkeypatch, tmp_path):
        course = self._sample_course(all_courses)

        fake_response = MagicMock()
        fake_response.raise_for_status.side_effect = Exception("ElevenLabs 500")

        with patch("growpodempire.ai.elevenlabs_narrator._CACHE_DIR", tmp_path), \
             patch("requests.post", return_value=fake_response), \
             patch("growpodempire.ai.object_storage.gcs_put", return_value=None):
            result = generate_narration_for_course(
                course, api_key="test-key", session=None
            )

        assert result is None

    def test_tmp_cache_hit_skips_api_call(self, all_courses, monkeypatch, tmp_path):
        """If the /tmp cache already has the file, the API must not be called."""
        monkeypatch.setenv("ELEVENLABS_API_KEY", "test-key-123")
        course = self._sample_course(all_courses)

        from growpodempire.ai import elevenlabs_narrator as narrator

        voice_id = narrator._voice_for(course.get("department"))
        text = narrator.build_course_spoken_text(course)

        with patch("growpodempire.ai.elevenlabs_narrator._CACHE_DIR", tmp_path):
            cache_path = narrator._cache_path(voice_id, text)
            cache_path.parent.mkdir(parents=True, exist_ok=True)
            cache_path.write_bytes(_FAKE_MP3)

            with patch("requests.post") as mock_post:
                result = generate_narration_for_course(course, api_key=None, session=None)

        mock_post.assert_not_called()
        assert result == _FAKE_MP3
