"""Terpene -> effect (buff) engine + the public /strains/<id>/effects route.

The engine is pure and data-driven (data/terpene_effects.yaml), so most of these
assert behaviour against the knowledge-base palette
(knowledge-base/strain-classification-and-quality.md §3): myrcene -> sedation,
limonene -> mood/energy, pinene -> focus, etc.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import pytest

from growpodempire.api.flask_api import create_app
from growpodempire.db.session import session_scope
from growpodempire.db.models import Strain
from growpodempire.services import effects_service as fx


# ---- pure engine -------------------------------------------------------------

def test_canonical_terpene_resolves_aliases_and_case():
    assert fx.canonical_terpene("alpha-pinene") == "pinene"
    assert fx.canonical_terpene("Limonene") == "limonene"
    assert fx.canonical_terpene("beta-caryophyllene") == "caryophyllene"
    assert fx.canonical_terpene("ocimene") is None  # aroma-only, no buff hook
    assert fx.canonical_terpene("not-a-terpene") is None
    assert fx.canonical_terpene("") is None


def test_myrcene_is_sedating_and_body_leaning():
    # Arrange / Act
    profile = fx.profile_for_strain(["myrcene"])
    # Assert — myrcene's headline effect is sedation, and it pulls toward body.
    assert profile["dominant_effect"] == "sedation"
    tags = {e["tag"] for e in profile["effects"]}
    assert "sedation" in tags and "relaxation" in tags
    assert profile["axis"]["lean"] < 0  # body-leaning
    assert profile["flavor_families"] == ["savory"]


def test_limonene_is_mind_leaning_uplift():
    profile = fx.profile_for_strain(["limonene"])
    tags = {e["tag"] for e in profile["effects"]}
    assert {"euphoria", "energy"} <= tags
    assert profile["axis"]["lean"] > 0  # mind-leaning


def test_pinene_grants_focus_regardless_of_spectrum():
    profile = fx.profile_for_strain(["pinene"])
    assert profile["dominant_effect"] == "focus"


def test_baseline_terpenes_do_not_add_noise():
    # A single-terpene strain should not surface effects from the seven other
    # palette terpenes sitting at baseline intensity.
    profile = fx.profile_for_strain(["myrcene"])
    tags = {e["tag"] for e in profile["effects"]}
    # focus/clarity come only from pinene, which is not present here.
    assert "focus" not in tags and "clarity" not in tags
    assert all(e["score"] > 0 for e in profile["effects"])


def test_empty_terpenes_is_a_clean_empty_profile():
    profile = fx.profile_for_strain([])
    assert profile["effects"] == []
    assert profile["dominant_effect"] is None
    assert profile["entourage"]["active"] is False
    assert profile["axis"]["lean"] == 0.0


def test_entourage_activates_and_boosts_scores():
    two = fx.profile_for_strain(["myrcene", "limonene"])
    three = fx.profile_for_strain(["myrcene", "limonene", "pinene"])
    assert two["entourage"]["active"] is False
    assert three["entourage"]["active"] is True
    assert three["entourage"]["bonus"] > 1.0
    # The shared pool of effects is multiplied up under entourage.
    assert three["entourage"]["terpene_count"] == 3


def test_scores_are_clamped_to_0_100():
    profile = fx.profile_for_strain(["myrcene", "linalool", "caryophyllene"])
    for e in profile["effects"]:
        assert 0 < e["score"] <= 100


def test_aroma_only_terpene_has_no_buff_but_is_ignored_cleanly():
    # Durban-Poison-like: terpinolene (palette) + ocimene (aroma-only).
    with_ocimene = fx.profile_for_strain(["terpinolene", "ocimene"])
    without = fx.profile_for_strain(["terpinolene"])
    assert with_ocimene["effects"] == without["effects"]


def test_genome_overrides_tag_intensity_for_modelled_genes():
    # Build a minimal genome where the myrcene gene is strongly expressed; even
    # without a myrcene *tag*, the expressed gene should surface sedation.
    genome = {"myrcene": {"value": 0.9}}
    profile = fx.profile_for_strain([], genome)
    tags = {e["tag"] for e in profile["effects"]}
    assert "sedation" in tags


# ---- public API route --------------------------------------------------------

@pytest.fixture()
def client(db):
    return create_app(init_database=False).test_client()


def test_effects_route_returns_profile_for_catalog_strain(client):
    with session_scope() as s:
        strain = s.query(Strain).first()
        strain_id = strain.id

    resp = client.get(f"/api/game/strains/{strain_id}/effects")
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["strain_id"] == strain_id
    assert "profile" in body
    assert "effects" in body["profile"]
    assert "axis" in body["profile"]
    assert "entourage" in body["profile"]


def test_effects_route_is_public_no_auth_required(client):
    # No API key header — reads are public.
    with session_scope() as s:
        strain_id = s.query(Strain).first().id
    assert client.get(f"/api/game/strains/{strain_id}/effects").status_code == 200


def test_effects_route_404_for_unknown_strain(client):
    resp = client.get("/api/game/strains/does-not-exist/effects")
    assert resp.status_code == 404


# ---- harvest serialization carries a grow-dependent effect signature ---------

def test_harvest_dict_includes_effect_profile_from_expressed_terpenes():
    from types import SimpleNamespace
    from growpodempire.api.serialize import harvest_dict

    # A batch that expressed myrcene strongly -> a sedation-led effect profile.
    harvest = SimpleNamespace(
        id="h1", player_id="p1", plant_id="pl1", strain_id="s1",
        weight_g=42.0, quality=80.0, thc_actual=22.0, cbd_actual=1.0,
        rarity_snapshot="rare", terpenes={"myrcene": 0.8, "limonene": 0.1},
        sale_value=None, sold=False, cure_status="curing",
        cure_started_at=None, cure_target_hours=72, cure_quality_bonus=0.0,
        harvested_at=None, nft_asset_id=None, nft_status=None,
    )
    out = harvest_dict(harvest)
    assert "effect_profile" in out
    assert out["effect_profile"]["dominant_effect"] == "sedation"


def test_harvest_dict_handles_missing_terpenes():
    from types import SimpleNamespace
    from growpodempire.api.serialize import harvest_dict

    harvest = SimpleNamespace(
        id="h2", player_id="p1", plant_id="pl1", strain_id="s1",
        weight_g=10.0, quality=50.0, thc_actual=15.0, cbd_actual=2.0,
        rarity_snapshot="common", terpenes=None,
        sale_value=None, sold=False, cure_status=None,
        cure_started_at=None, cure_target_hours=0, cure_quality_bonus=0.0,
        harvested_at=None, nft_asset_id=None, nft_status=None,
    )
    out = harvest_dict(harvest)
    assert out["effect_profile"]["effects"] == []
