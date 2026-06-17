"""FTUE coach — the AI Master Grower's deterministic, scripted onboarding voice.

The live ClaudeAdvisorProvider is great for diagnosing a *real* plant, but the
first-time tutorial needs fixed, friendly, step-specific guidance that reads the
same every time and never depends on a live API key (so it works in CI and for
brand-new players with no plant yet). These are static `AdvisorReport`s keyed by
tutorial step, surfaced through the same schema the real advisor uses."""

from .provider import AdvisorProvider, AdvisorReport, CareSuggestion


def _report(summary, diagnosis, *, severity="healthy", suggestions=()):
    return AdvisorReport(
        summary=summary,
        severity=severity,
        diagnosis=diagnosis,
        suggestions=list(suggestions),
    )


# Keyed by FTUEService step. Steps with a real care action carry a matching
# CareSuggestion (so the UI can wire the button); narrative steps carry none.
_COACHING = {
    "welcome": _report(
        "Welcome to GrowPod Empire 🌱 I'm your Master Grower — let's raise your first plant.",
        "You've been handed a Starter Pod and a starter seed, free. Everything you "
        "need for your first grow is ready. We'll go step by step.",
    ),
    "plant": _report(
        "Let's get that seed in the soil.",
        "Drop your starter seed into the Starter Pod. Once it's planted, the grow "
        "begins and we can start caring for it.",
    ),
    "water": _report(
        "Give your seedling a drink 💧",
        "Young plants need steady moisture. Water it now to keep it healthy.",
        suggestions=[CareSuggestion(action="water", urgency="now", reason="A fresh seedling needs water to establish.")],
    ),
    "environment": _report(
        "Dial in the climate 🌡️",
        "Cannabis thrives around 24°C and ~50% humidity with good light. Set the pod "
        "environment into the healthy band so your plant grows strong.",
        suggestions=[CareSuggestion(action="adjust_environment", urgency="now", reason="A dialed-in climate maximizes healthy growth.")],
    ),
    "grow": _report(
        "Now watch it flower 🌸",
        "With good care your plant powers through vegetative growth into flower — the "
        "buds swell and frost builds. We'll fast-forward your first cycle so you can "
        "see the payoff.",
    ),
    "harvest": _report(
        "Harvest time ✂️",
        "Your cola is ripe and frosted. Harvest & sell it to the NPC market for your "
        "first payout — this is the loop you'll repeat with every strain.",
        suggestions=[CareSuggestion(action="harvest", urgency="now", reason="The plant is ripe; harvest now to lock in quality.")],
    ),
    "completed": _report(
        "You did it! 🏆 Your first harvest is sold.",
        "You grew, harvested, and sold your first crop — that's the whole core loop. "
        "Come back tomorrow to claim your daily stipend and start your next grow. "
        "Explore the Lab to pick a new strain whenever you're ready.",
    ),
}

_FALLBACK = _report(
    "Keep going — you're doing great.",
    "Follow the highlighted step to continue your first grow.",
)


def coach_for_step(step: str) -> AdvisorReport:
    """The Master Grower's scripted line for a tutorial step (deterministic)."""
    return _COACHING.get(step, _FALLBACK)


class FTUECoachProvider(AdvisorProvider):
    """AdvisorProvider that speaks the scripted tutorial line for a given step,
    so FTUE coaching flows through the same plumbing as the real advisor."""

    def __init__(self, step: str):
        self.step = step

    def name(self) -> str:
        return "ftue_coach"

    def diagnose(self, context: dict) -> AdvisorReport:  # context unused (scripted)
        return coach_for_step(self.step)
