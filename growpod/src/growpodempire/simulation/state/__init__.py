"""Rich, in-memory plant state shared across the micro-engines.

The DB ``Plant`` row stays the persisted source of truth; this package is the
deeper working model the engines read/write during a catch-up tick (per-part
roots/stem/leaves/flowers detail), then aggregate back to the ORM. Introduced
as defined-but-unwired scaffolding; the orchestrator starts populating it in a
follow-up PR.
"""

from .part_state import PartState
from .plant_state import PlantState

__all__ = ["PlantState", "PartState"]
