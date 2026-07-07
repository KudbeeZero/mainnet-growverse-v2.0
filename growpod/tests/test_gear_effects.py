"""Pure unit tests for simulation/gear.py (ROADMAP_90D week 2-3).

No DB, no session — `effects_for` is a pure function of plain dicts, so these
run fast and pin the merge/clamp math directly.
"""

from growpodempire.simulation.gear import GearEffects, effects_for

CATALOG = {
    "clip_fan": {"effects": {"pest_spawn_mult": 0.85, "disease_growth_mult": 0.90}},
    "inline_exhaust_6in": {
        "effects": {
            "pest_spawn_mult": 0.75,
            "disease_growth_mult": 0.60,
            "humidity_offset_pct": -8,
            "temp_offset_c": -2,
        }
    },
    "coco_coir": {"effects": {"water_decay_mult": 0.85, "nutrient_decay_mult": 1.15}},
    "bat_guano": {"effects": {"nutrient_decay_mult": 0.90, "flowering_quality_bonus": 2}},
    "led_125w": {"effects": {}},  # lights carry no effects block
    "unknown_key_not_in_catalog": None,
    "oscillating_fan": {
        "effects": {
            "pest_spawn_mult": 0.70,
            "disease_growth_mult": 0.80,
            "humidity_offset_pct": -2,
        }
    },
}


def test_no_gear_equipped_is_neutral():
    """Empty equipped list -> the neutral GearEffects — the parity invariant."""
    assert effects_for([], CATALOG) == GearEffects()
    assert effects_for(None, CATALOG) == GearEffects()


def test_light_with_no_effects_block_is_neutral():
    assert effects_for([{"gear_key": "led_125w"}], CATALOG) == GearEffects()


def test_single_fan_merges_its_block():
    fx = effects_for([{"gear_key": "clip_fan"}], CATALOG)
    assert fx.pest_spawn_mult == 0.85
    assert fx.disease_growth_mult == 0.90
    assert fx.temp_offset_c == 0.0
    assert fx.humidity_offset_pct == 0.0


def test_offsets_sum_across_equipped_items():
    # Two items each contributing an offset sum together (below the clamp
    # bound, so nothing clips here — clamping is covered separately below).
    fx = effects_for([{"gear_key": "oscillating_fan"}] * 2, CATALOG)
    assert fx.humidity_offset_pct == -4.0


def test_offsets_clamp_to_sane_bounds():
    # 3x -8 = -24, clamped to -10.
    fx = effects_for([{"gear_key": "inline_exhaust_6in"}] * 3, CATALOG)
    assert fx.humidity_offset_pct == -10.0


def test_mults_compound_and_clamp():
    # 0.75 * 0.75 * 0.75 ~= 0.42, clamped up to the 0.5 floor.
    fx = effects_for([{"gear_key": "inline_exhaust_6in"}] * 3, CATALOG)
    assert fx.pest_spawn_mult == 0.5


def test_soil_water_nutrient_tradeoff():
    """Coco coir: better water retention (lower decay) at the cost of faster
    nutrient drain (higher decay) — a real tradeoff, not a strict upgrade."""
    fx = effects_for([{"gear_key": "coco_coir"}], CATALOG)
    assert fx.water_decay_mult < 1.0
    assert fx.nutrient_decay_mult > 1.0


def test_flowering_quality_bonus_sums_unclamped():
    fx = effects_for([{"gear_key": "bat_guano"}, {"gear_key": "bat_guano"}], CATALOG)
    assert fx.flowering_quality_bonus == 4.0


def test_unknown_gear_key_contributes_nothing():
    fx = effects_for([{"gear_key": "not_in_catalog"}], CATALOG)
    assert fx == GearEffects()


def test_merge_order_independent():
    """Determinism: the merge is commutative — equipping in either order
    yields the identical result (a property the engine's per-hour math relies
    on being stable regardless of query row order)."""
    a = effects_for([{"gear_key": "clip_fan"}, {"gear_key": "coco_coir"}], CATALOG)
    b = effects_for([{"gear_key": "coco_coir"}, {"gear_key": "clip_fan"}], CATALOG)
    assert a == b


def test_repeated_calls_are_identical():
    equipped = [{"gear_key": "clip_fan"}, {"gear_key": "bat_guano"}]
    assert effects_for(equipped, CATALOG) == effects_for(equipped, CATALOG)
