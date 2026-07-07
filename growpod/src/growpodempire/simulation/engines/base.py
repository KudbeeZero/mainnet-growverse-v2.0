"""Common interface for the plant micro-engines.

Every engine is a small, pure transformer: given the shared per-hour
:class:`EngineContext`, it mutates plant state and returns any events it wants
logged. Engines must stay deterministic (drive all randomness from
``ctx.rng``), free of DB/economy/research side effects (those live in
``services/``), and cheap (``catch_up`` may call them thousands of times).
"""

from __future__ import annotations

import random
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, ClassVar, Dict, List, Optional

from ..gear import GearEffects


@dataclass
class EngineContext:
    """Everything an engine needs for one simulated hour.

    ``plant`` is the persisted ORM row (still the source of truth); ``env`` is the
    resolved pod environment; ``sim`` is the ``simulation`` block of balance.yaml;
    ``rng`` is the per-plant-hour seeded RNG (so the hour is reproducible); ``t``
    is the timestamp of this step; ``auto`` carries pod automation flags;
    ``effects`` carries the pod's merged equipped-gear effects (neutral/no-op
    default, so omitting it reproduces the pre-gear-effects engine exactly).
    """

    plant: Any
    env: Dict
    sim: Dict
    rng: random.Random
    t: datetime
    auto: Optional[Dict] = None
    effects: GearEffects = field(default_factory=GearEffects)


class BasePlantEngine(ABC):
    """A single stage of the per-hour simulation pipeline."""

    #: Stable identifier (used for ordering, telemetry, and config lookup).
    name: ClassVar[str] = "base"
    #: Names of engines that must run before this one (for the orchestrator).
    depends_on: ClassVar[List[str]] = []

    @abstractmethod
    def update(self, ctx: EngineContext) -> List[dict]:
        """Advance the plant by one hour; return event dicts to be recorded."""
        raise NotImplementedError
