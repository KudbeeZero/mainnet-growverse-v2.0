"""
Factions loader (faction + launch waitlist).

A cached reader over ``data/factions.yaml`` — the data-driven display catalog of
the three pre-launch factions (Indica / Sativa / Hybrid). Mirrors the
``skills.py`` loader exactly (module-level cache + ``yaml.safe_load`` from a path
under ``data/``).

Exposes:
  * ``load_factions()`` -> the full parsed display data ({"factions": [...]}).
  * ``faction_ids()``   -> the set of valid faction ids.
  * ``reset_cache()``   -> drop the cache (tests pointing FACTIONS_FILE elsewhere).

NON-ECONOMIC: pure data; imports nothing from ``economy``/``ledger``/wallet.
"""

from __future__ import annotations

import yaml

from ..config import get_settings

_FACTIONS_CACHE = None


def load_factions() -> dict:
    """Load (and cache) the faction display catalog from ``data/factions.yaml``."""
    global _FACTIONS_CACHE
    if _FACTIONS_CACHE is None:
        with open(get_settings().factions_file, "r", encoding="utf-8") as fh:
            _FACTIONS_CACHE = yaml.safe_load(fh) or {}
    return _FACTIONS_CACHE


def reset_cache() -> None:
    """Drop the cached catalog (tests that point ``FACTIONS_FILE`` elsewhere)."""
    global _FACTIONS_CACHE
    _FACTIONS_CACHE = None


def faction_ids() -> set[str]:
    """The set of every valid faction id defined in the catalog."""
    return {
        str(f["id"])
        for f in (load_factions().get("factions") or [])
        if f.get("id")
    }
