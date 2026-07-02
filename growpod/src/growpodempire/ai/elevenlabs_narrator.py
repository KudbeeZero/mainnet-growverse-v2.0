"""
ElevenLabs narration provider for GrowPod University lectures.

Converts a LectureReport's spoken text to MP3 audio via the ElevenLabs TTS API
and caches the result across three layers so the same lecture is only generated
once and audio survives container restarts / deployments.

Cache hierarchy (fastest → slowest)
-------------------------------------
  L1  /tmp on-disk — fast in-process serving; wiped on each deploy.
  L2  App Storage (GCS) — durable CDN-backed object store; persists across
      deploys.  Keyed as  audio/<voice_id>_<hash>.mp3.
  L3  DB `lecture_audio` table — durable BLOB fallback; used when object
      storage is not yet configured (local dev) or to backfill L2.

Flow when ElevenLabs key is present
-------------------------------------
  Hit L1 → return /tmp bytes
  Hit L2 → download from GCS → write /tmp → return bytes
  Hit L3 → upload to GCS (backfill L2) → write /tmp → return bytes
  Miss all → call ElevenLabs → upload to GCS → write DB → write /tmp → return

Flow without key (serve-from-cache only)
-----------------------------------------
  Same order, but returns None rather than calling ElevenLabs on a full miss.

Activated when ELEVENLABS_API_KEY is set in the environment; otherwise the app
falls back to text-only mode with no audio_url.

Voice personas (one per faculty; default is Adam for unknown departments):
  - Professor Flora   (Cultivation & Horticulture)  — Rachel  EXAVITQu4vr4xnSDxMaL
  - Vera Lindqvist   (Plant Genetics)               — Antoni  ErXwobaYiN019PkySvjV
  - Dr. Sage Harlow  (Soil & Nutrient Science)      — Charlotte XB0fDUnXU5powFXDhCwa
  - Dr. Mira Okafor  (Integrated Pest Management)   — Elli    MF3mGyEYCl7XYWbV9V6O
  - Dr. Chem Torres  (Cannabis Chemistry)           — Domi    AZnzlk1XvdvUeBnXmlld
  - Dr. Petra Nance  (Post-Harvest & Processing)    — Josh    TxGEqnHWrfWFTfGW9XjX
  - (unknown dept)   fallback                       — Adam    pNInz6obpgDQGcFmaJgB
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

# Map curriculum department keys → ElevenLabs voice IDs.
# Each department must map to a voice that differs from _DEFAULT_VOICE so that
# unknown future departments are audibly distinguishable from named faculty.
_DEPT_VOICES = {
    "cultivation":  "EXAVITQu4vr4xnSDxMaL",   # Rachel — Professor Flora
    "genetics":     "ErXwobaYiN019PkySvjV",    # Antoni — Vera Lindqvist
    "nutrients":    "XB0fDUnXU5powFXDhCwa",   # Charlotte — Dr. Sage Harlow (distinct from Flora)
    "ipm":          "MF3mGyEYCl7XYWbV9V6O",   # Elli   — Dr. Mira Okafor
    "chemistry":    "AZnzlk1XvdvUeBnXmlld",   # Domi   — Dr. Chem Torres
    "postharvest":  "TxGEqnHWrfWFTfGW9XjX",   # Josh   — Dr. Petra Nance
}
# Fallback for any department key not yet mapped above (Adam).
# Must be a voice ID not used by any named faculty in _DEPT_VOICES.
_DEFAULT_VOICE = "pNInz6obpgDQGcFmaJgB"


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
      1. /tmp on-disk cache (L1) — fast in-process serving.
      2. App Storage / GCS (L2) — durable across deploys; checked via DB row.
      3. Database `lecture_audio` table (L3) — durable BLOB; backfills L2.
      4. ElevenLabs API call — writes to all three caches on success.

    Parameters
    ----------
    lecture:    dict with keys title / summary / content (from LectureReport)
    department: curriculum department key (used to pick a voice persona)
    api_key:    ElevenLabs API key; falls back to ELEVENLABS_API_KEY env var
    session:    optional SQLAlchemy Session for DB-level caching
    """
    from .object_storage import gcs_get, gcs_put

    key = api_key or os.environ.get("ELEVENLABS_API_KEY")

    voice_id = _voice_for(department)
    text = _build_spoken_text(lecture)
    digest = _text_hash(text)
    path = _cache_path(voice_id, text)

    # 1. /tmp hit
    if path.exists():
        logger.info("narration /tmp cache hit: %s", path.name)
        return str(path)

    # 2. GCS / DB hit
    if session is not None:
        row = _db_get_row(session, voice_id, text)
        if row:
            mp3: Optional[bytes] = None
            # Try object storage first (L2)
            if row.object_path:
                mp3 = gcs_get(row.object_path)
                if mp3:
                    logger.info("narration GCS cache hit: %s", row.object_path)
            # Fall back to DB BLOB (L3) and backfill GCS
            if mp3 is None and row.mp3_data:
                mp3 = row.mp3_data
                logger.info("narration DB cache hit for hash %s", digest)
                obj_path = gcs_put(voice_id, digest, mp3)
                if obj_path:
                    _db_set_object_path(session, row, obj_path)
            if mp3:
                _write_tmp_cache(path, mp3)
                return str(path)

    if not key:
        return None

    # 3. Generate
    try:
        mp3 = _call_elevenlabs(voice_id, text, key)
        _write_tmp_cache(path, mp3)
        obj_path = gcs_put(voice_id, digest, mp3)
        if session is not None:
            _db_put(session, voice_id, text, mp3, object_path=obj_path)
        logger.info("narration generated and cached: %s", path.name)
        return str(path)
    except Exception as exc:
        logger.warning("ElevenLabs narration failed: %s", exc)
        return None


def is_course_audio_cached(course: dict, session=None) -> bool:
    """Return True if MP3 bytes for this course are already cached.

    Checks /tmp, then GCS (via DB object_path), then DB BLOB.
    Used by the audio endpoint to set the X-Audio-Cache-Status response header
    without modifying the generation pipeline."""
    from .object_storage import gcs_exists

    department = course.get("department")
    voice_id = _voice_for(department)
    text = build_course_spoken_text(course)
    path = _cache_path(voice_id, text)
    if path.exists():
        return True
    if session is not None:
        row = _db_get_row(session, voice_id, text)
        if row:
            if row.object_path and gcs_exists(row.object_path):
                return True
            if row.mp3_data:
                return True
    return False


def generate_narration_for_course(
    course: dict,
    api_key: str | None = None,
    session=None,
) -> Optional[bytes]:
    """Generate (or retrieve from cache) MP3 bytes for a static curriculum course.

    Uses `build_course_spoken_text` so the hash is stable across AI lecture
    variants and can be served by the /audio endpoint without re-generation.

    Caching order:
      1. /tmp on-disk cache (L1) — fast in-process serving.
      2. App Storage / GCS (L2) — durable across deploys; survives restarts.
      3. Database `lecture_audio` BLOB (L3) — backfills GCS on miss.
      4. ElevenLabs API — writes to GCS + DB + /tmp on success.

    Returns raw MP3 bytes on success, None if unavailable.
    """
    from .object_storage import gcs_get, gcs_put

    key = api_key or os.environ.get("ELEVENLABS_API_KEY")
    department = course.get("department")
    voice_id = _voice_for(department)
    text = build_course_spoken_text(course)
    digest = _text_hash(text)
    path = _cache_path(voice_id, text)

    # 1. /tmp hit (L1)
    if path.exists():
        logger.info("course narration /tmp hit: %s", path.name)
        return path.read_bytes()

    # 2. GCS hit or DB hit (L2 / L3)
    if session is not None:
        row = _db_get_row(session, voice_id, text)
        if row:
            mp3: Optional[bytes] = None
            # Try object storage first (L2)
            if row.object_path:
                mp3 = gcs_get(row.object_path)
                if mp3:
                    logger.info("course narration GCS hit: %s", row.object_path)
            # Fall back to DB BLOB (L3) and backfill GCS
            if mp3 is None and row.mp3_data:
                mp3 = row.mp3_data
                logger.info("course narration DB hit for hash %s", digest)
                obj_path = gcs_put(voice_id, digest, mp3)
                if obj_path:
                    _db_set_object_path(session, row, obj_path)
            if mp3:
                _write_tmp_cache(path, mp3)
                return mp3

    if not key:
        return None

    # 3. Generate via ElevenLabs (L4)
    try:
        mp3 = _call_elevenlabs(voice_id, text, key)
        _write_tmp_cache(path, mp3)
        obj_path = gcs_put(voice_id, digest, mp3)
        if session is not None:
            _db_put(session, voice_id, text, mp3, object_path=obj_path)
        logger.info(
            "course narration generated: hash=%s gcs=%s bytes=%d",
            digest, obj_path, len(mp3),
        )
        return mp3
    except Exception as exc:
        logger.warning("ElevenLabs course narration failed: %s", exc)
        return None


def get_course_audio_object_path(course: dict, session=None) -> Optional[str]:
    """Return the GCS object_path for a course if one is stored in the DB.

    Used by the audio endpoint to check whether it can stream from object
    storage before falling through to on-demand generation.  Returns None
    when object storage is not available or no path is recorded yet.
    """
    department = course.get("department")
    voice_id = _voice_for(department)
    text = build_course_spoken_text(course)
    if session is None:
        return None
    row = _db_get_row(session, voice_id, text)
    return row.object_path if row else None


# --------------------------------------------------------------------------
# DB helpers (imported lazily to avoid circular imports at module load time).
# --------------------------------------------------------------------------

def _db_get_row(session, voice_id: str, text: str):
    """Return the full LectureAudio ORM row, or None."""
    try:
        from ..db.models import LectureAudio
        digest = _text_hash(text)
        return (
            session.query(LectureAudio)
            .filter(LectureAudio.voice_id == voice_id, LectureAudio.text_hash == digest)
            .first()
        )
    except Exception as exc:
        logger.warning("DB narration row get failed: %s", exc)
        return None


def _db_get(session, voice_id: str, text: str) -> Optional[bytes]:
    """Return cached MP3 bytes from the DB BLOB, or None."""
    row = _db_get_row(session, voice_id, text)
    if row is None:
        return None
    return row.mp3_data


def _db_put(session, voice_id: str, text: str, mp3: bytes, object_path: Optional[str] = None) -> None:
    try:
        from ..db.models import LectureAudio
        from ..db.base import new_uuid
        from sqlalchemy.exc import IntegrityError
        digest = _text_hash(text)
        existing = _db_get_row(session, voice_id, text)
        if existing is None:
            try:
                session.add(LectureAudio(
                    id=new_uuid(),
                    voice_id=voice_id,
                    text_hash=digest,
                    mp3_data=mp3,
                    object_path=object_path,
                ))
                session.flush()
            except IntegrityError:
                # Another concurrent request already inserted this row — roll
                # back the flush and try to backfill the object_path instead.
                session.rollback()
                existing = _db_get_row(session, voice_id, text)
                if existing and object_path and not existing.object_path:
                    existing.object_path = object_path
                    session.flush()
        elif object_path and not existing.object_path:
            existing.object_path = object_path
            session.flush()
    except Exception as exc:
        logger.warning("DB narration cache put failed: %s", exc)


def _db_set_object_path(session, row, object_path: str) -> None:
    """Update an existing LectureAudio row with a GCS object_path."""
    try:
        row.object_path = object_path
        session.flush()
        logger.info("DB narration object_path set: %s", object_path)
    except Exception as exc:
        logger.warning("DB narration set object_path failed: %s", exc)


def _write_tmp_cache(path: Path, mp3: bytes) -> None:
    try:
        _CACHE_DIR.mkdir(parents=True, exist_ok=True)
        path.write_bytes(mp3)
    except Exception as exc:
        logger.warning("Failed to write /tmp narration cache: %s", exc)
