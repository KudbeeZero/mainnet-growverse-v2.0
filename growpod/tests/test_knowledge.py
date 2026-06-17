"""Strain knowledge base: every catalog strain has a scientist-grade entry."""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from growpodempire.db.models import Strain
from growpodempire.services.game_service import GameService, load_strain_knowledge

# Fields a scientist-grade entry must carry.
REQUIRED_KEYS = {"lineage", "origin", "genotype", "aroma", "effects", "terpenes",
                 "cannabinoids", "grow", "notes"}
REQUIRED_GROW_KEYS = {"difficulty", "flowering_weeks", "optimal"}


def test_every_catalog_strain_has_a_knowledge_entry(session):
    """Sync invariant: each seeded base strain has an encyclopedia entry."""
    kb = load_strain_knowledge()
    catalog = session.query(Strain).filter(Strain.is_base_catalog.is_(True)).all()
    assert len(catalog) >= 22  # the founders + the new iconic additions
    missing = [s.slug for s in catalog if s.slug not in kb]
    assert not missing, f"strains with no knowledge entry: {missing}"


def test_no_orphan_knowledge_entries(session):
    """Every knowledge key maps to a real seeded strain (no dangling encyclopedia)."""
    kb = load_strain_knowledge()
    slugs = {s.slug for s in session.query(Strain).all()}
    orphans = [slug for slug in kb if slug not in slugs]
    assert not orphans, f"knowledge entries with no strain: {orphans}"


def test_entries_are_scientist_grade():
    """Each entry carries the full required field set."""
    kb = load_strain_knowledge()
    for slug, entry in kb.items():
        assert REQUIRED_KEYS <= set(entry), f"{slug} missing {REQUIRED_KEYS - set(entry)}"
        assert REQUIRED_GROW_KEYS <= set(entry["grow"]), f"{slug} grow missing keys"
        assert {"temp_c", "vpd_kpa", "dli"} <= set(entry["grow"]["optimal"]), f"{slug} optimal incomplete"


def test_service_returns_knowledge_for_a_catalog_strain(session):
    svc = GameService(session)
    ww = session.query(Strain).filter(Strain.slug == "white-widow").one()
    out = svc.strain_knowledge(ww.id)
    assert out["in_knowledge_base"] is True
    assert out["knowledge"]["lineage"]
    assert out["knowledge"]["grow"]["optimal"]["vpd_kpa"]


def test_new_iconic_strain_is_seeded_with_knowledge(session):
    svc = GameService(session)
    ag = session.query(Strain).filter(Strain.slug == "acapulco-gold").one()
    out = svc.strain_knowledge(ag.id)
    assert out["in_knowledge_base"] is True
    assert "Mexico" in out["knowledge"]["origin"]


def test_bred_strain_has_no_encyclopedia_but_a_lineage_note(session):
    svc = GameService(session)
    p = svc.create_player("kb_breeder")
    a = session.query(Strain).filter(Strain.slug == "white-widow").one()
    b = session.query(Strain).filter(Strain.slug == "blue-dream").one()
    child = svc.breed(p.id, a.id, b.id)
    out = svc.strain_knowledge(child.id)
    assert out["in_knowledge_base"] is False
    assert "lineage" in out["note"]
