"""The original monolithic step, wrapped as a single pipeline engine.

This exists so the refactor to an engine pipeline is **behavior-preserving**: the
orchestrator runs ``[LegacyStepEngine()]`` and gets byte-for-byte the same result
as calling the old ``_step`` directly (guarded by ``tests/test_engine_parity.py``).
Real micro-engines replace slices of this in later PRs; whatever they don't yet
own keeps running here, so parity holds throughout the migration.
"""

from __future__ import annotations

from typing import List

from .base import BasePlantEngine, EngineContext

# engine.py is fully initialised before the pipeline is first built (it imports
# this module lazily), so importing `_step` at module load is cycle-free.
from ..engine import _step


class LegacyStepEngine(BasePlantEngine):
    name = "legacy_step"

    def update(self, ctx: EngineContext) -> List[dict]:
        return _step(ctx.plant, ctx.env, ctx.sim, ctx.rng, ctx.t, ctx.auto, ctx.effects)
