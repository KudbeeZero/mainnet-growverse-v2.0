"""
ElevenLabs narration provider for GrowPod University lectures.

Converts a LectureReport's spoken text to MP3 audio via the ElevenLabs TTS API
and caches the result to disk so the same lecture is only generated once.

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

import requests

logger = logging.getLogger(__name__)

# One TTS request per unique (voice_id, text_hash) pair.
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


def _cache_path(voice_id: str, text: str) -> Path:
    digest = hashlib.sha256(text.encode()).hexdigest()[:16]
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


def generate_narration(
    lecture: dict,
    department: str | None = None,
    api_key: str | None = None,
) -> str | None:
    """
    Generate TTS audio for *lecture* and return a file path to the cached MP3.
    Returns None if no API key is available or if generation fails.

    Parameters
    ----------
    lecture:    dict with keys title / summary / content (from LectureReport)
    department: curriculum department key (used to pick a voice persona)
    api_key:    ElevenLabs API key; falls back to ELEVENLABS_API_KEY env var
    """
    key = api_key or os.environ.get("ELEVENLABS_API_KEY")
    if not key:
        return None

    voice_id = _voice_for(department)
    text = _build_spoken_text(lecture)
    path = _cache_path(voice_id, text)

    if path.exists():
        logger.info("narration cache hit: %s", path.name)
        return str(path)

    _CACHE_DIR.mkdir(parents=True, exist_ok=True)
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    payload = {
        "text": text,
        "model_id": "eleven_turbo_v2",
        "voice_settings": {"stability": 0.45, "similarity_boost": 0.82},
    }
    try:
        resp = requests.post(
            url,
            json=payload,
            headers={"xi-api-key": key, "Content-Type": "application/json"},
            timeout=30,
        )
        resp.raise_for_status()
        path.write_bytes(resp.content)
        logger.info("narration generated and cached: %s", path.name)
        return str(path)
    except Exception as exc:
        logger.warning("ElevenLabs narration failed: %s", exc)
        return None
