"""
Feature flags — a data-driven launch gate / kill-switch surface.

Flag definitions live in ``balance.yaml`` under ``feature_flags:`` (the canonical
tuning surface — data-driven over code, same convention as the economy knobs).
Each flag is a boolean default that can be overridden **per-environment without a
deploy** via an env var ``FEATURE_<UPPER_SNAKE_NAME>`` (e.g.
``FEATURE_FTUE_TUTORIAL=false``), so prod/staging can toggle player-facing
surfaces independently.

Design notes:
- **Config-authoritative for *exposure* only.** The DB remains authoritative for
  gameplay truth; flags decide whether a surface is *shown/served*, never what a
  computed value is.
- **Fail-closed.** An unknown flag resolves to ``False``.
- **No per-player targeting yet** — deferred until a real cohort need exists
  (would be an additive ``feature_flags`` table + read path, not a rewrite).
"""

from __future__ import annotations

import os
from functools import wraps
from typing import Callable, Dict, Optional

from .economy.config import get_economy_config

_TRUE = {"1", "true", "yes", "on"}
_FALSE = {"0", "false", "no", "off"}


class FeatureDisabledError(Exception):
    """Raised by the guard layer when a gated feature is turned off."""

    def __init__(self, flag: str) -> None:
        self.flag = flag
        super().__init__(f"Feature '{flag}' is not available")


def _env_override(name: str) -> Optional[bool]:
    """Resolve a FEATURE_<NAME> env override to a bool, or None if unset/blank."""
    raw = os.environ.get(f"FEATURE_{name.upper()}")
    if raw is None:
        return None
    token = raw.strip().lower()
    if token in _TRUE:
        return True
    if token in _FALSE:
        return False
    return None  # unrecognised value — ignore rather than guess


def _defaults() -> Dict[str, bool]:
    """The declared flags and their yaml defaults (uncoerced keys → bool)."""
    raw = get_economy_config().raw.get("feature_flags") or {}
    return {str(k): bool(v) for k, v in raw.items()}


def is_enabled(name: str) -> bool:
    """True if ``name`` is on. Env override wins; unknown flags fail closed."""
    override = _env_override(name)
    if override is not None:
        return override
    return _defaults().get(name, False)


def all_flags() -> Dict[str, bool]:
    """Resolved map of every declared flag → effective state (overrides applied)."""
    flags = _defaults()
    for name in flags:
        override = _env_override(name)
        if override is not None:
            flags[name] = override
    return flags


def require_feature(name: str) -> None:
    """Guard: raise :class:`FeatureDisabledError` unless ``name`` is enabled."""
    if not is_enabled(name):
        raise FeatureDisabledError(name)


def feature_required(name: str) -> Callable:
    """Decorator form of :func:`require_feature` for gating a Flask view."""

    def decorator(view: Callable) -> Callable:
        @wraps(view)
        def wrapper(*args, **kwargs):
            require_feature(name)
            return view(*args, **kwargs)

        return wrapper

    return decorator
