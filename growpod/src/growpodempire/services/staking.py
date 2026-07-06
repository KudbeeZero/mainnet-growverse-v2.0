"""Staking service — the "curing room": lock a minted NFT for a duration to
earn a bonus GC reward on claim.

This is a SEPARATE mechanic from `Harvest.cure_status` (the pre-sale quality
cure in `GameService.start_cure`/`finish_cure`, which improves a harvest's
`quality` before it's sold or minted). Staking happens AFTER an NFTAsset
already exists: it locks that already-minted asset for `cure_target_hours`
and pays a bonus once the lock completes.
"""

from datetime import datetime, timedelta
from decimal import Decimal
from typing import List, Optional

from sqlalchemy.orm import Session

from ..db.models import Harvest, NFTAsset, Player, StakingLock
from ..economy.config import EconomyConfig, get_economy_config
from ..economy.ledger import post
from ..enums import LedgerEntryType, NFTAssetStatus, StakingLockStatus


class StakingError(Exception):
    """Staking operation failed."""


class StakingService:
    def __init__(self, session: Session, config: Optional[EconomyConfig] = None):
        self.session = session
        self.cfg = config or get_economy_config()

    @property
    def _default_cure_hours(self) -> float:
        return float(self.cfg.raw.get("staking", {}).get("default_cure_hours", 168.0))

    @property
    def _reward_pct(self) -> Decimal:
        return Decimal(str(self.cfg.raw.get("staking", {}).get("reward_pct", 0.10)))

    def create_lock(
        self,
        nft_asset_id: int,
        player_id: str,
        harvest_id: str,
        cure_target_hours: Optional[float] = None,
    ) -> StakingLock:
        """Lock an NFT for curing. Awards bonus rewards post-lock.

        Args:
            nft_asset_id: The ASA ID to lock
            player_id: The player staking their NFT
            harvest_id: Reference to the original harvest
            cure_target_hours: How long to cure (hours); defaults to the
                `staking.default_cure_hours` balance.yaml knob

        Returns:
            StakingLock record

        Raises:
            StakingError: If NFT not found, already locked/listed, already
                completed one staking cure, not currently owned by player
                (checked against the player's linked wallet, not who
                originally harvested it), or cure_target_hours is non-positive
        """
        nft = self.session.query(NFTAsset).filter_by(asset_id=nft_asset_id).first()
        if not nft:
            raise StakingError(f"NFT asset {nft_asset_id} not found")

        if nft.status == NFTAssetStatus.STAKING.value:
            raise StakingError(f"Asset {nft_asset_id} is already staked")

        if nft.status == NFTAssetStatus.LISTED.value:
            raise StakingError(f"Asset {nft_asset_id} is listed and cannot be staked")

        # Disruptor-sweep finding #2: staking is a one-shot bonus per asset, not
        # a repeatable faucet. claim_rewards() sets this on withdrawal.
        if nft.staked_once:
            raise StakingError(
                f"Asset {nft_asset_id} has already completed a staking cure and can't be staked again"
            )

        # Disruptor-sweep finding #7: authorize on CURRENT ownership of the NFT
        # (the caller's linked wallet must match the asset's owner_address),
        # not the harvest's original player_id -- the harvest's player stays
        # fixed forever, but the NFT itself can change hands on the
        # marketplace, and staking must follow the asset, not the harvester.
        player = self.session.query(Player).filter_by(id=player_id).first()
        if not player or not player.algorand_address or player.algorand_address != nft.owner_address:
            raise StakingError("Only the current owner of this NFT can stake it")

        harvest = self.session.query(Harvest).filter_by(id=harvest_id).first()
        if not harvest:
            raise StakingError(f"Harvest {harvest_id} not found")

        # Disruptor-sweep finding #16 (mirrors GameService.start_cure's
        # validation): reject a non-positive duration and clamp an excessive
        # one, rather than trusting the caller (currently unreachable via the
        # HTTP route, which doesn't forward this param -- but the service
        # itself shouldn't rely on that).
        max_hours = float(self.cfg.raw.get("staking", {}).get("max_cure_hours", 720.0))
        hours = cure_target_hours if cure_target_hours is not None else self._default_cure_hours
        if hours <= 0:
            raise StakingError("Cure duration must be positive")
        hours = min(hours, max_hours)
        now = datetime.utcnow()
        lock = StakingLock(
            nft_asset_id=nft_asset_id,
            player_id=player_id,
            cure_start_at=now,
            cure_end_at=now + timedelta(hours=hours),
            cure_target_hours=hours,
            status=StakingLockStatus.ACTIVE.value,
            # Rewards are fixed at lock time from the harvest's sale_value
            # snapshot; claiming later doesn't reprice them.
            rewards_amount=self._calculate_rewards(harvest),
        )
        self.session.add(lock)

        nft.status = NFTAssetStatus.STAKING.value
        self.session.commit()

        return lock

    def get_lock_progress(self, lock_id: str) -> dict:
        """Get curing progress for a lock.

        Returns:
            {
                'lock_id': str,
                'status': 'active' | 'complete' | 'withdrawn',
                'progress_pct': float (0-100),
                'time_remaining_seconds': float,
                'can_claim': bool,
                'rewards_amount': Decimal | None,
            }
        """
        lock = self.session.query(StakingLock).filter_by(id=lock_id).first()
        if not lock:
            return {}

        now = datetime.utcnow()
        total_seconds = (lock.cure_end_at - lock.cure_start_at).total_seconds()
        elapsed_seconds = (now - lock.cure_start_at).total_seconds()

        if elapsed_seconds >= total_seconds:
            progress = 100.0
            time_remaining = 0.0
            if lock.status == StakingLockStatus.ACTIVE.value:
                lock.status = StakingLockStatus.COMPLETE.value
                self.session.commit()
        else:
            progress = (elapsed_seconds / total_seconds) * 100.0 if total_seconds > 0 else 100.0
            time_remaining = total_seconds - elapsed_seconds

        return {
            "lock_id": lock_id,
            "status": lock.status,
            "progress_pct": min(100.0, max(0.0, progress)),
            "time_remaining_seconds": max(0.0, time_remaining),
            "can_claim": lock.status
            in (StakingLockStatus.COMPLETE.value, StakingLockStatus.WITHDRAWN.value),
            "rewards_amount": lock.rewards_amount,
        }

    def claim_rewards(self, lock_id: str, player_id: str) -> Decimal:
        """Claim rewards from a completed lock. Withdraws NFT and awards bonus GC.

        Args:
            lock_id: The StakingLock to claim
            player_id: The player claiming (must match lock owner)

        Returns:
            The reward amount in GC

        Raises:
            StakingError: If lock not found, not owner, or cannot claim
        """
        lock = self.session.query(StakingLock).filter_by(id=lock_id).first()
        if not lock:
            raise StakingError(f"Lock {lock_id} not found")

        if lock.player_id != player_id:
            raise StakingError("Only the lock owner can claim rewards")

        if lock.status not in (StakingLockStatus.COMPLETE.value, StakingLockStatus.WITHDRAWN.value):
            raise StakingError(f"Lock status is {lock.status}, cannot claim yet")

        if lock.rewards_claimed_at:
            raise StakingError("Rewards already claimed for this lock")

        if lock.rewards_amount and lock.rewards_amount > 0:
            post(
                session=self.session,
                player_id=player_id,
                amount=lock.rewards_amount,
                entry_type=LedgerEntryType.STAKING_REWARD,
                ref_type="staking_lock",
                ref_id=lock_id,
            )

        nft = self.session.query(NFTAsset).filter_by(asset_id=lock.nft_asset_id).first()
        if nft:
            nft.status = NFTAssetStatus.MINTED.value
            # Disruptor-sweep finding #2: mark the cure used up so create_lock
            # rejects re-staking this asset for another reward cycle.
            nft.staked_once = True

        lock.status = StakingLockStatus.WITHDRAWN.value
        lock.rewards_claimed_at = datetime.utcnow()
        self.session.commit()

        return lock.rewards_amount or Decimal(0)

    def get_player_locks(
        self, player_id: str, status_filter: Optional[str] = None
    ) -> List[StakingLock]:
        """Get all staking locks for a player."""
        query = self.session.query(StakingLock).filter_by(player_id=player_id)
        if status_filter:
            query = query.filter_by(status=status_filter)
        return query.order_by(StakingLock.cure_end_at.desc()).all()

    def get_lock_by_nft(self, nft_asset_id: int) -> Optional[StakingLock]:
        """Get the active/completed lock for an NFT, if it exists."""
        return (
            self.session.query(StakingLock)
            .filter(
                StakingLock.nft_asset_id == nft_asset_id,
                StakingLock.status.in_(
                    [StakingLockStatus.ACTIVE.value, StakingLockStatus.COMPLETE.value]
                ),
            )
            .first()
        )

    def _calculate_rewards(self, harvest: Harvest) -> Decimal:
        """Staking reward: `staking.reward_pct` of the harvest's sale_value."""
        base_value = harvest.sale_value or Decimal("0")
        return base_value * self._reward_pct
