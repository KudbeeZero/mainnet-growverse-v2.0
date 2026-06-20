"""Composable plant micro-engines.

The monolithic per-hour `_step` is being decomposed into small, focused, pure
engines (roots → transport → leaves → metabolism → flowers/trichomes → stress →
morphology → quality), each implementing :class:`BasePlantEngine`. The
orchestrator in ``simulation/engine.py`` runs them in dependency order over a
shared context every simulated hour. Introduced parity-first: the first stage
(:class:`LegacyStepEngine`) wraps the original `_step` verbatim, so the pipeline
reproduces today's behavior byte-for-byte while real engines replace slices of it
incrementally.
"""

from .base import BasePlantEngine, EngineContext

__all__ = ["BasePlantEngine", "EngineContext"]
