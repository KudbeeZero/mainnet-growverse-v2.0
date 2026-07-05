"""
SettlementService — materialize in-game GROW on-chain and back.

The DB ledger stays authoritative; this mirrors balances to the GROW ASA:
- withdraw: debit the in-game balance, transfer ASA treasury -> player, bump
  wallet.asa_balance, and stamp the ledger entry with the on-chain txid.
- deposit:  the reverse.
Uses the configured chain provider (offline MockChainProvider by default).
"""

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy.orm import Session
from sqlalchemy.orm.exc import StaleDataError

from ..config import get_settings
from ..economy.config import get_economy_config, EconomyConfig
from ..economy.ledger import post, to_money, get_wallet
from ..enums import LedgerEntryType
from ..db.models import Player, LedgerEntry
from ..chain.provider import ChainProvider, ChainError, TREASURY
from ..chain.mock import MockChainProvider
from ..chain.factory import shared_provider
from ..chain.token import create_token_asa
from .game_service import GameError


class SettlementService:
    def __init__(
        self,
        session: Session,
        provider: Optional[ChainProvider] = None,
        config: Optional[EconomyConfig] = None,
        settings=None,
        asset_id: Optional[int] = None,
    ):
        self.session = session
        self.cfg = config or get_economy_config()
        self.settings = settings or get_settings()
        self.provider = provider or shared_provider(self.settings)
        self._decimals = int(self.cfg.raw.get("chain", {}).get("token", {}).get("decimals", 6))
        # Resolve the GROW ASA id: configured, explicit, or freshly created.
        self.asset_id = asset_id or self.settings.asa_id or create_token_asa(self.provider, self.cfg)

    def _base_units(self, amount: Decimal) -> int:
        return int(amount * (10 ** self._decimals))

    def _require_amount(self, amount) -> Decimal:
        amount = to_money(amount)
        if amount <= 0:
            raise GameError("amount must be positive")
        return amount

    def _enforce_daily_cap(self, player_id: str, amount: Decimal) -> None:
        """Block withdrawals that exceed the rolling-24h per-player cap.

        Defence in depth around the treasury: even with a stolen API key, an
        attacker can't drain more than the configured daily limit.
        """
        cap = to_money(self.settings.max_withdrawal_per_day)
        if cap <= 0:  # cap disabled
            return
        since = datetime.now(timezone.utc) - timedelta(hours=24)
        rows = (
            self.session.query(LedgerEntry)
            .filter(
                LedgerEntry.player_id == player_id,
                LedgerEntry.entry_type == LedgerEntryType.ASA_WITHDRAWAL.value,
                LedgerEntry.created_at >= since,
            )
            .all()
        )
        # Withdrawal entries are negative; sum their magnitudes.
        already = sum((-r.amount for r in rows), Decimal("0"))
        if already + amount > cap:
            remaining = cap - already
            raise GameError(
                f"Daily withdrawal limit reached (cap {cap}/24h, "
                f"{remaining if remaining > 0 else 0} remaining)"
            )

    def withdraw(self, player_id: str, amount) -> dict:
        amount = self._require_amount(amount)
        player = self.session.get(Player, player_id)
        if player is None:
            raise GameError("Player not found")
        if not player.algorand_address:
            raise GameError("Link an Algorand wallet first")

        # Debit in-game balance (raises InsufficientFundsError if short).
        entry = post(
            self.session, player_id, -amount, LedgerEntryType.ASA_WITHDRAWAL,
            ref_type="asa", ref_id=str(self.asset_id),
        )
        # Then enforce the rolling-24h treasury cap. The just-posted entry isn't
        # flushed yet (autoflush is off), so it isn't double-counted; a violation
        # raises and the surrounding transaction rolls the debit back.
        self._enforce_daily_cap(player_id, amount)

        # SECURITY (double-payout, 2026-07-05 review): commit the debit BEFORE
        # calling the chain. This is the load-bearing ordering fix -- it makes
        # Wallet.version_id_col resolve the concurrent-withdraw race *here*,
        # instead of after an irreversible on-chain transfer has already fired
        # for both racing requests. If another session already debited and
        # committed this wallet since we read it, this flush raises
        # StaleDataError; the loser must NEVER reach transfer_asset(), so we
        # catch it, roll back, and hand the caller a clean retry error instead
        # of letting both sides race to the chain call.
        try:
            self.session.commit()
        except StaleDataError:
            self.session.rollback()
            raise GameError(
                "Withdrawal conflicted with a concurrent request; please retry."
            )

        try:
            txid = self.provider.transfer_asset(
                self.asset_id, player.algorand_address, self._base_units(amount)
            )
        except ChainError as exc:
            # The debit already committed but the payout never happened. Post
            # a compensating credit so the player isn't left out of pocket,
            # then still surface the failure so the caller knows the transfer
            # didn't go through (even though their funds are safe).
            post(
                self.session, player_id, amount, LedgerEntryType.ADJUSTMENT,
                ref_type="asa_withdrawal_reversal", ref_id=str(self.asset_id),
            )
            self.session.commit()
            raise GameError(f"On-chain transfer failed: {exc}") from exc

        entry.onchain_txid = txid
        wallet = get_wallet(self.session, player_id)
        wallet.asa_balance = to_money((wallet.asa_balance or Decimal("0")) + amount)
        self.session.commit()
        return {
            "withdrawn": float(amount),
            "txid": txid,
            "asa_balance": float(wallet.asa_balance),
            "balance": float(wallet.cached_balance),
        }

    def deposit(self, player_id: str, amount) -> dict:
        amount = self._require_amount(amount)
        wallet = get_wallet(self.session, player_id)
        if (wallet.asa_balance or Decimal("0")) < amount:
            raise GameError("Insufficient on-chain ASA balance")

        # SAFETY (treasury): the current deposit implementation can only work as a
        # self-contained DB fiction on the MockChainProvider. On a REAL chain the
        # player's ASA lives in their own custodial wallet, so a treasury-signed
        # transfer_asset(..., TREASURY, ...) is a treasury->treasury self-transfer
        # that pulls back NONE of the player's tokens — yet the code below would
        # still credit in-game GROW and debit asa_balance. That lets a player who
        # withdrew real ASA keep it on-chain AND get re-credited (treasury drain).
        # Until deposits are driven by a player-SIGNED inbound transfer that we
        # verify on-chain (submit signed player->treasury AssetTransferTxn, confirm
        # txid/amount/asset/sender via the indexer, THEN credit), fail closed on
        # any non-mock provider rather than mis-credit against a live treasury.
        if not isinstance(self.provider, MockChainProvider):
            raise GameError(
                "On-chain deposit is temporarily unavailable: it requires a "
                "player-signed, on-chain-verified inbound transfer."
            )

        try:
            txid = self.provider.transfer_asset(
                self.asset_id, TREASURY, self._base_units(amount)
            )
        except ChainError as exc:
            raise GameError(f"On-chain transfer failed: {exc}") from exc

        entry = post(
            self.session, player_id, amount, LedgerEntryType.ASA_DEPOSIT,
            ref_type="asa", ref_id=str(self.asset_id),
        )
        entry.onchain_txid = txid
        wallet.asa_balance = to_money((wallet.asa_balance or Decimal("0")) - amount)
        return {
            "deposited": float(amount),
            "txid": txid,
            "asa_balance": float(wallet.asa_balance),
            "balance": float(wallet.cached_balance),
        }
