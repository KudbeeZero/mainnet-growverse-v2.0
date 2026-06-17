"""Provable fairness: a bred strain's genome must re-derive from its seed."""

import copy
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from growpodempire.db.models import Strain
from growpodempire.services.game_service import GameService


def _breed(session, username="breeder"):
    svc = GameService(session)
    p = svc.create_player(username)
    a = session.query(Strain).filter(Strain.slug == "white-widow").one()
    b = session.query(Strain).filter(Strain.slug == "blue-dream").one()
    child = svc.breed(p.id, a.id, b.id)
    return svc, child


def test_bred_strain_verifies(session):
    svc, child = _breed(session)
    proof = svc.verify_strain(child.id)
    assert proof["verifiable"] is True
    assert proof["verified"] is True
    assert proof["max_value_delta"] == 0.0
    assert proof["mismatched_traits"] == []
    assert proof["rng_seed"] is not None
    assert proof["parent_a_id"] and proof["parent_b_id"]


def test_tampered_genome_fails_verification(session):
    """If a strain's stored genome is altered, replay no longer matches."""
    svc, child = _breed(session, username="tamperer")
    tampered = copy.deepcopy(child.genome)
    tampered["thc"]["value"] = 999.0
    child.genome = tampered
    session.flush()
    proof = svc.verify_strain(child.id)
    assert proof["verifiable"] is True
    assert proof["verified"] is False
    assert "thc" in proof["mismatched_traits"]
    assert proof["max_value_delta"] > 1.0


def test_base_catalog_strain_is_not_verifiable(session):
    svc = GameService(session)
    base = session.query(Strain).filter(Strain.is_base_catalog.is_(True)).first()
    proof = svc.verify_strain(base.id)
    assert proof["verifiable"] is False
    assert "reason" in proof


# ----- Verifiable pedigree / lineage ------------------------------------------
def test_lineage_verifies_back_to_base_roots(session):
    """A bred strain's whole ancestry replays: the child + its two base roots."""
    svc, child = _breed(session, username="genealogist")
    out = svc.verify_lineage(child.id)
    assert out["fully_verified"] is True
    assert out["node_count"] == 3          # child + 2 base-catalog parents
    assert out["root_count"] == 2
    assert out["truncated"] is False
    head = next(n for n in out["lineage"] if n["strain_id"] == child.id)
    assert head["verified"] is True


def test_lineage_spans_multiple_generations(session):
    """Breed then stabilize: the S2 line traces through its parent to the roots."""
    svc, child = _breed(session, username="liner")
    s2 = svc.stabilize_strain(child.created_by_player_id, child.id)
    out = svc.verify_lineage(s2.id)
    assert out["fully_verified"] is True
    ids = {n["strain_id"] for n in out["lineage"]}
    assert s2.id in ids and child.id in ids          # both bred generations present
    assert out["root_count"] == 2                     # the two original base roots


def test_lineage_flags_a_tampered_ancestor(session):
    """Tampering an ancestor's genome breaks fully_verified for the descendant."""
    svc, child = _breed(session, username="auditor")
    player_id = child.created_by_player_id
    s2 = svc.stabilize_strain(player_id, child.id)
    tampered = copy.deepcopy(child.genome)
    tampered["yield"]["value"] = -123.0
    child.genome = tampered
    session.flush()
    out = svc.verify_lineage(s2.id)
    assert out["fully_verified"] is False


def test_lineage_of_base_strain_is_a_single_root(session):
    svc = GameService(session)
    base = session.query(Strain).filter(Strain.is_base_catalog.is_(True)).first()
    out = svc.verify_lineage(base.id)
    assert out["node_count"] == 1
    assert out["root_count"] == 1
    assert out["fully_verified"] is True
