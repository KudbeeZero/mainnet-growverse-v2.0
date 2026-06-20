"""Unit tests for the rich PlantState / PartState working model (scaffold)."""

from types import SimpleNamespace

from growpodempire.simulation.state import PlantState, PartState


def _fake_plant():
    return SimpleNamespace(
        id="plant-1", genome={"flowering_time": {"value": 60}}, growth_stage="flowering",
        health=82.0, height=55.0, water_level=61.0, nutrient_level=58.0,
        pest_level=3.0, disease_level=1.0, condition_flags=[{"condition": "thirsty"}],
    )


def test_from_plant_copies_aggregates():
    st = PlantState.from_plant(_fake_plant())
    assert st.plant_id == "plant-1"
    assert st.stage == "flowering"
    assert st.overall_health == 82.0
    assert st.height_cm == 55.0
    assert st.water_level == 61.0
    assert st.nutrient_level == 58.0
    assert st.pest_level == 3.0
    assert st.disease_level == 1.0
    assert st.condition_flags == [{"condition": "thirsty"}]
    # Parts start empty until their engines populate them.
    assert st.roots == {} and st.stem == {} and st.leaves == [] and st.flowers == {}


def test_genome_and_flags_are_copied_not_aliased():
    p = _fake_plant()
    st = PlantState.from_plant(p)
    st.genome["x"] = 1
    st.condition_flags.append({"condition": "y"})
    assert "x" not in p.genome
    assert len(p.condition_flags) == 1


def test_apply_to_writes_back_aggregates():
    p = _fake_plant()
    st = PlantState.from_plant(p)
    st.overall_health = 90.0
    st.height_cm = 60.0
    st.water_level = 70.0
    st.stage = "late_flower"
    st.apply_to(p)
    assert p.health == 90.0 and p.height == 60.0 and p.water_level == 70.0
    assert p.growth_stage == "late_flower"


def test_to_dict_roundtrips_fields():
    st = PlantState.from_plant(_fake_plant())
    d = st.to_dict()
    assert d["overall_health"] == 82.0 and d["stage"] == "flowering"
    assert d["flowers"] == {} and d["morphology"] == {}


def test_part_state_defaults():
    ps = PartState()
    assert ps.health == 100.0 and ps.data == {}
    ps.data["absorption"] = 0.8
    assert PartState().data == {}  # default isn't shared
