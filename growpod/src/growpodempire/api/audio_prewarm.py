"""
Background audio pre-warm: generates ElevenLabs MP3 for every curriculum
course at server startup so the first player request always hits the DB cache.

Design
------
* `start_prewarm_thread()` spawns a daemon thread so startup is never blocked.
* A module-level `threading.Event` (`PREWARM_DONE`) lets callers wait for
  completion with a short timeout before falling through to live generation.
* Each course is checked in two layers:
    1. DB (`lecture_audio` table) — the durable, restart-safe cache.
    2. /tmp on-disk cache — fast secondary layer.
  If /tmp has a file but the DB row is missing, the row is backfilled so
  subsequent server restarts hit the DB and don't need to call ElevenLabs.
* Any individual course failure is logged and skipped; the rest continue.
"""

import logging
import threading
from typing import Optional

logger = logging.getLogger(__name__)

# Set when all courses have been processed (success or graceful skip).
# Initialized as SET so that environments without ELEVENLABS_API_KEY never
# block on wait_for_prewarm().  start_prewarm_thread() clears it first and
# the thread sets it again when done.
PREWARM_DONE: threading.Event = threading.Event()
PREWARM_DONE.set()  # default: no prewarm running → return immediately


def prewarm_course_audio() -> None:
    """
    Iterate every course in the curriculum and ensure MP3 bytes exist in both
    the DB (`lecture_audio` table) and the /tmp on-disk cache.

    Guarantees
    ----------
    * DB row is always written (even when /tmp already had a file) so the
      cache survives restarts without hitting ElevenLabs again.
    * /tmp file is always written so in-process requests are served off disk.
    * `PREWARM_DONE` is set whether all courses succeeded or not so callers
      don't block indefinitely on partial failures.
    """
    import os

    api_key = os.environ.get("ELEVENLABS_API_KEY")
    if not api_key:
        logger.info("audio_prewarm: ELEVENLABS_API_KEY not set — skipping")
        PREWARM_DONE.set()
        return

    try:
        from ..services.university_service import load_curriculum
        from ..ai.elevenlabs_narrator import (
            build_course_spoken_text,
            generate_narration_for_course,
            _voice_for,
            _text_hash,
            _cache_path,
            _db_get,
            _db_put,
            _write_tmp_cache,
        )
        from ..db.session import session_scope
    except Exception as exc:
        logger.warning("audio_prewarm: failed to import dependencies: %s", exc)
        PREWARM_DONE.set()
        return

    try:
        curriculum = load_curriculum()
    except Exception as exc:
        logger.warning("audio_prewarm: failed to load curriculum: %s", exc)
        PREWARM_DONE.set()
        return

    courses = curriculum.get("courses") or {}
    total = len(courses)
    if total == 0:
        logger.info("audio_prewarm: no courses found in curriculum")
        PREWARM_DONE.set()
        return

    logger.info("audio_prewarm: pre-warming audio for %d courses", total)
    already_ok = backfilled = generated = errors = 0

    for course_key, course in courses.items():
        try:
            with session_scope() as s:
                text = build_course_spoken_text(course)
                voice_id = _voice_for(course.get("department"))
                path = _cache_path(voice_id, text)

                db_mp3: Optional[bytes] = _db_get(s, voice_id, text)
                tmp_exists: bool = path.exists()

                if db_mp3 and tmp_exists:
                    # Both layers warm — nothing to do.
                    already_ok += 1
                    logger.debug("audio_prewarm: fully cached — %s", course_key)
                    continue

                if tmp_exists and not db_mp3:
                    # /tmp present but DB missing — backfill DB so the cache
                    # survives the next restart without calling ElevenLabs.
                    mp3_bytes = path.read_bytes()
                    _db_put(s, voice_id, text, mp3_bytes)
                    backfilled += 1
                    logger.info("audio_prewarm: backfilled DB for %s", course_key)
                    continue

                if db_mp3 and not tmp_exists:
                    # DB present but /tmp missing — write /tmp for fast serving.
                    _write_tmp_cache(path, db_mp3)
                    backfilled += 1
                    logger.info("audio_prewarm: restored /tmp for %s", course_key)
                    continue

                # Neither layer has audio — call ElevenLabs.
                mp3 = generate_narration_for_course(course, api_key=api_key, session=s)
                if mp3:
                    generated += 1
                    logger.info(
                        "audio_prewarm: generated %s (%d bytes)", course_key, len(mp3)
                    )
                else:
                    errors += 1
                    logger.warning(
                        "audio_prewarm: no audio returned for %s", course_key
                    )
        except Exception as exc:
            errors += 1
            logger.warning("audio_prewarm: error for %s: %s", course_key, exc)

    logger.info(
        "audio_prewarm: done — %d fully cached, %d backfilled, %d generated, "
        "%d errors (total %d)",
        already_ok, backfilled, generated, errors, total,
    )
    PREWARM_DONE.set()


def start_prewarm_thread() -> threading.Thread:
    """
    Spawn a daemon thread to run `prewarm_course_audio`.

    Returns the thread so callers can join() it in tests if desired.
    The thread is a daemon so it never prevents a clean server shutdown.
    """
    PREWARM_DONE.clear()
    t = threading.Thread(target=prewarm_course_audio, name="audio-prewarm", daemon=True)
    t.start()
    logger.info("audio_prewarm: background thread started")
    return t


def wait_for_prewarm(timeout: float = 8.0) -> bool:
    """
    Block until prewarm completes or *timeout* seconds elapse.

    Returns True if prewarm finished within the timeout, False otherwise.
    Safe to call when no prewarm thread was started (returns True immediately
    because the event starts in its set state until `start_prewarm_thread`
    clears and re-sets it).
    """
    return PREWARM_DONE.wait(timeout=timeout)
