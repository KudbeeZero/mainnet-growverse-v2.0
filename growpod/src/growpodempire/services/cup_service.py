"""
CupService — seasonal Cannabis Cup competitions.

Each season runs one Cup (`edition` = "<year>-<season>", e.g. "2026-summer",
driven by `events.current_season`). Players enter an unsold harvest for a GROW
fee; every entry is scored by a deterministic, server-authoritative judge
(`economy.pricing.cup_score`) and the score is snapshotted immutably. When the
season window closes the Cup **auto-judges on read** (compute-on-read, like the
sim): entries are ranked, prizes paid, and the champion earns LIFETIME prestige —
a one-of-a-kind commemorative legendary strain (seeded to their inventory) plus a
permanent `cannabis_cup_title`. Idempotent throughout; the ledger is the guard
against double payouts.
"""

from datetime import timedelta
from decimal import Decimal
from typing import List, Optional

from sqlalchemy.orm import Session

from ..economy.config import get_economy_config, EconomyConfig
from ..economy.ledger import post, balance
from ..economy import pricing
from ..enums import LedgerEntryType, Rarity, LineageType, SeedSource
from ..db.models import CannabisCup, CupEntry, Harvest, Player, Strain
from ..db.seed import slugify
from ..genetics.breeding import derive_strain_fields
from ..simulation.clock import Clock, SystemClock
from . import leveling_service
from .badge_service import BadgeService
from .game_service import GameService, GameError


class CupService:
    def __init__(
        self,
        session: Session,
        config: Optional[EconomyConfig] = None,
        clock: Optional[Clock] = None,
    ):
        self.session = session
        self.cfg = config or get_economy_config()
        self.clock = clock or SystemClock()
        self._cfg = self.cfg.raw.get("cannabis_cup", {})

    # ----- helpers --------------------------------------------------------
    @property
    def _enabled(self) -> bool:
        return bool(self._cfg.get("enabled", True))

    def _edition(self):
        """(edition, season) for the current period, keyed off the active season."""
        year = self.clock.now().year
        season = self.cfg.current_season or "all"
        if season == "all":
            return f"{year}-annual", "all"
        return f"{year}-{season}", season

    def _title(self, edition: str, season: str) -> str:
        label = "Annual" if season == "all" else season.capitalize()
        year = edition.split("-")[0]
        return f"{label} {year} Cannabis Cup"

    # ----- lifecycle ------------------------------------------------------
    def open_current_cup(self) -> Optional[CannabisCup]:
        """Idempotently ensure the current season's Cup exists (if enabled)."""
        if not self._enabled:
            return None
        edition, season = self._edition()
        cup = (
            self.session.query(CannabisCup)
            .filter(CannabisCup.edition == edition)
            .one_or_none()
        )
        if cup is None:
            now = self.clock.now()
            cup = CannabisCup(
                edition=edition,
                season=season,
                title=self._title(edition, season),
                status="open",
                entry_fee=Decimal(str(self._cfg.get("entry_fee", 100))),
                prize_pool=Decimal("0"),
                starts_at=now,
                ends_at=now + timedelta(days=int(self._cfg.get("duration_days", 90))),
            )
            self.session.add(cup)
            self.session.flush()
        else:
            self._maybe_judge(cup)
        return cup

    def current_cup(self) -> Optional[CannabisCup]:
        cup = self.open_current_cup()
        # Sweep any other still-open cup whose window has closed.
        for other in self.session.query(CannabisCup).filter(CannabisCup.status == "open").all():
            self._maybe_judge(other)
        return cup

    def get_cup(self, cup_id: str) -> CannabisCup:
        cup = self.session.get(CannabisCup, cup_id)
        if cup is None:
            raise GameError("Cup not found")
        self._maybe_judge(cup)
        return cup

    def list_cups(self, limit: int = 20) -> List[CannabisCup]:
        return (
            self.session.query(CannabisCup)
            .order_by(CannabisCup.created_at.desc())
            .limit(limit)
            .all()
        )

    # ----- entry ----------------------------------------------------------
    def enter(self, player_id: str, harvest_id: str) -> dict:
        GameService(self.session).get_player(player_id)
        cup = self.open_current_cup()
        if cup is None:
            raise GameError("No Cannabis Cup is running")
        if cup.status != "open" or self.clock.now() >= cup.ends_at:
            self._maybe_judge(cup)
            raise GameError("This Cup has closed")

        harvest = self.session.get(Harvest, harvest_id)
        if harvest is None or harvest.player_id != player_id:
            raise GameError("Harvest not found")
        if harvest.sold:
            raise GameError("That harvest has been sold or consumed")

        if (
            self.session.query(CupEntry)
            .filter(CupEntry.cup_id == cup.id, CupEntry.harvest_id == harvest_id)
            .first()
        ):
            raise GameError("That harvest is already entered in this Cup")

        max_entries = int(self._cfg.get("max_entries_per_player", 3))
        used = (
            self.session.query(CupEntry)
            .filter(CupEntry.cup_id == cup.id, CupEntry.player_id == player_id)
            .count()
        )
        if used >= max_entries:
            raise GameError(f"You've used all {max_entries} entries for this Cup")

        # Entry fee (sink) -> the prize pool.
        post(
            self.session, player_id, -cup.entry_fee, LedgerEntryType.CUP_ENTRY_FEE,
            ref_type="cup", ref_id=cup.id,
        )
        cup.prize_pool = cup.prize_pool + cup.entry_fee

        terp = max((float(v) for v in (harvest.terpenes or {}).values()), default=0.0)
        score = pricing.cup_score(
            harvest.weight_g, harvest.quality, harvest.rarity_snapshot, self.cfg,
            thc_actual=harvest.thc_actual or 15.0,
            cbd_actual=harvest.cbd_actual or 0.0,
            terpene_intensity=terp,
        )
        strain = self.session.get(Strain, harvest.strain_id)
        entry = CupEntry(
            cup_id=cup.id,
            player_id=player_id,
            harvest_id=harvest_id,
            strain_id=harvest.strain_id,
            strain_name=strain.name if strain else "Unknown",
            score=score,
            submitted_at=self.clock.now(),
        )
        self.session.add(entry)
        self.session.flush()
        return {
            "cup_id": cup.id,
            "edition": cup.edition,
            "entry_id": entry.id,
            "score": score,
            "balance": float(balance(self.session, player_id)),
        }

    # ----- judging --------------------------------------------------------
    def _maybe_judge(self, cup: CannabisCup) -> None:
        if cup.status == "open" and self.clock.now() >= cup.ends_at:
            self.judge(cup)

    def judge(self, cup: CannabisCup) -> CannabisCup:
        """Rank entries, pay prizes, and crown the champion. Idempotent."""
        if cup.status != "open":
            return cup
        entries = (
            self.session.query(CupEntry)
            .filter(CupEntry.cup_id == cup.id)
            .order_by(
                CupEntry.score.desc(),
                CupEntry.submitted_at.asc(),
                CupEntry.id.asc(),
            )
            .all()
        )
        prizes = self._cfg.get("prizes", {})
        for i, entry in enumerate(entries):
            rank = i + 1
            entry.rank = rank
            prize = self._prize_for(rank, prizes)
            if prize > 0:
                entry.prize_grow = Decimal(str(prize))
                post(
                    self.session, entry.player_id, entry.prize_grow,
                    LedgerEntryType.CUP_PRIZE_PAYOUT, ref_type="cup", ref_id=cup.id,
                    idempotency_key=f"reward:cup_prize:{cup.id}:{entry.player_id}",
                )
                xp = int(self._cfg.get("champion_xp", 0)) if rank == 1 else int(self._cfg.get("placer_xp", 0))
                if xp:
                    leveling_service.award_xp(self.session, entry.player_id, xp, self.cfg)

        if entries:
            champ_entry = entries[0]
            cup.winner_id = champ_entry.player_id
            champion = self._mint_champion(cup, champ_entry)
            if champion is not None:
                cup.champion_strain_id = champion.id
            player = self.session.get(Player, champ_entry.player_id)
            if player is not None:
                player.cannabis_cup_title = f"{cup.title} Champion"
            BadgeService(self.session).check_all(champ_entry.player_id)

        cup.status = "judged"
        cup.judged_at = self.clock.now()
        self.session.flush()
        return cup

    def _prize_for(self, rank: int, prizes: dict) -> float:
        if rank == 1:
            return float(prizes.get("first", 0))
        if rank == 2:
            return float(prizes.get("second", 0))
        if rank == 3:
            return float(prizes.get("third", 0))
        if rank <= int(prizes.get("top_n", 10)):
            return float(prizes.get("top_each", 0))
        return 0.0

    def _mint_champion(self, cup: CannabisCup, entry: CupEntry) -> Optional[Strain]:
        """A one-of-a-kind LEGENDARY strain derived from the winning genetics —
        the lifetime trophy. Carries the winning strain as its parent (lineage)."""
        gs = GameService(self.session)
        src = self.session.get(Strain, entry.strain_id)
        if src is None or not src.genome:
            return None
        genome = dict(src.genome)
        stability = min(1.0, max(0.95, src.stability or 0.95))
        fields = derive_strain_fields(genome, stability)
        name = f"{src.name} '{cup.title} Champion'"
        champion = Strain(
            name=name,
            slug=gs._unique_slug(slugify(name)),
            lineage_type=LineageType.BRED.value,
            rarity=Rarity.LEGENDARY.value,
            terpenes=list(src.terpenes or []),
            genome=genome,
            stability=stability,
            generation=(src.generation or 0) + 1,
            parent_a_id=src.id,
            parent_b_id=None,
            is_base_catalog=False,
            created_by_player_id=entry.player_id,
            **fields,
        )
        self.session.add(champion)
        self.session.flush()
        stack = gs._get_or_create_seed_stack(entry.player_id, champion.id, SeedSource.BRED)
        stack.quantity += 1
        return champion

    # ----- read-only standings / hall of fame -----------------------------
    def standings(self, cup_id: str, limit: int = 50) -> List[CupEntry]:
        cup = self.get_cup(cup_id)
        return (
            self.session.query(CupEntry)
            .filter(CupEntry.cup_id == cup.id)
            .order_by(CupEntry.score.desc(), CupEntry.submitted_at.asc())
            .limit(limit)
            .all()
        )

    def hall_of_fame(self, limit: int = 25) -> List[dict]:
        """Past champions — the lifetime record of every season's winner."""
        rows = (
            self.session.query(CannabisCup)
            .filter(CannabisCup.status == "judged", CannabisCup.winner_id.isnot(None))
            .order_by(CannabisCup.judged_at.desc())
            .limit(limit)
            .all()
        )
        out: List[dict] = []
        for cup in rows:
            winner = self.session.get(Player, cup.winner_id)
            champ = (
                self.session.get(Strain, cup.champion_strain_id)
                if cup.champion_strain_id
                else None
            )
            out.append({
                "edition": cup.edition,
                "title": cup.title,
                "season": cup.season,
                "winner_id": cup.winner_id,
                "winner": winner.username if winner else None,
                "champion_strain": champ.name if champ else None,
                "champion_strain_id": cup.champion_strain_id,
                "judged_at": cup.judged_at.isoformat() if cup.judged_at else None,
            })
        return out
