"""
HTTP-boundary coverage for the UNCOVERED audio/narration and chain-mint branches
of ``growpodempire.api.game_api`` (carried RISK: game_api thinly covered at the
HTTP layer).

Scope (branches not exercised by test_narration.py / test_http_boundary.py):

  * GET /university/courses/<key>/audio
      - course-not-found 404                                 (route line ~1213)
      - graceful no-audio 204 when no ElevenLabs key is set  (route line ~1228-9)
      - prewarm-wait branch when a key *is* configured        (route lines 1199-1208)
      - cached-bytes success -> 200 audio/mpeg                (route lines 1231-1241)
      - narrator exception -> graceful 204                    (route lines 1224-1226)
  * GET /players/<id>/courses/<key>/lecture
      - audio_url branch when a narration file exists         (route line 1135)
  * POST /players/<id>/strains/<sid>/mint
      - breeder happy path through the offline MockChainProvider (route lines 1856-1857)

The audio branches monkeypatch OUR OWN repo functions at the route's import
boundary (``growpodempire.ai.elevenlabs_narrator.generate_narration_for_course``
and ``.generate_narration``) — no third-party SDK is mocked.  The mint branch
uses the real offline MockChainProvider (no mocking, no network, no secrets),
selected automatically because no treasury mnemonic is configured in tests.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import pytest

from growpodempire.chain.factory import reset_shared_provider
from growpodempire.config import get_settings


@pytest.fixture()
def client(db, monkeypatch):
    """Flask test client on a fresh offline-mock chain, ElevenLabs key cleared."""
    from growpodempire.api.flask_api import create_app

    # No ElevenLabs key by default; tests that need one set it explicitly.
    monkeypatch.delenv("ELEVENLABS_API_KEY", raising=False)
    # Force the offline mock chain (no treasury config -> MockChainProvider).
    monkeypatch.delenv("ALGO_TREASURY_MNEMONIC", raising=False)
    monkeypatch.delenv("ASA_ID", raising=False)
    get_settings.cache_clear()
    reset_shared_provider()
    try:
        yield create_app(init_database=False).test_client()
    finally:
        reset_shared_provider()
        get_settings.cache_clear()


def _new_player(client, username="audiochain"):
    p = client.post("/api/game/players", json={"username": username}).get_json()
    return p["id"], p["api_key"]


# A plausible MP3 byte payload (ID3 header + frame bytes).
_FAKE_MP3 = b"ID3\x00\x00\x00" + b"\xff\xfb\x90\x00" * 64


# ---------------------------------------------------------------------------
# GET /university/courses/<course_key>/audio
# ---------------------------------------------------------------------------

def test_course_audio_unknown_course_returns_404(client):
    r = client.get("/api/game/university/courses/no-such-course/audio")
    assert r.status_code == 404


def test_course_audio_no_key_returns_204(client):
    """With no ElevenLabs key configured, the narrator returns None and the
    route serves a graceful 204 No Content (no audio yet)."""
    r = client.get("/api/game/university/courses/cult-101/audio")
    assert r.status_code == 204
    assert r.data == b""


def test_course_audio_success_returns_mpeg(client, monkeypatch):
    """Monkeypatch our OWN generate_narration_for_course to return fake mp3
    bytes -> the route streams them as audio/mpeg with a 200."""
    from growpodempire.ai import elevenlabs_narrator

    monkeypatch.setattr(
        elevenlabs_narrator, "generate_narration_for_course",
        lambda course, **kw: _FAKE_MP3,
    )
    # Report a cache miss so the X-Audio-Cache-Status header takes the "miss" arm.
    monkeypatch.setattr(
        elevenlabs_narrator, "is_course_audio_cached",
        lambda course, **kw: False,
    )

    r = client.get("/api/game/university/courses/cult-101/audio")
    assert r.status_code == 200
    assert r.mimetype == "audio/mpeg"
    assert r.data == _FAKE_MP3
    assert r.headers["X-Audio-Cache-Status"] == "miss"
    assert r.headers["Content-Length"] == str(len(_FAKE_MP3))
    assert "cult-101.mp3" in r.headers["Content-Disposition"]


def test_course_audio_cache_hit_header(client, monkeypatch):
    """When is_course_audio_cached reports a hit, the route emits the 'hit'
    cache-status header (the other arm of the same conditional)."""
    from growpodempire.ai import elevenlabs_narrator

    monkeypatch.setattr(
        elevenlabs_narrator, "generate_narration_for_course",
        lambda course, **kw: _FAKE_MP3,
    )
    monkeypatch.setattr(
        elevenlabs_narrator, "is_course_audio_cached",
        lambda course, **kw: True,
    )

    r = client.get("/api/game/university/courses/cult-101/audio")
    assert r.status_code == 200
    assert r.headers["X-Audio-Cache-Status"] == "hit"


def test_course_audio_narrator_exception_returns_204(client, monkeypatch):
    """If the narrator raises, the route swallows it and serves a graceful 204
    rather than a 500 (covers the except arm)."""
    from growpodempire.ai import elevenlabs_narrator

    def _boom(course, **kw):
        raise RuntimeError("narration backend exploded")

    monkeypatch.setattr(
        elevenlabs_narrator, "generate_narration_for_course", _boom
    )

    r = client.get("/api/game/university/courses/cult-101/audio")
    assert r.status_code == 204


def test_course_audio_prewarm_wait_branch(client, monkeypatch):
    """When an ElevenLabs key IS configured, the route enters the prewarm-wait
    branch before generating audio.  Force the key on, stub our narrator to
    return bytes, and assert the 200 success path still serves through the
    prewarm gate."""
    monkeypatch.setenv("ELEVENLABS_API_KEY", "test-key-prewarm")
    get_settings.cache_clear()

    from growpodempire.ai import elevenlabs_narrator

    monkeypatch.setattr(
        elevenlabs_narrator, "generate_narration_for_course",
        lambda course, **kw: _FAKE_MP3,
    )
    monkeypatch.setattr(
        elevenlabs_narrator, "is_course_audio_cached",
        lambda course, **kw: True,
    )

    r = client.get("/api/game/university/courses/cult-101/audio")
    assert r.status_code == 200
    assert r.mimetype == "audio/mpeg"


def test_course_audio_prewarm_timeout_logs_and_falls_through(client, monkeypatch):
    """When prewarm hasn't finished within the timeout, the route logs and
    falls through to on-demand generation (covers the 'prewarm still running'
    arm).  We monkeypatch OUR OWN wait_for_prewarm to report not-yet-done."""
    monkeypatch.setenv("ELEVENLABS_API_KEY", "test-key-prewarm-timeout")
    get_settings.cache_clear()

    from growpodempire.api import audio_prewarm
    from growpodempire.ai import elevenlabs_narrator

    monkeypatch.setattr(audio_prewarm, "wait_for_prewarm", lambda timeout=8.0: False)
    monkeypatch.setattr(
        elevenlabs_narrator, "generate_narration_for_course",
        lambda course, **kw: _FAKE_MP3,
    )
    monkeypatch.setattr(
        elevenlabs_narrator, "is_course_audio_cached",
        lambda course, **kw: False,
    )

    r = client.get("/api/game/university/courses/cult-101/audio")
    assert r.status_code == 200
    assert r.mimetype == "audio/mpeg"


# ---------------------------------------------------------------------------
# GET /players/<id>/courses/<course_key>/lecture  (audio_url branch)
# ---------------------------------------------------------------------------

def test_lecture_includes_audio_url_when_narration_present(client, monkeypatch):
    """When generate_narration returns a (cached) audio path, the lecture
    payload advertises the narration URL (route line ~1135)."""
    pid, key = _new_player(client, "lecturelistener")
    hdr = {"X-API-Key": key}

    from growpodempire.ai import elevenlabs_narrator

    # Our own narrator returns a truthy path -> audio_url branch is taken. The
    # cache filename is "{voice_id}_{content_hash}.mp3"; the route threads that
    # content hash into the URL as ?h= so serve_narration can return exactly this
    # lecture's audio rather than any file sharing the department voice.
    monkeypatch.setattr(
        elevenlabs_narrator, "generate_narration",
        lambda payload, department=None, api_key=None: "/tmp/VOICEID_0123456789abcdef.mp3",
    )

    r = client.get(
        f"/api/game/players/{pid}/courses/cult-101/lecture",
        headers=hdr,
    )
    assert r.status_code == 200
    body = r.get_json()
    assert body.get("audio_url") == "/api/game/narration/cult-101/beginner?h=0123456789abcdef"


def test_lecture_without_narration_has_no_audio_url(client, monkeypatch):
    """No narration path -> the audio_url branch is skipped (the falsy arm)."""
    pid, key = _new_player(client, "lecturenoaudio")
    hdr = {"X-API-Key": key}

    from growpodempire.ai import elevenlabs_narrator

    monkeypatch.setattr(
        elevenlabs_narrator, "generate_narration",
        lambda payload, department=None, api_key=None: None,
    )

    r = client.get(
        f"/api/game/players/{pid}/courses/cult-101/lecture",
        headers=hdr,
    )
    assert r.status_code == 200
    assert "audio_url" not in r.get_json()


# ---------------------------------------------------------------------------
# POST /players/<id>/strains/<strain_id>/mint  (breeder happy path)
# ---------------------------------------------------------------------------

def test_mint_strain_breeder_happy_path(client):
    """The route's success path (mint -> strain_dict -> 201) is only reachable
    for the strain's breeder with a stable, mint-eligible strain.  Build such a
    strain via the ORM owned by an HTTP-created player, then mint it over the
    route through the offline MockChainProvider (no chain mocking)."""
    from growpodempire.db.session import session_scope
    from growpodempire.db.models import Strain
    from growpodempire.enums import Rarity, LineageType
    from growpodempire.genetics.traits import genome_from_traits

    pid, key = _new_player(client, "strainbreeder")
    hdr = {"X-API-Key": key}

    with session_scope() as s:
        stable = Strain(
            name="Route Champion",
            slug="route-champion",
            lineage_type=LineageType.BRED.value,
            rarity=Rarity.EPIC.value,
            indica_ratio=0.5, thc_min=27, thc_max=28, cbd_min=0.3, cbd_max=0.5,
            flowering_days_min=60, flowering_days_max=62,
            yield_min=500, yield_max=520,
            difficulty=3, terpenes=["limonene"],
            genome=genome_from_traits({"thc": 28, "yield": 600}),
            stability=0.92, generation=4, is_base_catalog=False,
            created_by_player_id=pid,
        )
        s.add(stable)
        s.flush()
        sid = stable.id

    r = client.post(
        f"/api/game/players/{pid}/strains/{sid}/mint", headers=hdr
    )
    assert r.status_code == 201
    body = r.get_json()
    assert body["nft_status"] == "minted"
    assert body["nft_asset_id"] is not None

    # Idempotent: minting again returns the same minted asset (success path again).
    r2 = client.post(
        f"/api/game/players/{pid}/strains/{sid}/mint", headers=hdr
    )
    assert r2.status_code == 201
    assert r2.get_json()["nft_asset_id"] == body["nft_asset_id"]
