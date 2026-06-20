"""A single plant part's working state (root, leaf, flower cluster, …).

Deliberately generic: a normalised ``health`` plus a free-form ``data`` bag so
each engine can stash its own structured detail (e.g. a root-hair engine keeps
``{"absorption_efficiency": ...}``) without a schema change per engine.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict


@dataclass
class PartState:
    #: 0..100 health of this part; aggregated into the plant's overall health.
    health: float = 100.0
    #: Engine-specific structured detail for this part.
    data: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {"health": self.health, "data": dict(self.data)}
