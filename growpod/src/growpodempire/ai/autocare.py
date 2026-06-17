"""
Agentic "auto-care" — the Master Grower doesn't just advise, it acts.

Given a set of care tools (water / feed / treat-pests / treat-disease) bound to a
real plant, a provider drives a loop that fixes the plant's problems. Every tool
call executes through the normal SimulationService path (so it posts to the
ledger and logs events exactly like a manual action — server-authoritative, no
client-trusted state), and a SpendGuard caps both total GROW spent and the number
of actions per invocation.

Two providers, mirroring the read-only advisor:
  * MockAutoCareProvider — a deterministic rule loop (no network/key); used by
    tests and when no Anthropic key is configured.
  * ClaudeAutoCareProvider — uses the Anthropic SDK tool runner with @beta_tool
    wrappers so Claude decides the sequence itself.
"""

import json
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Optional, Protocol

logger = logging.getLogger("growpodempire.autocare")


class AutoCareError(Exception):
    """Any failure driving the auto-care loop."""


@dataclass
class AutoCareBudget:
    max_grow: float
    max_actions: int


@dataclass
class ActionRecord:
    action: str
    ok: bool
    cost: float = 0.0
    detail: str = ""


class CareTools(Protocol):
    """The bound, budget-guarded tools a provider may call."""

    def snapshot(self) -> dict: ...
    def water(self, amount: Optional[float] = None) -> ActionRecord: ...
    def feed(self) -> ActionRecord: ...
    def treat_pests(self) -> ActionRecord: ...
    def treat_disease(self) -> ActionRecord: ...
    def remaining_budget(self) -> float: ...
    def actions_remaining(self) -> int: ...


class AutoCareProvider(ABC):
    @abstractmethod
    def name(self) -> str: ...

    @abstractmethod
    def run(self, context: dict, tools: CareTools, budget: AutoCareBudget) -> str:
        """Drive the care loop. Actions are recorded on `tools`; return a short
        natural-language summary of what was done."""


class MockAutoCareProvider(AutoCareProvider):
    """Deterministic rule loop: repeatedly fix the most urgent issue until the
    plant is healthy or a cap is hit. No network, no key."""

    def name(self) -> str:
        return "mock"

    def run(self, context: dict, tools: CareTools, budget: AutoCareBudget) -> str:
        steps: List[str] = []
        while tools.actions_remaining() > 0:
            st = tools.snapshot()
            # Priority order: disease/pests first, then nutrients, then water.
            if st.get("pest_level", 0) > 0:
                rec = tools.treat_pests()
            elif st.get("disease_level", 0) > 0:
                rec = tools.treat_disease()
            elif st.get("nutrient_level", 100) < 35:
                rec = tools.feed()
            elif st.get("water_level", 100) < 40:
                rec = tools.water()
            else:
                break  # nothing left to do
            if not rec.ok:
                steps.append(f"stopped: {rec.detail}")
                break
            steps.append(f"{rec.action} (cost {rec.cost:g})")
        if not steps:
            return "Plant is already in good shape — no action needed."
        return "Auto-care performed: " + "; ".join(steps) + "."


class ClaudeAutoCareProvider(AutoCareProvider):
    """Lets Claude decide the care sequence via the SDK tool runner."""

    def __init__(self, api_key: str, model: str = "claude-opus-4-8"):
        if not api_key:
            raise AutoCareError("ANTHROPIC_API_KEY is required for Claude auto-care")
        try:
            import anthropic  # noqa: F401  (lazy import; mock path needs nothing)
        except ImportError as exc:  # pragma: no cover
            raise AutoCareError("the 'anthropic' package is not installed") from exc
        self._api_key = api_key
        self._model = model

    def name(self) -> str:
        return f"claude:{self._model}"

    def run(self, context: dict, tools: CareTools, budget: AutoCareBudget) -> str:
        import anthropic
        from anthropic import beta_tool

        # Tool wrappers close over `tools`; the runner calls them automatically.
        @beta_tool
        def water(amount: Optional[float] = None) -> str:
            """Water the plant. Use when water_level is low. amount is optional."""
            return _fmt(tools.water(amount))

        @beta_tool
        def feed() -> str:
            """Feed nutrients to the plant. Use when nutrient_level is low. Costs GROW."""
            return _fmt(tools.feed())

        @beta_tool
        def treat_pests() -> str:
            """Treat a pest infestation (pest_level > 0). Costs GROW."""
            return _fmt(tools.treat_pests())

        @beta_tool
        def treat_disease() -> str:
            """Treat disease/mildew (disease_level > 0). Costs GROW."""
            return _fmt(tools.treat_disease())

        system = (
            "You are the Master Grower running in auto-care mode. You are given a "
            "plant's live state and a set of care tools. Fix the plant's problems "
            f"using as few actions as possible, staying within a budget of "
            f"{budget.max_grow:g} GROW and {budget.max_actions} actions. Treat "
            "pests and disease first, then correct nutrients and water. If a tool "
            "reports the budget or action cap is reached, stop. When the plant is "
            "healthy, stop and briefly summarize what you did. Never fabricate "
            "results — rely only on what the tools return."
        )
        client = anthropic.Anthropic(api_key=self._api_key)
        try:
            runner = client.beta.messages.tool_runner(
                model=self._model,
                max_tokens=8000,
                thinking={"type": "adaptive"},
                system=system,
                tools=[water, feed, treat_pests, treat_disease],
                messages=[{"role": "user", "content": json.dumps(context, default=str)}],
            )
            final_text = ""
            for message in runner:
                for block in message.content:
                    if getattr(block, "type", None) == "text":
                        final_text = block.text
        except Exception as exc:
            req_id = getattr(exc, "request_id", None)
            logger.warning("auto-care failed (request_id=%s): %s", req_id, exc)
            raise AutoCareError(f"auto-care backend error: {exc}") from exc
        return final_text or "Auto-care complete."


def _fmt(rec: ActionRecord) -> str:
    if not rec.ok:
        return f"NOT DONE — {rec.detail}"
    return f"{rec.action} done (cost {rec.cost:g} GROW). {rec.detail}"
