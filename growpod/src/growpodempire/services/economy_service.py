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

from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, List

from sqlalchemy import func, case
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


# ---------------------------------------------------------------------------
# Admin: trailing-N-day daily ledger aggregates (for the Economy dashboard)
# ---------------------------------------------------------------------------

_FAUCET_TYPE_VALUES = frozenset(t.value for t in FAUCET_TYPES)
_SINK_TYPE_VALUES = frozenset(t.value for t in SINK_TYPES)


def ledger_daily_summary(session: Session, days: int = 30) -> dict:
    """Return per-day GC minted/burned for the trailing `days` calendar days.

    Each entry in `daily` covers one UTC date and reports:
      - minted:       total GC created by FAUCET-type entries only
      - burned:       total GC destroyed by SINK-type entries (magnitude)
      - seasonal_sink: subset of burned — SEED_PURCHASE with ref_type='seasonal_strain'

    Transfer/chain/adjustment entries are excluded so the chart tracks true
    money-supply changes, matching the taxonomy in economy_service.FAUCET_TYPES
    and SINK_TYPES.

    Also returns aggregate projector-seeding numbers so the admin dashboard
    can pre-populate its sliders with real values instead of placeholders.
    """
    # Align cutoff to UTC midnight N days ago so every day in the window
    # is a complete calendar day (no partial first-day data).
    today = datetime.utcnow().date()
    start_date = today - timedelta(days=days - 1)
    cutoff = datetime(start_date.year, start_date.month, start_date.day)

    faucet_list = list(_FAUCET_TYPE_VALUES)
    sink_list = list(_SINK_TYPE_VALUES)

    rows = (
        session.query(
            func.date(LedgerEntry.created_at).label("day"),
            func.sum(
                case(
                    (LedgerEntry.entry_type.in_(faucet_list), LedgerEntry.amount),
                    else_=0,
                )
            ).label("minted"),
            func.sum(
                case(
                    (LedgerEntry.entry_type.in_(sink_list), LedgerEntry.amount),
                    else_=0,
                )
            ).label("burned_raw"),
            func.sum(
                case(
                    (
                        (LedgerEntry.entry_type == L.SEED_PURCHASE.value)
                        & (LedgerEntry.ref_type == "seasonal_strain"),
                        LedgerEntry.amount,
                    ),
                    else_=0,
                )
            ).label("seasonal_raw"),
        )
        .filter(LedgerEntry.created_at >= cutoff)
        .group_by(func.date(LedgerEntry.created_at))
        .order_by(func.date(LedgerEntry.created_at))
        .all()
    )

    # Build a dense day-indexed list so the chart has every date in the window
    # even when there are no ledger entries for that day.
    day_map: Dict[str, dict] = {}
    for row in rows:
        day_str = str(row.day)
        day_map[day_str] = {
            "date": day_str,
            "minted": _f(row.minted or Decimal("0")),
            "burned": _f(abs(row.burned_raw or Decimal("0"))),
            "seasonal_sink": _f(abs(row.seasonal_raw or Decimal("0"))),
        }

    # Fill gaps: every calendar day in [start_date, today] must appear.
    dense: List[dict] = []
    d = start_date
    cumulative = 0.0
    while d <= today:
        key = d.isoformat()
        entry = day_map.get(key, {"date": key, "minted": 0.0, "burned": 0.0, "seasonal_sink": 0.0})
        cumulative += entry["minted"] - entry["burned"]
        entry["supply_delta"] = round(cumulative, 6)
        dense.append(entry)
        d += timedelta(days=1)

    # --- Projector-seeding aggregates (real numbers for slider pre-population) ---
    active_players = session.query(func.count(func.distinct(LedgerEntry.player_id))).scalar() or 0

    # Harvest GC: HARVEST_SALE faucet entries in the window
    harvest_gc = session.query(
        func.coalesce(func.sum(LedgerEntry.amount), 0)
    ).filter(
        LedgerEntry.entry_type == L.HARVEST_SALE.value,
        LedgerEntry.created_at >= cutoff,
    ).scalar()
    harvest_gc = _f(harvest_gc)

    # Daily stipend: DAILY_STIPEND entries in the window
    stipend_gc = session.query(
        func.coalesce(func.sum(LedgerEntry.amount), 0)
    ).filter(
        LedgerEntry.entry_type == L.DAILY_STIPEND.value,
        LedgerEntry.created_at >= cutoff,
    ).scalar()
    stipend_gc = _f(stipend_gc)

    # Non-seasonal seed purchases in the window (excludes seasonal drops so the
    # projector's "avg seed cost per grow" reflects regular marketplace prices).
    seed_gc = session.query(
        func.coalesce(func.sum(LedgerEntry.amount), 0)
    ).filter(
        LedgerEntry.entry_type == L.SEED_PURCHASE.value,
        LedgerEntry.created_at >= cutoff,
        (LedgerEntry.ref_type != "seasonal_strain") | (LedgerEntry.ref_type.is_(None)),
    ).scalar()
    seed_gc = abs(_f(seed_gc))

    # Tuition in the window
    tuition_gc = session.query(
        func.coalesce(func.sum(LedgerEntry.amount), 0)
    ).filter(
        LedgerEntry.entry_type == L.TUITION.value,
        LedgerEntry.created_at >= cutoff,
    ).scalar()
    tuition_gc = abs(_f(tuition_gc))

    # Seasonal sink total in the window
    seasonal_gc = session.query(
        func.coalesce(func.sum(LedgerEntry.amount), 0)
    ).filter(
        LedgerEntry.entry_type == L.SEED_PURCHASE.value,
        LedgerEntry.ref_type == "seasonal_strain",
        LedgerEntry.created_at >= cutoff,
    ).scalar()
    seasonal_gc = abs(_f(seasonal_gc))

    # Money supply (current total)
    money_supply = session.query(
        func.coalesce(func.sum(Wallet.cached_balance), 0)
    ).scalar()
    money_supply = _f(money_supply)

    return {
        "days": days,
        "daily": dense,
        "totals": {
            "minted": sum(e["minted"] for e in dense),
            "burned": sum(e["burned"] for e in dense),
            "seasonal_sink": sum(e["seasonal_sink"] for e in dense),
        },
        "money_supply": money_supply,
        "active_players": int(active_players),
        "period_gc": {
            "harvest": harvest_gc,
            "stipend": stipend_gc,
            "seed_purchases": seed_gc,
            "tuition": tuition_gc,
            "seasonal": seasonal_gc,
        },
    }
