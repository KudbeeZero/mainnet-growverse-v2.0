"""
ElevenLabs narration provider for GrowPod University lectures.

Converts a LectureReport's spoken text to MP3 audio via the ElevenLabs TTS API
and caches the result in the database (primary) and /tmp (secondary) so the same
lecture is only generated once, and the cache survives restarts.

Activated when ELEVENLABS_API_KEY is set in the environment; otherwise the app
falls back to text-only mode with no audio_url.

Voice personas (Professor Flora default; add more per faculty):
  - Professor Flora  (Cultivation & Horticulture)  — voice_id: EXAVITQu4vr4xnSDxMaL (Rachel)
  - Vera Lindqvist  (Plant Genetics)               — voice_id: ErXwobaYiN019PkySvjV (Antoni)
  - defaults to "Rachel" for all other departments
"""

import hashlib
import logging
import os
from pathlib import Path
from typing import Optional

import requests

logger = logging.getLogger(__name__)

# Secondary on-disk cache (survives the process but not a clean deploy).
_CACHE_DIR = Path(os.environ.get("NARRATION_CACHE_DIR", "/tmp/growpod_narration"))

# Map curriculum department keys → ElevenLabs voice IDs
_DEPT_VOICES = {
    "cultivation":  "EXAVITQu4vr4xnSDxMaL",   # Rachel — Professor Flora
    "genetics":     "ErXwobaYiN019PkySvjV",    # Antoni — Vera Lindqvist
    "nutrients":    "EXAVITQu4vr4xnSDxMaL",
    "ipm":          "EXAVITQu4vr4xnSDxMaL",
    "chemistry":    "ErXwobaYiN019PkySvjV",
    "postharvest":  "EXAVITQu4vr4xnSDxMaL",
}
_DEFAULT_VOICE = "EXAVITQu4vr4xnSDxMaL"


def _voice_for(department: str | None) -> str:
    return _DEPT_VOICES.get(department or "", _DEFAULT_VOICE)


def _text_hash(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()[:16]


def _cache_path(voice_id: str, text: str) -> Path:
    digest = _text_hash(text)
    return _CACHE_DIR / f"{voice_id}_{digest}.mp3"


def _build_spoken_text(lecture: dict) -> str:
    """Combine title + summary + content into the spoken script (≤ 5000 chars
    so it fits inside the ElevenLabs free-tier limit per request)."""
    parts = []
    if lecture.get("title"):
        parts.append(lecture["title"] + ".")
    if lecture.get("summary"):
        parts.append(lecture["summary"])
    if lecture.get("content"):
        # Take first ~3000 chars of the body to stay within the limit
        parts.append(lecture["content"][:3000])
    return "\n\n".join(parts)


def build_course_spoken_text(course: dict) -> str:
    """Build a short spoken script from the static curriculum course dict.

    Used by the /audio endpoint so the same stable text is always hashed the
    same way regardless of which AI-generated lecture variant was produced."""
    lecture = course.get("lecture") or {}
    parts = [course.get("name", "")]
    topic = lecture.get("topic")
    if topic:
        parts.append(topic)
    objectives = lecture.get("objectives") or []
    if objectives:
        parts.append("Learning objectives. " + " ".join(objectives))
    return "\n\n".join(p for p in parts if p)


def _call_elevenlabs(voice_id: str, text: str, api_key: str) -> bytes:
    """Call ElevenLabs TTS and return raw MP3 bytes. Raises on failure."""
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    payload = {
        "text": text,
        "model_id": "eleven_turbo_v2",
        "voice_settings": {"stability": 0.45, "similarity_boost": 0.82},
    }
    resp = requests.post(
        url,
        json=payload,
        headers={"xi-api-key": api_key, "Content-Type": "application/json"},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.content


def generate_narration(
    lecture: dict,
    department: str | None = None,
    api_key: str | None = None,
    session=None,
) -> str | None:
    """
    Generate TTS audio for *lecture* and return a file path to the cached MP3.
    Returns None if no API key is available or if generation fails.

    Caching order:
      1. Database `lecture_audio` table (if *session* is provided) — survives restarts.
      2. /tmp on-disk cache — fast secondary cache.
      3. ElevenLabs API call — writes to both caches on success.

    Parameters
    ----------
    lecture:    dict with keys title / summary / content (from LectureReport)
    department: curriculum department key (used to pick a voice persona)
    api_key:    ElevenLabs API key; falls back to ELEVENLABS_API_KEY env var
    session:    optional SQLAlchemy Session for DB-level caching
    """
    key = api_key or os.environ.get("ELEVENLABS_API_KEY")
    if not key:
        # No key — still serve from cache if a previous call stored audio.
        voice_id = _voice_for(department)
        text = _build_spoken_text(lecture)
        path = _cache_path(voice_id, text)
        if path.exists():
            return str(path)
        if session is not None:
            mp3 = _db_get(session, voice_id, text)
            if mp3:
                _write_tmp_cache(path, mp3)
                return str(path)
        return None

    voice_id = _voice_for(department)
    text = _build_spoken_text(lecture)
    path = _cache_path(voice_id, text)

    # 1. /tmp hit
    if path.exists():
        logger.info("narration /tmp cache hit: %s", path.name)
        return str(path)

    # 2. DB hit
    if session is not None:
        mp3 = _db_get(session, voice_id, text)
        if mp3:
            logger.info("narration DB cache hit for hash %s", _text_hash(text))
            _write_tmp_cache(path, mp3)
            return str(path)

    # 3. Generate
    try:
        mp3 = _call_elevenlabs(voice_id, text, key)
        _write_tmp_cache(path, mp3)
        if session is not None:
            _db_put(session, voice_id, text, mp3)
        logger.info("narration generated and cached: %s", path.name)
        return str(path)
    except Exception as exc:
        logger.warning("ElevenLabs narration failed: %s", exc)
        return None


def is_course_audio_cached(course: dict, session=None) -> bool:
    """Return True if MP3 bytes for this course are already in /tmp or the DB cache.

    Used by the audio endpoint to set the X-Audio-Cache-Status response header
    without modifying the generation pipeline."""
    department = course.get("department")
    voice_id = _voice_for(department)
    text = build_course_spoken_text(course)
    path = _cache_path(voice_id, text)
    if path.exists():
        return True
    if session is not None:
        return bool(_db_get(session, voice_id, text))
    return False


def generate_narration_for_course(
    course: dict,
    api_key: str | None = None,
    session=None,
) -> Optional[bytes]:
    """Generate (or retrieve from cache) MP3 bytes for a static curriculum course.

    Uses `build_course_spoken_text` so the hash is stable across AI lecture
    variants and can be served by the /audio endpoint without re-generation.

    Returns raw MP3 bytes on success, None if unavailable.
    """
    key = api_key or os.environ.get("ELEVENLABS_API_KEY")
    department = course.get("department")
    voice_id = _voice_for(department)
    text = build_course_spoken_text(course)
    path = _cache_path(voice_id, text)

    # 1. /tmp hit
    if path.exists():
        return path.read_bytes()

    # 2. DB hit
    if session is not None:
        mp3 = _db_get(session, voice_id, text)
        if mp3:
            _write_tmp_cache(path, mp3)
            return mp3

    if not key:
        return None

    # 3. Generate
    try:
        mp3 = _call_elevenlabs(voice_id, text, key)
        _write_tmp_cache(path, mp3)
        if session is not None:
            _db_put(session, voice_id, text, mp3)
        return mp3
    except Exception as exc:
        logger.warning("ElevenLabs course narration failed: %s", exc)
        return None


# --------------------------------------------------------------------------
# DB helpers (imported lazily to avoid circular imports at module load time).
# --------------------------------------------------------------------------

def _db_get(session, voice_id: str, text: str) -> Optional[bytes]:
    try:
        from ..db.models import LectureAudio
        digest = _text_hash(text)
        row = (
            session.query(LectureAudio)
            .filter(LectureAudio.voice_id == voice_id, LectureAudio.text_hash == digest)
            .first()
        )
        return row.mp3_data if row else None
    except Exception as exc:
        logger.warning("DB narration cache get failed: %s", exc)
        return None


def _db_put(session, voice_id: str, text: str, mp3: bytes) -> None:
    try:
        from ..db.models import LectureAudio
        from ..db.base import new_uuid
        digest = _text_hash(text)
        existing = (
            session.query(LectureAudio)
            .filter(LectureAudio.voice_id == voice_id, LectureAudio.text_hash == digest)
            .first()
        )
        if existing is None:
            session.add(LectureAudio(
                id=new_uuid(), voice_id=voice_id, text_hash=digest, mp3_data=mp3
            ))
            session.flush()
    except Exception as exc:
        logger.warning("DB narration cache put failed: %s", exc)


def _write_tmp_cache(path: Path, mp3: bytes) -> None:
    try:
        _CACHE_DIR.mkdir(parents=True, exist_ok=True)
        path.write_bytes(mp3)
    except Exception as exc:
        logger.warning("Failed to write /tmp narration cache: %s", exc)
