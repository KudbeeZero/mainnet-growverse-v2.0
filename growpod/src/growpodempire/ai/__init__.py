"""AI advisor layer — a swappable "Master Grower" that reads a plant's live
state and returns natural-language diagnosis + recommended care actions.

Mirrors the `chain/` package: an abstract provider, an offline deterministic
mock (used by tests and when no API key is configured), a real Claude-backed
implementation, and a factory that picks between them. Gameplay stays
DB-authoritative — the advisor only reads state and advises; it never computes
yield, quality, or currency.
"""

from .provider import AdvisorProvider, AdvisorReport, CareSuggestion, AdvisorError
from .autocare import (
    AutoCareProvider,
    AutoCareBudget,
    ActionRecord,
    AutoCareError,
)
from .factory import (
    get_advisor_provider,
    shared_advisor,
    reset_shared_advisor,
    get_auto_care_provider,
)

__all__ = [
    "AdvisorProvider",
    "AdvisorReport",
    "CareSuggestion",
    "AdvisorError",
    "AutoCareProvider",
    "AutoCareBudget",
    "ActionRecord",
    "AutoCareError",
    "get_advisor_provider",
    "shared_advisor",
    "reset_shared_advisor",
    "get_auto_care_provider",
]
