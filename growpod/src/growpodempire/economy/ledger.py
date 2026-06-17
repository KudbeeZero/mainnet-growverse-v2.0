"""
The currency ledger — the single source of truth for player balances.

Every currency movement is an append-only `LedgerEntry` row written inside the
caller's transaction, alongside an update to the wallet's denormalized
`cached_balance`. Balances can never silently drift, and the full history is
auditable (and later reconcilable against the on-chain ASA).
"""

from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, Union

from sqlalchemy.orm import Session

from ..enums import LedgerEntryType
from ..db.models import LedgerEntry, Wallet

# Currency precision (matches the planned ASA decimals).
QUANT = Decimal("0.000001")


class InsufficientFundsError(Exception):
    """Raised when a debit would drive a wallet balance negative."""


def to_money(value: Union[int, float, str, Decimal]) -> Decimal:
    """Coerce a value to a quantized Decimal in the currency's precision."""
    return Decimal(str(value)).quantize(QUANT, rounding=ROUND_HALF_UP)


def get_wallet(session: Session, player_id: str) -> Wallet:
    wallet = (
        session.query(Wallet).filter(Wallet.player_id == player_id).one_or_none()
    )
    if wallet is None:
        raise ValueError(f"No wallet for player {player_id}")
    return wallet


def post(
    session: Session,
    player_id: str,
    amount: Union[int, float, str, Decimal],
    entry_type: Union[LedgerEntryType, str],
    *,
    ref_type: Optional[str] = None,
    ref_id: Optional[str] = None,
    allow_negative: bool = False,
) -> LedgerEntry:
    """Post a signed currency movement and update the wallet balance.

    `amount` is positive for credits (faucets) and negative for debits (sinks).
    Raises InsufficientFundsError if a debit would overdraw, unless
    `allow_negative` is set (reserved for administrative adjustments).
    """
    amount = to_money(amount)
    entry_type = (
        entry_type.value if isinstance(entry_type, LedgerEntryType) else entry_type
    )

    wallet = get_wallet(session, player_id)
    new_balance = to_money(wallet.cached_balance + amount)

    if new_balance < 0 and not allow_negative:
        raise InsufficientFundsError(
            f"Player {player_id} balance {wallet.cached_balance} cannot cover "
            f"{amount} ({entry_type})"
        )

    # `version` is managed by SQLAlchemy's optimistic locking (Wallet's
    # version_id_col) — do NOT bump it here, or the stamp/flush would conflict.
    wallet.cached_balance = new_balance

    entry = LedgerEntry(
        player_id=player_id,
        entry_type=entry_type,
        amount=amount,
        balance_after=new_balance,
        ref_type=ref_type,
        ref_id=ref_id,
    )
    session.add(entry)
    return entry


def balance(session: Session, player_id: str) -> Decimal:
    """Return the player's current cached balance."""
    return get_wallet(session, player_id).cached_balance


def recompute_balance(session: Session, player_id: str) -> Decimal:
    """Recompute balance by summing the ledger (audit / reconciliation helper)."""
    # Make any pending (un-flushed) entries visible to the query.
    session.flush()
    total = Decimal("0")
    entries = (
        session.query(LedgerEntry)
        .filter(LedgerEntry.player_id == player_id)
        .order_by(LedgerEntry.created_at)
        .all()
    )
    for e in entries:
        total = to_money(total + e.amount)
    return total
