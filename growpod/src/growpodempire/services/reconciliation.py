"""
Chain <-> DB reconciliation — catches drift between what the DB thinks
happened on-chain and what the chain provider actually confirms.

Per CLAUDE.md, the DB stays authoritative for gameplay; this job never mutates
gameplay truth. It only *reports* NFTAsset rows whose recorded on-chain state
disagrees with what `provider.asset_info()` currently returns, so an operator
can investigate. The classic case this catches (NFT_MARKETPLACE_SPEC.md
"Launch Checklist": "On-chain reconciliation job (verify txids daily)"): a
mint the DB recorded as `status="minted"` but that never actually confirmed
on-chain (process crashed between `create_asset_tx()` returning and the DB
commit, or the asset was later destroyed/clawed back on-chain).

No scheduler/cron is wired up yet — this module is the reusable, testable
logic; a future worker (or an admin endpoint) calls `reconcile_nft_assets`
on a timer. Read-only and side-effect-free: safe to run repeatedly, from
multiple processes, at any time.
"""

from dataclasses import dataclass, field
from typing import List, Optional, Sequence

from sqlalchemy.orm import Session

from ..chain.factory import shared_provider
from ..chain.provider import ChainError, ChainProvider
from ..db.models import NFTAsset

# Statuses that imply the DB believes the asset currently exists on-chain.
# "traded" assets have moved on but the ASA itself should still exist too, so
# it's included; only a genuinely defunct/withdrawn asset would be excluded,
# and no such status exists yet in the model.
_LIVE_STATUSES = ("minted", "listed", "staking", "traded")


@dataclass
class DriftRecord:
    """One disagreement between the DB and the chain for a single asset."""

    asset_id: int
    game_item_id: str
    kind: str  # "missing_on_chain" | "unexpected_total"
    db_value: Optional[str]
    chain_value: Optional[str]
    detail: str


@dataclass
class ReconciliationReport:
    checked: int
    drifted: List[DriftRecord] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.drifted


def reconcile_nft_assets(
    session: Session,
    provider: Optional[ChainProvider] = None,
    *,
    statuses: Sequence[str] = _LIVE_STATUSES,
) -> ReconciliationReport:
    """Compare every "live" NFTAsset row against the chain provider.

    For each NFTAsset whose `status` implies the DB believes it should exist
    on-chain, calls `provider.asset_info(asset_id)`. A `ChainError` (asset not
    found) means the DB and chain have drifted — flagged as
    `kind="missing_on_chain"`. A successful lookup with an unexpected supply
    (an ASA created as a 1-of-1 NFT should always report `total == 1`) is
    flagged as `kind="unexpected_total"`.

    This never writes to the DB or the chain — it's a pure read/compare, so
    it's safe to call from a cron job, an admin endpoint, or a test, and safe
    to run concurrently with normal traffic.
    """
    provider = provider or shared_provider()
    rows = (
        session.query(NFTAsset)
        .filter(NFTAsset.status.in_(list(statuses)))
        .order_by(NFTAsset.asset_id)
        .all()
    )

    drifted: List[DriftRecord] = []
    for row in rows:
        try:
            info = provider.asset_info(row.asset_id)
        except ChainError as exc:
            drifted.append(
                DriftRecord(
                    asset_id=row.asset_id,
                    game_item_id=row.game_item_id,
                    kind="missing_on_chain",
                    db_value=row.status,
                    chain_value=None,
                    detail=(
                        f"DB status={row.status!r} for asset {row.asset_id} "
                        f"(game_item_id={row.game_item_id!r}) but the chain "
                        f"lookup failed: {exc}"
                    ),
                )
            )
            continue

        if info.total != 1:
            drifted.append(
                DriftRecord(
                    asset_id=row.asset_id,
                    game_item_id=row.game_item_id,
                    kind="unexpected_total",
                    db_value="total=1 (NFT invariant: always a 1-of-1 ASA)",
                    chain_value=f"total={info.total}",
                    detail=(
                        f"Asset {row.asset_id} (game_item_id={row.game_item_id!r}) "
                        f"reports on-chain total={info.total}, expected 1"
                    ),
                )
            )

    return ReconciliationReport(checked=len(rows), drifted=drifted)
