"""
Small, reusable request-input validators for the game API.

These turn malformed or out-of-range client input into a clean 400 (raised as
`GameError`, which the blueprint already maps to a 400 JSON body) instead of an
unhandled coercion error surfacing as a generic 500. They also enforce sane
bounds so zero/negative/absurd values never reach the economy or simulation.
"""

from decimal import Decimal, InvalidOperation

from ..services.game_service import GameError

# Generous upper bounds — large enough never to constrain real play, small
# enough to stop overflow/abuse (e.g. minting via a huge quantity or amount).
MAX_QUANTITY = 1_000_000
MAX_MONEY = Decimal("1000000000")  # 1e9 GROW


def positive_int(value, field: str, *, default=None, maximum: int = MAX_QUANTITY) -> int:
    """Coerce `value` to an int in [1, maximum]; raise GameError otherwise."""
    if value is None:
        if default is not None:
            return default
        raise GameError(f"{field} is required")
    try:
        n = int(value)
    except (TypeError, ValueError):
        raise GameError(f"{field} must be an integer")
    if n < 1:
        raise GameError(f"{field} must be >= 1")
    if n > maximum:
        raise GameError(f"{field} must be <= {maximum}")
    return n


def bounded_int(value, field: str, *, default: int, low: int, high: int) -> int:
    """Coerce an optional int to [low, high], falling back to `default`."""
    if value is None or value == "":
        return default
    try:
        n = int(value)
    except (TypeError, ValueError):
        raise GameError(f"{field} must be an integer")
    return max(low, min(high, n))


def number(value, field: str, *, low: float, high: float) -> float:
    """Coerce `value` to a finite float in [low, high]; raise GameError otherwise.

    Used for sensor/environment inputs that flow into the simulation engine — a
    non-numeric value would otherwise TypeError deep in a later read and surface
    as a generic 500.
    """
    try:
        n = float(value)
    except (TypeError, ValueError):
        raise GameError(f"{field} must be a number")
    # NaN/inf fail this range test (all comparisons with NaN are False).
    if not (low <= n <= high):
        raise GameError(f"{field} must be between {low} and {high}")
    return n


def positive_money(value, field: str, *, maximum: Decimal = MAX_MONEY) -> Decimal:
    """Coerce `value` to a positive Decimal amount in (0, maximum]."""
    if value is None:
        raise GameError(f"{field} is required")
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise GameError(f"{field} must be a number")
    if not amount.is_finite():
        raise GameError(f"{field} must be a finite number")
    if amount <= 0:
        raise GameError(f"{field} must be positive")
    if amount > maximum:
        raise GameError(f"{field} must be <= {maximum}")
    return amount
