"""
Economy transparency — a read-only faucet/sink health view over the ledger.

This is the trust layer's "public faucet-vs-sink economy view" (see
docs/memory/design/04-honesty-and-trust.md and the moat's transparent-economy
wedge): anyone can audit whether the game is inflating, with no privileged
access. It moves no money and holds no state — it only aggregates the existing,
authoritative double-entry ledger, so it cannot affect gameplay truth.

Sign convention (economy.ledger.post): `amount` is positive for credits
(faucets) and negative for debits (sinks). Player<->player and escrow movements
are *transfers* that net to ~zero against the money supply and are reported
separately so they do not distort the inflation picture.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Dict

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..db.models import LedgerEntry, Wallet
from ..enums import LedgerEntryType as L

# Classification of each ledger entry type. Faucets create money from the
# system; sinks destroy it; transfers move money between players (net-zero to
# supply); chain entries settle game<->chain. Kept here, beside the enum it
# mirrors, as documented taxonomy (not balance tuning).
FAUCET_TYPES = frozenset({
    L.STARTING_GRANT, L.DAILY_STIPEND, L.HARVEST_SALE, L.REWARD,
    L.CUP_PRIZE_PAYOUT,
})
SINK_TYPES = frozenset({
    L.SEED_PURCHASE, L.NUTRIENT_PURCHASE, L.POD_PURCHASE, L.PEST_TREATMENT,
    L.DISEASE_TREATMENT, L.MARKET_FEE, L.BREEDING_FEE, L.RESEARCH_UNLOCK,
    L.SHOP_PURCHASE, L.CUP_ENTRY_FEE, L.TUITION,
})
TRANSFER_TYPES = frozenset({
    L.MARKET_SALE, L.MARKET_BUY, L.AUCTION_BID, L.AUCTION_REFUND,
})
CHAIN_TYPES = frozenset({L.ASA_WITHDRAWAL, L.ASA_DEPOSIT})
# ADJUSTMENT and anything unmapped fall through to "other".


def _classify(entry_type: str) -> str:
    if entry_type in {t.value for t in FAUCET_TYPES}:
        return "faucet"
    if entry_type in {t.value for t in SINK_TYPES}:
        return "sink"
    if entry_type in {t.value for t in TRANSFER_TYPES}:
        return "transfer"
    if entry_type in {t.value for t in CHAIN_TYPES}:
        return "chain"
    return "other"


def _f(value) -> float:
    return float(value if value is not None else Decimal("0"))


def economy_health(session: Session) -> dict:
    """Aggregate the ledger into a faucet/sink health report.

    Returns objective per-type sums (the ground truth) plus a faucet/sink/
    transfer rollup and an inflation indicator. Read-only.
    """
    rows = (
        session.query(
            LedgerEntry.entry_type,
            func.sum(LedgerEntry.amount),
            func.count(LedgerEntry.id),
        )
        .group_by(LedgerEntry.entry_type)
        .all()
    )

    by_type = []
    totals: Dict[str, Decimal] = {
        "faucet": Decimal("0"),
        "sink": Decimal("0"),
        "transfer": Decimal("0"),
        "chain": Decimal("0"),
        "other": Decimal("0"),
    }
    net_all = Decimal("0")
    for entry_type, total, count in rows:
        total = total or Decimal("0")
        net_all += total
        cls = _classify(entry_type)
        # Sinks/faucets are reported as magnitudes; the sign tells direction.
        totals[cls] += total
        by_type.append(
            {
                "entry_type": entry_type,
                "class": cls,
                "net": _f(total),
                "count": int(count),
            }
        )

    by_type.sort(key=lambda r: abs(r["net"]), reverse=True)

    faucet = totals["faucet"]            # net positive (money created)
    sink = -totals["sink"]               # sinks are negative; flip to magnitude
    net_issuance = faucet - sink         # > 0 means the supply is growing

    # Cross-check: current total money supply (sum of wallet balances) should
    # equal the net of every signed ledger amount.
    money_supply = session.query(
        func.coalesce(func.sum(Wallet.cached_balance), 0)
    ).scalar()
    money_supply = Decimal(str(money_supply))

    inflation_ratio = _f(faucet / sink) if sink > 0 else None

    return {
        "money_supply": _f(money_supply),
        "ledger_net": _f(net_all),
        "reconciled": abs(net_all - money_supply) < Decimal("0.01"),
        "faucet_total": _f(faucet),
        "sink_total": _f(sink),
        "transfer_volume": _f(abs(totals["transfer"])),
        "chain_net": _f(totals["chain"]),
        "net_issuance": _f(net_issuance),
        "inflation_ratio": inflation_ratio,
        "inflating": net_issuance > 0,
        "by_type": by_type,
    }
