"""
Flask blueprint for the DB-backed game: players, wallets, strains, seeds,
breeding, harvest, and the marketplace.

Each request runs inside a `session_scope` transaction; ORM rows are serialized
to JSON-safe dicts before the scope closes.
"""

from flask import Blueprint, request, jsonify

from ..db.session import session_scope
from ..services.game_service import GameService, GameError
from ..services.simulation_service import SimulationService
from ..services.minting_service import MintingService
from ..services.settlement_service import SettlementService
from ..services.progression_service import ProgressionService
from ..services.leaderboard_service import LeaderboardService
from ..services.weather_service import WeatherService
from ..services.contract_service import ContractService
from ..services.cup_service import CupService
from ..services.university_service import UniversityService
from ..services.engagement_service import UniversityEngagementService
from ..services.learner_model_service import LearnerModelService
from ..services.seasonal_service import SeasonalService
from ..services.research_service import ResearchService
from ..services.waitlist_service import WaitlistService
from ..services.factions import load_factions
from ..services import leveling_service
from ..services.badge_service import BadgeService, rank_for_level
from ..economy.ledger import InsufficientFundsError
from ..feature_flags import (
    all_flags,
    FeatureDisabledError,
    feature_required as require_feature,
    require_feature as require_feature_guard,
)
from .auth import require_player, require_admin
from .ratelimit import limiter
from .validation import positive_int, bounded_int, positive_money, number
from . import serialize as S

game_bp = Blueprint("game", __name__, url_prefix="/api/game")


def _error(message: str, status: int = 400):
    return jsonify({"error": message}), status


@game_bp.errorhandler(GameError)
def _handle_game_error(exc):  # pragma: no cover - registered per blueprint
    return _error(str(exc), 400)


@game_bp.errorhandler(FeatureDisabledError)
def _handle_feature_disabled(exc):  # pragma: no cover - registered per blueprint
    # A gated-off surface reads as "not available" rather than a hard error.
    return _error(str(exc), 404)


# ----- Feature flags -----------------------------------------------------
@game_bp.get("/flags")
def feature_flags():
    """Public, read-only view of the resolved feature-flag map (balance.yaml
    defaults with FEATURE_<NAME> env overrides applied). Lets the web client gate
    routes/components and acts as a launch kill-switch surface — no deploy needed
    to flip one."""
    return jsonify({"flags": all_flags()})


# ----- Faction + launch waitlist (NON-ECONOMIC, flag-gated) --------------
@game_bp.get("/factions")
@require_feature("faction_waitlist")
def list_factions():
    """Public display catalog of the pre-launch factions, so the web client can
    render the picker. Gated by the ``faction_waitlist`` flag; pure data."""
    return jsonify(load_factions())


@game_bp.post("/waitlist")
@require_feature("faction_waitlist")
@limiter.limit("10 per hour")
def join_waitlist():
    """Public, rate-limited join: choose a faction and optionally submit an
    Algorand address and/or email. NON-ECONOMIC — stores a string for a future
    reward; touches no ledger/wallet/economy and does no on-chain action."""
    data = request.get_json(force=True, silent=True) or {}
    if not data.get("faction"):
        return _error("faction is required")
    try:
        with session_scope() as s:
            payload = WaitlistService(s).join(
                faction=data["faction"],
                algorand_address=data.get("algorand_address"),
                email=data.get("email"),
                source=data.get("source", "web"),
            )
        return jsonify(payload), 201
    except GameError as e:
        return _error(str(e))


@game_bp.get("/waitlist/standings")
@require_feature("faction_waitlist")
def waitlist_standings():
    """Public per-faction signup counts + total for the live signup meter."""
    with session_scope() as s:
        payload = WaitlistService(s).standings()
    return jsonify(payload)


@game_bp.post("/waitlist/engage")
@require_feature("faction_waitlist")
@limiter.limit("30 per hour")
def waitlist_engage():
    """Public, rate-limited: add a small clamped amount of engagement points to
    an existing signup (identified by address, email, or signup_id)."""
    data = request.get_json(force=True, silent=True) or {}
    points = bounded_int(data.get("points"), "points", default=1, low=0, high=50)
    try:
        with session_scope() as s:
            payload = WaitlistService(s).add_engagement(
                algorand_address=data.get("algorand_address"),
                email=data.get("email"),
                signup_id=data.get("signup_id"),
                points=points,
            )
        return jsonify(payload)
    except GameError as e:
        return _error(str(e), 404)


# ----- Players -----------------------------------------------------------
@game_bp.post("/players")
@limiter.limit("30 per hour")
def create_player():
    data = request.get_json(force=True, silent=True) or {}
    if not data.get("username"):
        return _error("username is required")
    try:
        with session_scope() as s:
            svc = GameService(s)
            player = svc.create_player(data["username"], data.get("email"))
            # On signup, hand the new player a starter pod + seed (idempotent,
            # one-shot) so they can reach their first grow with zero setup.
            svc.grant_starter_items(player.id)
            wallet = svc.get_wallet(player.id)
            payload = player_payload(player, wallet)
            # Returned exactly once — the client must store it to authenticate writes.
            payload["api_key"] = player.api_key
        return jsonify(payload), 201
    except GameError as e:
        return _error(str(e))


@game_bp.get("/players/<player_id>")
@require_player
def get_player(player_id):
    try:
        with session_scope() as s:
            svc = GameService(s)
            player = svc.get_player(player_id)
            wallet = svc.get_wallet(player.id)
            payload = player_payload(player, wallet)
        return jsonify(payload)
    except GameError as e:
        return _error(str(e), 404)


def player_payload(player, wallet) -> dict:
    out = S.player_dict(player, balance=wallet.cached_balance)
    out["wallet"] = S.wallet_dict(wallet)
    return out


@game_bp.get("/players/<player_id>/wallet")
@require_player
def get_wallet(player_id):
    try:
        with session_scope() as s:
            payload = S.wallet_dict(GameService(s).get_wallet(player_id))
        return jsonify(payload)
    except GameError as e:
        return _error(str(e), 404)


@game_bp.get("/players/<player_id>/level")
def get_level(player_id):
    try:
        with session_scope() as s:
            player = GameService(s).get_player(player_id)
            payload = leveling_service.progress(player)
        return jsonify(payload)
    except GameError as e:
        return _error(str(e), 404)


@game_bp.get("/players/<player_id>/ledger")
@require_player
def get_ledger(player_id):
    with session_scope() as s:
        entries = GameService(s).get_ledger(player_id)
        payload = [S.ledger_dict(e) for e in entries]
    return jsonify(payload)


# ----- Leaderboards ------------------------------------------------------
@game_bp.get("/leaderboards/<board>")
def leaderboards(board):
    limit = bounded_int(request.args.get("limit"), "limit", default=10, low=1, high=100)
    boards = {
        "richest": "richest",
        "breeders": "top_breeders",
        "harvests": "biggest_harvesters",
        "level": "top_levels",
        "researchers": "top_researchers",
    }
    if board == "scholars":
        # The University KXP league (NON-ECONOMIC). Gated by the university flag;
        # public read like the other boards.
        require_feature_guard("university")
        with session_scope() as s:
            payload = UniversityEngagementService(s).scholars(limit)
        return jsonify(payload)
    if board not in boards:
        return _error(f"Unknown leaderboard '{board}'", 404)
    with session_scope() as s:
        payload = getattr(LeaderboardService(s), boards[board])(limit)
    return jsonify(payload)


# ----- Strains -----------------------------------------------------------
@game_bp.get("/strains")
def list_strains():
    args = request.args

    def _f(name):
        v = args.get(name)
        if v in (None, ""):
            return None
        try:
            return float(v)
        except (TypeError, ValueError):
            raise GameError(f"{name} must be a number")

    with session_scope() as s:
        strains = GameService(s).list_strains(
            catalog_only=args.get("catalog_only", "false").lower() == "true",
            q=args.get("q"),
            rarity=args.get("rarity"),
            lineage_type=args.get("lineage_type"),
            min_thc=_f("min_thc"),
            max_thc=_f("max_thc"),
            min_indica=_f("min_indica"),
            max_indica=_f("max_indica"),
        )
        payload = [S.strain_dict(st) for st in strains]
    return jsonify(payload)


@game_bp.get("/players/<player_id>/favorites")
@require_player
def list_favorites(player_id):
    with session_scope() as s:
        strains = GameService(s).list_favorites(player_id)
        payload = [S.strain_dict(st) for st in strains]
    return jsonify(payload)


@game_bp.post("/players/<player_id>/strains/<strain_id>/favorite")
@require_player
def add_favorite(player_id, strain_id):
    try:
        with session_scope() as s:
            GameService(s).add_favorite(player_id, strain_id)
        return jsonify({"favorited": True}), 201
    except GameError as e:
        return _error(str(e))


@game_bp.delete("/players/<player_id>/strains/<strain_id>/favorite")
@require_player
def remove_favorite(player_id, strain_id):
    with session_scope() as s:
        GameService(s).remove_favorite(player_id, strain_id)
    return jsonify({"favorited": False})


@game_bp.get("/strains/<strain_id>")
def get_strain(strain_id):
    try:
        with session_scope() as s:
            payload = S.strain_dict(GameService(s).get_strain(strain_id))
        return jsonify(payload)
    except GameError as e:
        return _error(str(e), 404)


@game_bp.get("/strains/<strain_id>/provenance")
def strain_provenance(strain_id):
    """Provably-fair check: re-derive a bred strain's genome from its public
    breeding seed and confirm it matches. Public/read-only — anyone can verify."""
    try:
        with session_scope() as s:
            payload = GameService(s).verify_strain(strain_id)
        return jsonify(payload)
    except GameError as e:
        return _error(str(e), 404)


@game_bp.get("/strains/<strain_id>/lineage")
def strain_lineage(strain_id):
    """Verifiable pedigree: replay every bred ancestor back to base-catalog
    roots. The provable family tree behind the GenBank. Public/read-only."""
    try:
        with session_scope() as s:
            payload = GameService(s).verify_lineage(strain_id)
        return jsonify(payload)
    except GameError as e:
        return _error(str(e), 404)


@game_bp.get("/strains/<strain_id>/knowledge")
def strain_knowledge(strain_id):
    """Scientist-grade encyclopedia for a catalog strain — lineage, origin,
    sensory/effect profile, cannabinoid & terpene detail, cultivation
    parameters. Public/read-only."""
    try:
        with session_scope() as s:
            payload = GameService(s).strain_knowledge(strain_id)
        return jsonify(payload)
    except GameError as e:
        return _error(str(e), 404)


@game_bp.get("/strains/<strain_id>/effects")
def strain_effects(strain_id):
    """Terpene -> effect (buff) profile for a strain: aroma/chemotype turned into
    predictable gameplay effects, with a mind<->body lean, flavor families, and
    the entourage synergy. Works for base-catalog and player-bred strains.
    Read-only; public."""
    try:
        with session_scope() as s:
            payload = GameService(s).strain_effects(strain_id)
        return jsonify(payload)
    except GameError as e:
        return _error(str(e), 404)


@game_bp.get("/economy/health")
def economy_health():
    """Public faucet-vs-sink transparency view over the ledger: money supply,
    net issuance, an inflation indicator, and a per-type breakdown. Read-only —
    anyone can audit whether the economy is inflating (the trust-layer wedge)."""
    from ..services import economy_service

    with session_scope() as s:
        return jsonify(economy_service.economy_health(s))


# ----- Seeds & planting --------------------------------------------------
@game_bp.get("/players/<player_id>/seeds")
@require_player
def list_seeds(player_id):
    with session_scope() as s:
        seeds = GameService(s).get_seed_inventory(player_id)
        payload = [S.seed_dict(x) for x in seeds]
    return jsonify(payload)


@game_bp.get("/players/<player_id>/pods")
@require_player
def list_pods(player_id):
    try:
        with session_scope() as s:
            pods = GameService(s).list_pods(player_id)
            payload = [S.pod_dict(p) for p in pods]
        return jsonify(payload)
    except GameError as e:
        return _error(str(e), 404)


@game_bp.get("/players/<player_id>/plants")
@require_player
def list_plants(player_id):
    try:
        with session_scope() as s:
            plants = GameService(s).list_plants(player_id)
            payload = [S.plant_dict(p) for p in plants]
        return jsonify(payload)
    except GameError as e:
        return _error(str(e), 404)


@game_bp.get("/players/<player_id>/turbo")
@require_player
def get_turbo(player_id):
    """Current global 10× speed-faucet state for the account."""
    try:
        with session_scope() as s:
            svc = GameService(s)
            state = svc.turbo_state(svc.get_player(player_id))
        return jsonify(state)
    except GameError as e:
        return _error(str(e), 404)


@game_bp.post("/players/<player_id>/turbo")
@require_player
def set_turbo(player_id):
    """Turn the global 10× speed faucet ON/OFF for the whole account. Body:
    {"enabled": true|false}. Affects every pod at once and is reflected in the
    account immediately (all living plants are caught up to the new clock)."""
    data = request.get_json(force=True, silent=True) or {}
    enabled = bool(data.get("enabled", False))
    try:
        with session_scope() as s:
            state = GameService(s).set_turbo(player_id, enabled)
        return jsonify(state)
    except GameError as e:
        return _error(str(e), 404)


@game_bp.post("/players/<player_id>/seeds/buy")
@require_player
def buy_seed(player_id):
    data = request.get_json(force=True, silent=True) or {}
    if not data.get("strain_id"):
        return _error("strain_id is required")
    try:
        quantity = positive_int(data.get("quantity", 1), "quantity")
        with session_scope() as s:
            stack = GameService(s).buy_seed(player_id, data["strain_id"], quantity)
            payload = S.seed_dict(stack)
        return jsonify(payload), 201
    except (GameError, InsufficientFundsError) as e:
        return _error(str(e))


@game_bp.post("/players/<player_id>/pods")
@require_player
def create_pod(player_id):
    data = request.get_json(force=True, silent=True) or {}
    if not data.get("name"):
        return _error("name is required")
    try:
        capacity = bounded_int(data.get("capacity"), "capacity", default=4, low=1, high=100)
        with session_scope() as s:
            pod = GameService(s).create_pod(
                player_id,
                data["name"],
                capacity,
                data.get("tier", "basic"),
                charge=bool(data.get("charge", True)),
            )
            payload = S.pod_dict(pod)
        return jsonify(payload), 201
    except (GameError, InsufficientFundsError) as e:
        return _error(str(e))


@game_bp.post("/players/<player_id>/pods/<pod_id>/upgrade")
@require_player
def upgrade_pod(player_id, pod_id):
    data = request.get_json(force=True, silent=True) or {}
    if not data.get("tier"):
        return _error("tier is required")
    try:
        with session_scope() as s:
            pod = GameService(s).upgrade_pod(player_id, pod_id, data["tier"])
            payload = S.pod_dict(pod)
        return jsonify(payload)
    except (GameError, InsufficientFundsError) as e:
        return _error(str(e))


@game_bp.post("/players/<player_id>/plant")
@require_player
def plant_seed(player_id):
    data = request.get_json(force=True, silent=True) or {}
    if not data.get("seed_id") or not data.get("pod_id"):
        return _error("seed_id and pod_id are required")
    try:
        with session_scope() as s:
            plant = GameService(s).plant_seed(
                player_id, data["seed_id"], data["pod_id"], soil_key=data.get("soil_key")
            )
            payload = S.plant_dict(plant)
        return jsonify(payload), 201
    except GameError as e:
        return _error(str(e))


# ----- Breeding ----------------------------------------------------------
@game_bp.post("/players/<player_id>/breed")
@require_feature("breeding_lab")
@require_player
def breed(player_id):
    data = request.get_json(force=True, silent=True) or {}
    if not data.get("parent_a_id") or not data.get("parent_b_id"):
        return _error("parent_a_id and parent_b_id are required")
    # The RNG seed is generated server-side (see GameService.breed); accepting it
    # from the client would let players "seed-shop" for ideal offspring.
    try:
        with session_scope() as s:
            offspring = GameService(s).breed(
                player_id,
                data["parent_a_id"],
                data["parent_b_id"],
                offspring_name=data.get("name"),
            )
            BadgeService(s).check_all(player_id)
            payload = S.strain_dict(offspring)
        return jsonify(payload), 201
    except (GameError, InsufficientFundsError) as e:
        return _error(str(e))


# ----- Harvest -----------------------------------------------------------
@game_bp.post("/players/<player_id>/strains/<strain_id>/stabilize")
@require_player
def stabilize_strain(player_id, strain_id):
    # RNG seed is server-generated (anti seed-shopping); not read from the body.
    try:
        with session_scope() as s:
            strain = GameService(s).stabilize_strain(player_id, strain_id)
            payload = S.strain_dict(strain)
        return jsonify(payload), 201
    except (GameError, InsufficientFundsError) as e:
        return _error(str(e))


@game_bp.post("/players/<player_id>/plants/<plant_id>/harvest")
@require_player
def harvest(player_id, plant_id):
    data = request.get_json(force=True, silent=True) or {}
    # Yield weight and quality are computed SERVER-SIDE from the plant's
    # simulated health/genetics — never accepted from the client, or a player
    # could mint unlimited currency. Only the sell flag is client-controlled.
    try:
        with session_scope() as s:
            h = GameService(s).harvest_plant(
                player_id,
                plant_id,
                sell=bool(data.get("sell", True)),
            )
            BadgeService(s).check_all(player_id)
            payload = S.harvest_dict(h)
        return jsonify(payload), 201
    except GameError as e:
        return _error(str(e))


@game_bp.delete("/players/<player_id>/plants/<plant_id>")
@require_player
def cleanup_plant(player_id, plant_id):
    """Pay 25 GROW to remove a harvested/dead plant and reset the pod slot."""
    try:
        with session_scope() as s:
            GameService(s).cleanup_plant(player_id, plant_id)
        return jsonify({"status": "cleaned"}), 200
    except (GameError, InsufficientFundsError) as e:
        return _error(str(e))


# ----- Harvests: inventory, curing, sale ---------------------------------
@game_bp.get("/players/<player_id>/harvests")
@require_player
def list_harvests(player_id):
    with session_scope() as s:
        harvests = GameService(s).list_harvests(player_id)
        payload = [S.harvest_dict(h) for h in harvests]
    return jsonify(payload)


@game_bp.post("/players/<player_id>/harvests/<harvest_id>/cure")
@require_player
def start_cure(player_id, harvest_id):
    data = request.get_json(force=True, silent=True) or {}
    try:
        with session_scope() as s:
            h = GameService(s).start_cure(
                player_id, harvest_id, target_hours=data.get("target_hours")
            )
            payload = S.harvest_dict(h)
        return jsonify(payload)
    except GameError as e:
        return _error(str(e))


@game_bp.post("/players/<player_id>/harvests/<harvest_id>/cure/finish")
@require_player
def finish_cure(player_id, harvest_id):
    data = request.get_json(force=True, silent=True) or {}
    try:
        with session_scope() as s:
            h = GameService(s).finish_cure(
                player_id, harvest_id, sell=bool(data.get("sell", False))
            )
            payload = S.harvest_dict(h)
        return jsonify(payload)
    except (GameError, InsufficientFundsError) as e:
        return _error(str(e))


@game_bp.post("/players/<player_id>/harvests/<harvest_id>/sell")
@require_player
def sell_harvest(player_id, harvest_id):
    try:
        with session_scope() as s:
            h = GameService(s).sell_harvest(player_id, harvest_id)
            payload = S.harvest_dict(h)
        return jsonify(payload)
    except GameError as e:
        return _error(str(e))


# ----- Research tree & shop ----------------------------------------------
@game_bp.get("/players/<player_id>/research")
@require_player
def research_tree(player_id):
    with session_scope() as s:
        tree = ResearchService(s).list_tree(player_id)
    return jsonify(tree)


@game_bp.post("/players/<player_id>/research/<node_key>/unlock")
@require_player
def research_unlock(player_id, node_key):
    try:
        with session_scope() as s:
            svc = ResearchService(s)
            svc.unlock(player_id, node_key)
            tree = svc.list_tree(player_id)
        return jsonify(tree), 201
    except (GameError, InsufficientFundsError) as e:
        return _error(str(e))


@game_bp.get("/players/<player_id>/shop")
@require_player
def shop_list(player_id):
    with session_scope() as s:
        items = GameService(s).list_consumables(player_id)
    return jsonify(items)


@game_bp.post("/players/<player_id>/shop/buy")
@require_player
def shop_buy(player_id):
    data = request.get_json(force=True, silent=True) or {}
    item_key = data.get("item_key")
    if not item_key:
        return _error("item_key is required")
    qty = bounded_int(data.get("quantity", 1), "quantity", default=1, low=1, high=99)
    try:
        with session_scope() as s:
            svc = GameService(s)
            svc.buy_consumable(player_id, item_key, qty)
            items = svc.list_consumables(player_id)
        return jsonify(items), 201
    except (GameError, InsufficientFundsError) as e:
        return _error(str(e))


@game_bp.post("/players/<player_id>/plants/<plant_id>/apply")
@require_player
def apply_consumable(player_id, plant_id):
    data = request.get_json(force=True, silent=True) or {}
    item_key = data.get("item_key")
    if not item_key:
        return _error("item_key is required")
    try:
        with session_scope() as s:
            plant = SimulationService(s).apply_consumable(player_id, plant_id, item_key)
            payload = S.plant_dict(plant)
        return jsonify(payload)
    except (GameError, InsufficientFundsError) as e:
        return _error(str(e))


# ----- Simulation (real-time grow) ---------------------------------------
@game_bp.get("/players/<player_id>/plants/<plant_id>/state")
@require_feature("grow_chamber")
@require_player
def plant_state(player_id, plant_id):
    """Return the plant's live simulated state (runs catch-up first)."""
    try:
        with session_scope() as s:
            sim = SimulationService(s)
            plant = sim.get_state(player_id, plant_id)
            events = sim.get_events(plant_id, limit=20)
            payload = S.plant_dict(plant, metrics=sim.metrics(plant))
            payload["forecast"] = sim.forecast(plant)
            payload["trichomes"] = sim.trichomes(plant)
            payload["recent_events"] = [S.event_dict(e) for e in events]
        return jsonify(payload)
    except GameError as e:
        return _error(str(e), 404)


@game_bp.get("/players/<player_id>/plants/<plant_id>/advisor")
@require_feature("master_grower_advisor")
@require_player
@limiter.limit("20 per minute")
def plant_advisor(player_id, plant_id):
    """AI 'Master Grower' diagnosis + care recommendations for a plant.

    Read-only: runs the sim catch-up, then asks the configured advisor provider
    (real Claude when ANTHROPIC_API_KEY is set, else the offline mock).
    """
    from ..services.advisor_service import AdvisorService
    from ..ai.provider import AdvisorError

    try:
        with session_scope() as s:
            advisor = AdvisorService(s)
            report = advisor.advise(player_id, plant_id)
            payload = {"provider": advisor.provider.name(), **report.model_dump()}
        return jsonify(payload)
    except GameError as e:
        return _error(str(e), 404)
    except AdvisorError as e:
        return _error(f"Advisor unavailable: {e}", 503)


@game_bp.get("/players/<player_id>/ftue/status")
@require_feature("ftue_tutorial")
@require_player
def ftue_status(player_id):
    """Current first-time-tutorial step + the tutorial plant (if any)."""
    from ..services.ftue_service import FTUEService

    try:
        with session_scope() as s:
            return jsonify(FTUEService(s).get_status(player_id))
    except GameError as e:
        return _error(str(e), 404)


@game_bp.get("/players/<player_id>/ftue/coaching/<step>")
@require_feature("ftue_tutorial")
@require_player
def ftue_coaching(player_id, step):
    """The Master Grower's scripted coaching for a tutorial step (deterministic)."""
    from ..services.ftue_service import FTUEService

    try:
        with session_scope() as s:
            report = FTUEService(s).get_coaching(player_id, step)
            return jsonify({"provider": "ftue_coach", **report.model_dump()})
    except GameError as e:
        return _error(str(e), 404)


@game_bp.post("/players/<player_id>/ftue/advance")
@require_feature("ftue_tutorial")
@require_player
@limiter.limit("60 per minute")
def ftue_advance(player_id):
    """Complete the given tutorial step (performing its real game action) and
    advance to the next. Body: {"step": "<current step>"}."""
    from ..services.ftue_service import FTUEService

    data = request.get_json(force=True, silent=True) or {}
    step = data.get("step")
    if not step:
        return _error("step is required")
    try:
        with session_scope() as s:
            return jsonify(FTUEService(s).advance(player_id, step))
    except GameError as e:
        return _error(str(e), 400)


@game_bp.post("/players/<player_id>/plants/<plant_id>/advisor/auto-care")
@require_player
@limiter.limit("10 per minute")
def plant_auto_care(player_id, plant_id):
    """Agentic auto-care: the AI calls care actions itself within a GROW budget
    and action cap. Every action posts to the ledger like a manual one."""
    from ..config import get_settings
    from ..services.autocare_service import AutoCareService
    from ..ai.autocare import AutoCareError

    if not get_settings().enable_auto_care:
        return _error("Auto-care is disabled", 403)

    data = request.get_json(force=True, silent=True) or {}
    # Validate inputs to a clean 400 first — a non-numeric budget/max_actions
    # previously raised ValueError inside the service and escaped as a 500.
    # (Done outside the main try so it isn't mapped to the 404 used for
    # "plant not found".)
    try:
        budget = (
            positive_money(data.get("budget"), "budget")
            if data.get("budget") is not None else None
        )
        max_actions = (
            positive_int(data.get("max_actions"), "max_actions", maximum=100)
            if data.get("max_actions") is not None else None
        )
    except GameError as e:
        return _error(str(e))
    try:
        with session_scope() as s:
            result = AutoCareService(s).run(
                player_id, plant_id, budget=budget, max_actions=max_actions
            )
            result["plant"] = S.plant_dict(result["plant"])
        return jsonify(result)
    except GameError as e:
        return _error(str(e), 404)
    except (AutoCareError, InsufficientFundsError) as e:
        return _error(f"Auto-care failed: {e}", 503)


@game_bp.get("/plants/<plant_id>/events")
def plant_events(plant_id):
    limit = bounded_int(request.args.get("limit"), "limit", default=50, low=1, high=200)
    with session_scope() as s:
        events = SimulationService(s).get_events(plant_id, limit=limit)
        payload = [S.event_dict(e) for e in events]
    return jsonify(payload)


def _care_action(player_id, plant_id, method_name, **kwargs):
    try:
        with session_scope() as s:
            sim = SimulationService(s)
            plant = getattr(sim, method_name)(player_id, plant_id, **kwargs)
            payload = S.plant_dict(plant)
        return jsonify(payload)
    except (GameError, InsufficientFundsError) as e:
        return _error(str(e))


def _optional_amount(data):
    """Validate an optional care `amount` in [0, 100]; None (absent) falls back
    to the config default in the service. Rejects non-numeric/negative input at
    the boundary as a clean 400 instead of a deep 500 or a silent resource drain."""
    raw = data.get("amount")
    if raw is None:
        return None
    return number(raw, "amount", low=0, high=100)


@game_bp.post("/players/<player_id>/plants/<plant_id>/water")
@require_player
def water_plant(player_id, plant_id):
    data = request.get_json(force=True, silent=True) or {}
    try:
        amount = _optional_amount(data)
    except GameError as e:
        return _error(str(e))
    return _care_action(player_id, plant_id, "water", amount=amount)


@game_bp.post("/players/<player_id>/plants/<plant_id>/feed")
@require_player
def feed_plant(player_id, plant_id):
    data = request.get_json(force=True, silent=True) or {}
    try:
        amount = _optional_amount(data)
    except GameError as e:
        return _error(str(e))
    return _care_action(player_id, plant_id, "feed", amount=amount)


@game_bp.post("/players/<player_id>/plants/<plant_id>/treat-pests")
@require_player
def treat_pests(player_id, plant_id):
    try:
        with session_scope() as s:
            sim = SimulationService(s)
            plant = sim.treat_pests(player_id, plant_id)
            BadgeService(s).check_all(player_id)
            payload = S.plant_dict(plant)
        return jsonify(payload)
    except (GameError, InsufficientFundsError) as e:
        return _error(str(e))


@game_bp.post("/players/<player_id>/plants/<plant_id>/treat-disease")
@require_player
def treat_disease(player_id, plant_id):
    return _care_action(player_id, plant_id, "treat_disease")


@game_bp.post("/players/<player_id>/plants/<plant_id>/prune")
@require_player
def prune_plant(player_id, plant_id):
    return _care_action(player_id, plant_id, "prune")


@game_bp.post("/players/<player_id>/plants/<plant_id>/train")
@require_player
def train_plant(player_id, plant_id):
    return _care_action(player_id, plant_id, "train")


@game_bp.post("/players/<player_id>/plants/<plant_id>/boost")
@require_player
def boost_plant(player_id, plant_id):
    return _care_action(player_id, plant_id, "boost")


@game_bp.post("/players/<player_id>/plants/<plant_id>/growth-boost")
@require_player
def growth_boost_plant(player_id, plant_id):
    # Simulated purchase: spends in-game GROW to fast-forward + revive the plant.
    # Real-money checkout attaches later (see SimulationService.apply_growth_boost).
    return _care_action(player_id, plant_id, "apply_growth_boost")


@game_bp.post("/players/<player_id>/plants/<plant_id>/advance")
@require_player
@limiter.limit("60 per minute")
def advance_plant(player_id, plant_id):
    # ACCELERATE TIME: fast-forward the plant's grow clock by `hours` (a free time
    # control; the deterministic engine recomputes the trajectory).
    data = request.get_json(force=True, silent=True) or {}
    try:
        hours = float(data.get("hours"))
    except (TypeError, ValueError):
        return _error("hours must be a number")
    return _care_action(player_id, plant_id, "advance_plant", hours=hours)


@game_bp.post("/players/<player_id>/pods/<pod_id>/weather")
@require_player
def roll_weather(player_id, pod_id):
    # Weather is fully server-randomised: neither the specific event nor the RNG
    # seed is accepted from the client, so players can't force ideal conditions.
    try:
        with session_scope() as s:
            payload = WeatherService(s).roll(player_id, pod_id)
        return jsonify(payload), 201
    except GameError as e:
        return _error(str(e))


@game_bp.post("/players/<player_id>/pods/<pod_id>/environment")
@require_player
def set_environment(player_id, pod_id):
    data = request.get_json(force=True, silent=True) or {}
    required = ("temperature", "humidity", "co2_level", "light_intensity", "ph_level")
    if not all(k in data for k in required):
        return _error("temperature, humidity, co2_level, light_intensity, ph_level required")
    try:
        # Validate the five sensor inputs to a clean 400 — raw non-numeric values
        # were stored as-is and TypeError'd on the next sim read of every plant in
        # the pod. Bounds are generous physical sanity limits; the engine still
        # clamps to its optimal bands.
        temperature = number(data["temperature"], "temperature", low=-20, high=80)
        humidity = number(data["humidity"], "humidity", low=0, high=100)
        co2_level = number(data["co2_level"], "co2_level", low=0, high=5000)
        light_intensity = number(data["light_intensity"], "light_intensity", low=0, high=10000)
        ph_level = number(data["ph_level"], "ph_level", low=0, high=14)
        with session_scope() as s:
            pod = SimulationService(s).set_environment(
                player_id, pod_id,
                temperature, humidity, co2_level, light_intensity, ph_level,
            )
            payload = S.pod_dict(pod)
        return jsonify(payload)
    except GameError as e:
        return _error(str(e))


# ----- Marketplace -------------------------------------------------------
@game_bp.get("/market")
@require_feature("marketplace")
def market():
    with session_scope() as s:
        listings = GameService(s).list_market()
        payload = [S.listing_dict(x) for x in listings]
    return jsonify(payload)


@game_bp.post("/players/<player_id>/market/list")
@require_feature("marketplace")
@require_player
def create_listing(player_id):
    data = request.get_json(force=True, silent=True) or {}
    required = ("seed_id", "quantity", "unit_price")
    if not all(k in data for k in required):
        return _error("seed_id, quantity, and unit_price are required")
    try:
        quantity = positive_int(data.get("quantity"), "quantity")
        unit_price = positive_money(data.get("unit_price"), "unit_price")
        with session_scope() as s:
            listing = GameService(s).create_seed_listing(
                player_id,
                data["seed_id"],
                quantity,
                unit_price,
            )
            payload = S.listing_dict(listing)
        return jsonify(payload), 201
    except (GameError, InsufficientFundsError) as e:
        return _error(str(e))


@game_bp.post("/players/<player_id>/market/auction")
@require_feature("marketplace")
@require_player
def create_auction(player_id):
    data = request.get_json(force=True, silent=True) or {}
    required = ("seed_id", "quantity", "min_bid")
    if not all(k in data for k in required):
        return _error("seed_id, quantity, and min_bid are required")
    try:
        quantity = positive_int(data.get("quantity"), "quantity")
        min_bid = positive_money(data.get("min_bid"), "min_bid")
        duration_hours = bounded_int(
            data.get("duration_hours"), "duration_hours", default=24, low=1, high=168
        )
        with session_scope() as s:
            listing = GameService(s).create_seed_auction(
                player_id, data["seed_id"], quantity, min_bid,
                duration_hours=duration_hours,
            )
            payload = S.listing_dict(listing)
        return jsonify(payload), 201
    except (GameError, InsufficientFundsError) as e:
        return _error(str(e))


@game_bp.post("/players/<player_id>/market/<listing_id>/bid")
@require_feature("marketplace")
@require_player
def place_bid(player_id, listing_id):
    data = request.get_json(force=True, silent=True) or {}
    if data.get("amount") is None:
        return _error("amount is required")
    try:
        amount = positive_money(data.get("amount"), "amount")
        with session_scope() as s:
            listing = GameService(s).place_bid(player_id, listing_id, amount)
            payload = S.listing_dict(listing)
        return jsonify(payload)
    except (GameError, InsufficientFundsError) as e:
        return _error(str(e))


@game_bp.post("/players/<player_id>/market/<listing_id>/settle")
@require_feature("marketplace")
@require_player
def settle_auction(player_id, listing_id):
    try:
        with session_scope() as s:
            listing = GameService(s).settle_auction(player_id, listing_id)
            payload = S.listing_dict(listing)
        return jsonify(payload)
    except GameError as e:
        return _error(str(e))


@game_bp.post("/players/<player_id>/market/<listing_id>/buy")
@require_feature("marketplace")
@require_player
def buy_listing(player_id, listing_id):
    try:
        with session_scope() as s:
            listing = GameService(s).buy_listing(player_id, listing_id)
            if listing.seller_id:
                BadgeService(s).check_all(listing.seller_id)
            payload = S.listing_dict(listing)
        return jsonify(payload)
    except (GameError, InsufficientFundsError) as e:
        return _error(str(e))


# ----- Grower rank, badges & profile summary ----------------------------
@game_bp.get("/players/<player_id>/profile")
@require_player
def player_profile(player_id):
    """Full profile summary: rank, XP progress, specialization badges, medals."""
    try:
        with session_scope() as s:
            player = GameService(s).get_player(player_id)
            level_data = leveling_service.progress(player)
            rank = rank_for_level(level_data["level"])
            badges = BadgeService(s).list_badges(player_id)
            medals = ProgressionService(s).list_achievements(player_id)
        payload = {
            "rank": rank,
            "level": level_data,
            "badges": badges,
            "medals": medals,
        }
        return jsonify(payload)
    except GameError as e:
        return _error(str(e), 404)


# ----- Progression: daily stipend & achievements -------------------------
@game_bp.post("/players/<player_id>/daily")
@require_feature("daily_stipend")
@require_player
@limiter.limit("30 per hour")
def claim_daily(player_id):
    try:
        with session_scope() as s:
            payload = ProgressionService(s).claim_daily(player_id)
        return jsonify(payload), 201
    except GameError as e:
        return _error(str(e))


@game_bp.get("/players/<player_id>/achievements")
@require_player
def list_achievements(player_id):
    with session_scope() as s:
        payload = ProgressionService(s).list_achievements(player_id)
    return jsonify(payload)


@game_bp.post("/players/<player_id>/achievements/<key>/claim")
@require_player
def claim_achievement(player_id, key):
    try:
        with session_scope() as s:
            payload = ProgressionService(s).claim_achievement(player_id, key)
        return jsonify(payload), 201
    except GameError as e:
        return _error(str(e))


# ----- Contracts ---------------------------------------------------------
@game_bp.get("/players/<player_id>/contracts")
@require_feature("contracts")
@require_player
def list_contracts(player_id):
    with session_scope() as s:
        contracts = ContractService(s).list_contracts(player_id, request.args.get("status"))
        payload = [S.contract_dict(c) for c in contracts]
    return jsonify(payload)


@game_bp.post("/players/<player_id>/contracts/offer")
@require_feature("contracts")
@require_player
@limiter.limit("60 per hour")
def offer_contract(player_id):
    # Contract template is drawn with a server-generated RNG seed (no client
    # seed-shopping for the most lucrative contracts).
    try:
        with session_scope() as s:
            contract = ContractService(s).offer(player_id)
            payload = S.contract_dict(contract)
        return jsonify(payload), 201
    except GameError as e:
        return _error(str(e))


@game_bp.post("/players/<player_id>/contracts/<contract_id>/fulfill")
@require_feature("contracts")
@require_player
def fulfill_contract(player_id, contract_id):
    try:
        with session_scope() as s:
            payload = ContractService(s).fulfill(player_id, contract_id)
            BadgeService(s).check_all(player_id)
        return jsonify(payload), 201
    except GameError as e:
        return _error(str(e))


# ----- Seasonal Cannabis Cup --------------------------------------------
@game_bp.get("/cup/current")
@require_feature("cup_competitions")
def cup_current():
    """The current season's Cup (auto-judges any closed window). Public."""
    with session_scope() as s:
        cup = CupService(s).current_cup()
        payload = {"cup": S.cup_dict(cup) if cup else None}
        if cup is not None:
            standings = CupService(s).standings(cup.id, limit=10)
            payload["standings"] = [S.cup_entry_dict(e) for e in standings]
    return jsonify(payload)


@game_bp.get("/cup/<cup_id>/standings")
@require_feature("cup_competitions")
def cup_standings(cup_id):
    try:
        with session_scope() as s:
            entries = CupService(s).standings(cup_id, limit=100)
            payload = [S.cup_entry_dict(e) for e in entries]
        return jsonify(payload)
    except GameError as e:
        return _error(str(e), 404)


@game_bp.get("/cup/hall-of-fame")
@require_feature("cup_competitions")
def cup_hall_of_fame():
    """Every season's champions — the lifetime record. Public."""
    with session_scope() as s:
        payload = CupService(s).hall_of_fame(limit=50)
    return jsonify(payload)


@game_bp.post("/players/<player_id>/cup/enter")
@require_feature("cup_competitions")
@require_player
@limiter.limit("30 per hour")
def cup_enter(player_id):
    data = request.get_json(force=True, silent=True) or {}
    if not data.get("harvest_id"):
        return _error("harvest_id is required")
    try:
        with session_scope() as s:
            payload = CupService(s).enter(player_id, data["harvest_id"])
        return jsonify(payload), 201
    except (GameError, InsufficientFundsError) as e:
        return _error(str(e))


# ----- GrowPod University -------------------------------------------------
@game_bp.get("/university/catalog")
@require_feature("university")
def university_catalog():
    """Public course/degree catalog."""
    with session_scope() as s:
        payload = UniversityService(s).catalog()
    return jsonify(payload)


@game_bp.get("/players/<player_id>/university")
@require_feature("university")
@require_player
def university_transcript(player_id):
    """A player's transcript: courses (status/progress), degrees, and title."""
    try:
        with session_scope() as s:
            payload = UniversityService(s).transcript(player_id)
        return jsonify(payload)
    except GameError as e:
        return _error(str(e), 404)


@game_bp.get("/players/<player_id>/university/progress")
@require_feature("university")
@require_player
def university_progress(player_id):
    """A player's NON-ECONOMIC engagement state (KXP, streak, freeze tokens)
    plus a proactive nudge derived from their transcript."""
    try:
        with session_scope() as s:
            # Ensure the player exists (404 on unknown), matching the other routes.
            GameService(s).get_player(player_id)
            eng = UniversityEngagementService(s)
            payload = eng.progress(player_id)
            payload["next_nudge"] = eng.next_nudge(player_id)
        return jsonify(payload)
    except GameError as e:
        return _error(str(e), 404)


@game_bp.get("/players/<player_id>/university/learner")
@require_feature("university")
@require_player
def university_learner(player_id):
    """A player's CENTRALIZED LEARNER MODEL (Phase 6a): the NON-ECONOMIC profile
    (mastery / misconceptions / risk / prefs) merged with the engagement slice."""
    try:
        with session_scope() as s:
            # Ensure the player exists (404 on unknown), matching the other routes.
            GameService(s).get_player(player_id)
            payload = LearnerModelService(s).profile(player_id)
        return jsonify(payload)
    except GameError as e:
        return _error(str(e), 404)


@game_bp.post("/players/<player_id>/courses/<course_key>/enroll")
@require_feature("university")
@require_player
@limiter.limit("60 per hour")
def university_enroll(player_id, course_key):
    try:
        with session_scope() as s:
            enrollment = UniversityService(s).enroll(player_id, course_key)
            payload = S.enrollment_dict(enrollment)
        return jsonify(payload), 201
    except (GameError, InsufficientFundsError) as e:
        return _error(str(e))


@game_bp.post("/players/<player_id>/courses/<course_key>/complete")
@require_feature("university")
@require_player
def university_complete(player_id, course_key):
    try:
        with session_scope() as s:
            payload = UniversityService(s).complete_course(player_id, course_key)
            BadgeService(s).check_all(player_id)
        return jsonify(payload), 201
    except GameError as e:
        return _error(str(e))


@game_bp.post("/players/<player_id>/degrees/<degree_key>/claim")
@require_feature("university")
@require_player
def university_claim_degree(player_id, degree_key):
    try:
        with session_scope() as s:
            payload = UniversityService(s).claim_degree(player_id, degree_key)
        return jsonify(payload), 201
    except GameError as e:
        return _error(str(e))


@game_bp.get("/university/courses/<course_key>/exams/<exam_id>")
@require_feature("university")
def university_exam(course_key, exam_id):
    """An exam's questions, client-safe (answer keys/feedback stripped server-side).

    Public read like the rest of the catalog; grading happens only on submit.
    """
    from ..services import assessment_service as A

    payload = A.public_exam(course_key, exam_id)
    if not payload:
        return _error(f"No exam '{exam_id}' for course '{course_key}'", 404)
    return jsonify(payload)


@game_bp.post("/players/<player_id>/courses/<course_key>/exams/<exam_id>/submit")
@require_feature("university")
@require_player
@limiter.limit("30 per minute")
def university_exam_submit(player_id, course_key, exam_id):
    """Grade a student's exam responses server-side and return scored feedback.

    The answer keys never leave the server: the client posts ``{responses: {item_id: answer}}``
    and gets back the per-item correctness + authored explanation (post-submit feedback).
    """
    body = request.get_json(silent=True) or {}
    responses = body.get("responses") or {}
    if not isinstance(responses, dict):
        return _error("`responses` must be an object of {item_id: answer}")
    try:
        with session_scope() as s:
            payload = UniversityService(s).submit_exam(
                player_id, course_key, exam_id, responses
            )
            BadgeService(s).check_all(player_id)
        return jsonify(payload), 201
    except GameError as e:
        return _error(str(e), 404 if "no exam" in str(e) else 400)


@game_bp.post("/players/<player_id>/master-grower/ask")
@require_feature("university")
@require_player
@limiter.limit("20 per minute")
def university_master_grower_ask(player_id):
    """Ask the FREE Master Grower bot a grounded cultivation/strain question.

    Body: ``{question: str, plant_id?: str}``. Read-only: the bot may call the
    advisor/strain tools but nothing writes or spends. Answers are grounded
    (cited) or refused (legal/medical, pay-to-win). Returns a MasterGrowerReport.
    """
    from ..services.master_grower_service import MasterGrowerService
    from ..ai.provider import AdvisorError

    body = request.get_json(silent=True) or {}
    question = (body.get("question") or "").strip()
    if not question:
        return _error("`question` is required")
    plant_id = body.get("plant_id") or None
    try:
        with session_scope() as s:
            report = MasterGrowerService(s).ask(
                question, player_id=player_id, plant_id=plant_id
            )
        return jsonify(report.model_dump())
    except AdvisorError as e:
        # Real-provider backend failure (mock never raises) — mirror the
        # lecture route's 503 rather than a generic 500.
        return _error(f"Master Grower unavailable: {e}", 503)


@game_bp.get("/university/admissions/quiz")
@require_feature("university")
def university_admissions_quiz():
    """The Admissions intake quiz definition (public read, like the catalog).

    Returns the deterministic quiz so the client can render the same questions the
    scorer understands. No grading/state — that happens on submit.
    """
    from ..services.admissions_service import AdmissionsService

    with session_scope() as s:
        quiz = AdmissionsService(s).quiz()
    return jsonify({"quiz": quiz})


@game_bp.post("/players/<player_id>/university/admissions")
@require_feature("university")
@require_player
@limiter.limit("20 per minute")
def university_admissions(player_id):
    """Run the Admissions intake quiz and seed the learner model (Phase 6c).

    Body: ``{answers: {question_id: choice_id}}``. NON-ECONOMIC and read-mostly:
    the recommendation is written into the centralized learner model ONLY through
    the audited single writer. Returns ``{recommendation, profile}``.
    """
    from ..services.admissions_service import AdmissionsService

    body = request.get_json(silent=True) or {}
    answers = body.get("answers") or {}
    if not isinstance(answers, dict):
        return _error("`answers` must be an object of {question_id: choice_id}")
    try:
        with session_scope() as s:
            GameService(s).get_player(player_id)
            payload = AdmissionsService(s).run_intake(player_id, answers)
        return jsonify(payload)
    except GameError as e:
        return _error(str(e), 404)


@game_bp.get("/players/<player_id>/university/roadmap")
@require_feature("university")
@require_player
def university_roadmap(player_id):
    """A player's ordered, prerequisite-respecting learning path (Phase 6d).

    READ-ONLY and NON-ECONOMIC: reads the learner model's mastery and returns a
    deterministic plan that skips mastered skills and never schedules a skill
    before its prerequisites. ``?horizon=7|14`` chooses the span (default 7).
    """
    from ..services.roadmap_service import RoadmapService

    horizon = 14 if request.args.get("horizon") == "14" else 7
    try:
        with session_scope() as s:
            GameService(s).get_player(player_id)
            payload = RoadmapService(s).roadmap(player_id, horizon_days=horizon)
        return jsonify(payload)
    except GameError as e:
        return _error(str(e), 404)


@game_bp.get("/players/<player_id>/courses/<course_key>/lecture")
@require_feature("university")
@require_player
@limiter.limit("30 per minute")
def university_lecture(player_id, course_key):
    """The Professor's lecture for a course (AI; deterministic mock in CI)."""
    from ..services.lecturer_service import LecturerService
    from ..ai.provider import AdvisorError

    level = request.args.get("level", "beginner")
    plant_id = request.args.get("plant_id")
    try:
        with session_scope() as s:
            lecturer = LecturerService(s)
            report = lecturer.teach(player_id, course_key, level=level, plant_id=plant_id)
            payload = {"provider": lecturer.provider.name(), **report.model_dump()}

            # PRODUCE-ONCE audio: lecture playback uses the course's canonical
            # narration (static curriculum text, DB/GCS-cached, prewarmed) — one
            # MP3 per course, generated once and saved. We deliberately do NOT
            # narrate the per-delivery AI lecture text: that varied by level /
            # variant / plant context, bypassed the durable cache, and re-billed
            # ElevenLabs on every deploy (2026-07-02 wiring audit, breaks 2+3).
            from ..config import get_settings
            from ..ai.elevenlabs_narrator import is_course_audio_cached
            from ..services.university_service import load_curriculum
            course = load_curriculum().get("courses", {}).get(course_key) or {}
            if get_settings().elevenlabs_api_key or is_course_audio_cached(course, session=s):
                payload["audio_url"] = f"/api/game/university/courses/{course_key}/audio"

        return jsonify(payload)
    except GameError as e:
        return _error(str(e), 404)
    except AdvisorError as e:
        return _error(f"Professor unavailable: {e}", 503)


@game_bp.get("/university/courses/<course_key>/presenter-video")
@require_feature("university")
def university_presenter_video(course_key):
    """The professor 'talking-head' video for a course (deterministic mock in CI).

    Public read like the catalog/audio. Built from the same stable curriculum
    script the narrator hashes, so the video reuses the cached MP3. ``video_url``
    is null on the mock / no HeyGen key — the player falls back to the narration
    audio and renders the returned caption track.
    """
    from ..ai.factory import shared_video_presenter
    from ..ai.elevenlabs_narrator import build_course_spoken_text
    from ..services.university_service import load_curriculum

    course = load_curriculum().get("courses", {}).get(course_key)
    if not course:
        return _error("Course not found", 404)

    presenter = shared_video_presenter()
    context = {
        "spoken_text": build_course_spoken_text(course),
        "department": course.get("department"),
    }
    video = presenter.present(context)
    return jsonify({"provider": presenter.name(), **video.model_dump()})


@game_bp.get("/narration/<course_key>/<level>")
def serve_narration(course_key, level):
    """Serve the cached TTS MP3 for a lecture (no auth — file name is a SHA hash).

    The lecture endpoint embeds the exact content hash (?h=) in the audio_url it
    hands the client. We serve the file named ``{voice_id}_{h}.mp3`` for THIS
    course's department voice, so a request can only ever get audio tied to the
    lecture it was generated for — not "the most recent MP3 sharing this
    department's voice", which previously mixed content across courses/levels.

    ``h`` is validated as a 16-char hex digest and the voice id is derived
    server-side, so neither can be used for path traversal.
    """
    import os
    import re
    from flask import send_file
    from ..ai.elevenlabs_narrator import _CACHE_DIR, _voice_for
    from ..services.university_service import load_curriculum

    curriculum = load_curriculum()
    course = curriculum.get("courses", {}).get(course_key)
    if not course:
        return _error("Course not found", 404)

    voice_id = _voice_for(course.get("department"))

    content_hash = request.args.get("h", "")
    if content_hash:
        if not re.fullmatch(r"[0-9a-f]{16}", content_hash):
            return _error("Invalid audio reference", 400)
        exact = _CACHE_DIR / f"{voice_id}_{content_hash}.mp3"
        if not exact.exists():
            return _error("Audio not yet generated", 404)
        return send_file(str(exact), mimetype="audio/mpeg")

    # Legacy fallback (no hash supplied): serve the most recent file for this
    # voice. Kept only for backward compatibility with any cached client URL;
    # new lecture responses always include ?h=.
    prefix = f"{voice_id}_"
    candidates = sorted(_CACHE_DIR.glob(f"{prefix}*.mp3"), key=os.path.getmtime, reverse=True)
    if not candidates:
        return _error("Audio not yet generated", 404)
    return send_file(str(candidates[0]), mimetype="audio/mpeg")


@game_bp.get("/university/courses/<course_key>/audio")
@require_feature("university")
@limiter.limit("30 per minute")
def university_course_audio(course_key):
    """Generate (or retrieve from DB/cache) and stream the professor's MP3 for a course.

    Returns 204 No Content when no ElevenLabs key is set and no cached audio exists.
    Audio is keyed on the static curriculum text (not the AI-generated lecture) so
    the same MP3 is always returned for the same course, regardless of which lecture
    variant the player last received.

    If the startup prewarm thread is still running, this endpoint waits up to 8 s
    for it to complete so that early requests hit the DB cache instead of making a
    live ElevenLabs call."""
    import logging
    from flask import Response
    from ..services.university_service import load_curriculum
    from ..config import get_settings

    log = logging.getLogger(__name__)

    # When ElevenLabs is configured, wait briefly for the prewarm thread to
    # populate the DB cache so this request doesn't race ahead and trigger a
    # live API call.  No-op (returns immediately) when no key is set because
    # PREWARM_DONE starts in its set state and is only cleared when a prewarm
    # thread is actually started.
    settings = get_settings()
    if settings.elevenlabs_api_key:
        try:
            from .audio_prewarm import wait_for_prewarm
            if not wait_for_prewarm(timeout=8.0):
                log.info(
                    "university_course_audio: prewarm still running after 8 s for %s — "
                    "falling through to on-demand generation",
                    course_key,
                )
        except Exception:
            pass  # Never let an import error block audio serving

    curriculum = load_curriculum()
    course = curriculum.get("courses", {}).get(course_key)
    if not course:
        return _error("Course not found", 404)

    try:
        from ..ai.elevenlabs_narrator import generate_narration_for_course, is_course_audio_cached
        with session_scope() as s:
            cache_hit = is_course_audio_cached(course, session=s)
            mp3 = generate_narration_for_course(
                course,
                api_key=get_settings().elevenlabs_api_key,
                session=s,
            )
    except Exception as exc:
        log.warning("university_course_audio: narration error for %s: %s", course_key, exc)
        return Response(status=204)

    if not mp3:
        return Response(status=204)

    return Response(
        mp3,
        status=200,
        mimetype="audio/mpeg",
        headers={
            "Content-Disposition": f'inline; filename="{course_key}.mp3"',
            "Content-Length": str(len(mp3)),
            "Cache-Control": "public, max-age=86400",
            "X-Audio-Cache-Status": "hit" if cache_hit else "miss",
        },
    )


# ----- Admin: economy ledger summary ------------------------------------

@game_bp.get("/admin/economy/ledger-summary")
@require_admin
def admin_economy_ledger_summary():
    """Trailing-30-day daily ledger aggregates for the Economy dashboard.

    Returns per-day minted/burned/seasonal-sink GC and aggregate projector-
    seeding numbers so the dashboard can replace placeholder sliders with
    values derived from actual player activity.
    """
    from ..services import economy_service
    days = bounded_int(request.args.get("days"), "days", default=30, low=7, high=90)
    with session_scope() as s:
        return jsonify(economy_service.ledger_daily_summary(s, days=days))


# ----- Seasonal Strain Drops ---------------------------------------------

@game_bp.get("/seasonal/strains")
@require_feature("seasonal_strains")
def seasonal_strains_current():
    """List this month's exclusive strain drops. Public."""
    with session_scope() as s:
        payload = SeasonalService(s).current_month_strains()
    return jsonify(payload)


@game_bp.post("/players/<player_id>/seasonal/strains/<seasonal_id>/purchase")
@require_feature("seasonal_strains")
@require_player
@limiter.limit("60 per hour")
def seasonal_strain_purchase(player_id, seasonal_id):
    """Purchase one seed of a seasonal exclusive strain (token sink)."""
    try:
        with session_scope() as s:
            payload = SeasonalService(s).purchase(player_id, seasonal_id)
        return jsonify(payload), 201
    except (GameError, InsufficientFundsError) as e:
        return _error(str(e))


# ----- Admin: seasonal strain management --------------------------------

@game_bp.get("/admin/seasonal/strains")
@require_admin
def admin_seasonal_strains_list():
    """List all seasonal strain entries across all months (admin view)."""
    with session_scope() as s:
        payload = SeasonalService(s).all_seasonal_strains()
    return jsonify({"strains": payload})


@game_bp.post("/admin/seasonal/strains")
@require_admin
def admin_seasonal_strains_upsert():
    """Create or update a seasonal strain entry.

    Body: { strain_id, available_month (YYYY-MM), price_gc, auto_renew? }
    Always returns 201; the response body indicates the current state whether
    the entry was newly created or an existing one was updated.
    """
    data = request.get_json(force=True, silent=True) or {}
    strain_id = data.get("strain_id", "").strip()
    available_month = data.get("available_month", "").strip()
    price_gc = data.get("price_gc")
    auto_renew = bool(data.get("auto_renew", False))

    if not strain_id:
        return _error("strain_id is required")
    if not available_month or len(available_month) != 7 or available_month[4] != "-":
        return _error("available_month must be YYYY-MM")
    if price_gc is None:
        return _error("price_gc is required")
    try:
        price_gc = positive_money(price_gc, "price_gc")
    except GameError as e:
        return _error(str(e))

    try:
        with session_scope() as s:
            payload = SeasonalService(s).upsert(
                strain_id=strain_id,
                available_month=available_month,
                price_gc=price_gc,
                auto_renew=auto_renew,
            )
        return jsonify(payload), 201
    except GameError as e:
        return _error(str(e))


@game_bp.delete("/admin/seasonal/strains/<seasonal_id>")
@require_admin
def admin_seasonal_strains_delete(seasonal_id):
    """Remove a seasonal strain entry."""
    try:
        with session_scope() as s:
            SeasonalService(s).delete(seasonal_id)
        from flask import Response
        return Response(status=204)
    except GameError as e:
        return _error(str(e), 404)


@game_bp.post("/admin/seasonal/strains/rollover")
@require_admin
def admin_seasonal_strains_rollover():
    """Manually trigger the auto-renew rollover for the current month.

    The same rollover also runs automatically at startup and once per month
    via the background scheduler (see flask_api.py: start_seasonal_rollover).
    """
    with session_scope() as s:
        created = SeasonalService(s).rollover_renewals()
    return jsonify({"created": created, "count": len(created)})


# ----- On-chain: wallet linking, NFT minting, metadata -------------------
@game_bp.post("/players/<player_id>/wallet/link")
@require_feature("chain")
@require_player
def link_wallet(player_id):
    data = request.get_json(force=True, silent=True) or {}
    if not data.get("address"):
        return _error("address is required")
    try:
        with session_scope() as s:
            player = GameService(s).link_wallet(player_id, data["address"])
            payload = S.player_dict(player)
        return jsonify(payload)
    except GameError as e:
        return _error(str(e))


@game_bp.post("/players/<player_id>/wallet/unlink")
@require_feature("chain")
@require_player
def unlink_wallet(player_id):
    """Disconnect ("log out") the player's linked Algorand wallet."""
    try:
        with session_scope() as s:
            player = GameService(s).unlink_wallet(player_id)
            payload = S.player_dict(player)
        return jsonify(payload)
    except GameError as e:
        return _error(str(e))


@game_bp.post("/players/<player_id>/wallet/withdraw")
@require_feature("chain")
@require_player
def asa_withdraw(player_id):
    data = request.get_json(force=True, silent=True) or {}
    if data.get("amount") is None:
        return _error("amount is required")
    try:
        amount = positive_money(data.get("amount"), "amount")
        with session_scope() as s:
            payload = SettlementService(s).withdraw(player_id, amount)
        return jsonify(payload), 201
    except (GameError, InsufficientFundsError) as e:
        return _error(str(e))


@game_bp.post("/players/<player_id>/wallet/deposit")
@require_feature("chain")
@require_player
def asa_deposit(player_id):
    data = request.get_json(force=True, silent=True) or {}
    if data.get("amount") is None:
        return _error("amount is required")
    try:
        amount = positive_money(data.get("amount"), "amount")
        with session_scope() as s:
            payload = SettlementService(s).deposit(player_id, amount)
        return jsonify(payload), 201
    except (GameError, InsufficientFundsError) as e:
        return _error(str(e))


# ----- Store: partners, featured items, bundles --------------------------

@game_bp.get("/store/partners")
def store_partners():
    from ..db.models import StorePartner, Strain
    from ..economy.config import get_economy_config as _cfg
    with session_scope() as s:
        partners = (
            s.query(StorePartner)
            .filter(StorePartner.active.is_(True))
            .order_by(StorePartner.display_order)
            .all()
        )
        out = []
        for p in partners:
            product_name = p.product_id
            if p.product_type == "strain":
                strain = s.get(Strain, p.product_id)
                if strain:
                    product_name = strain.name
            elif p.product_type == "consumable":
                item = _cfg().shop_consumables.get(p.product_id)
                if item:
                    product_name = item.get("name", p.product_id)
            out.append({
                "id": p.id,
                "name": p.name,
                "logo_url": p.logo_url,
                "tagline": p.tagline,
                "product_type": p.product_type,
                "product_id": p.product_id,
                "product_name": product_name,
                "price_gc": float(p.price_gc),
                "display_order": p.display_order,
            })
    return jsonify(out)


@game_bp.get("/admin/store/partners")
@require_admin
def admin_list_partners():
    """Admin-only list returning ALL partners (active and inactive) for management."""
    from ..db.models import StorePartner, Strain
    from ..economy.config import get_economy_config as _cfg
    with session_scope() as s:
        partners = (
            s.query(StorePartner)
            .order_by(StorePartner.display_order, StorePartner.created_at)
            .all()
        )
        out = []
        for p in partners:
            product_name = p.product_id
            if p.product_type == "strain":
                strain = s.get(Strain, p.product_id)
                if strain:
                    product_name = strain.name
            elif p.product_type == "consumable":
                item = _cfg().shop_consumables.get(p.product_id)
                if item:
                    product_name = item.get("name", p.product_id)
            out.append({
                "id": p.id, "name": p.name, "logo_url": p.logo_url,
                "tagline": p.tagline, "product_type": p.product_type,
                "product_id": p.product_id, "product_name": product_name,
                "price_gc": float(p.price_gc), "display_order": p.display_order,
                "active": p.active,
            })
    return jsonify(out)


@game_bp.post("/admin/store/partners")
@require_admin
def admin_add_partner():
    from ..db.models import StorePartner
    from decimal import Decimal as _Dec
    data = request.get_json(force=True, silent=True) or {}
    for f in ["name", "logo_url", "tagline", "product_type", "product_id", "price_gc"]:
        if not data.get(f) and data.get(f) != 0:
            return _error(f"{f} is required")
    if data["product_type"] not in ("strain", "consumable"):
        return _error("product_type must be 'strain' or 'consumable'")
    with session_scope() as s:
        p = StorePartner(
            name=str(data["name"])[:128],
            logo_url=str(data["logo_url"])[:512],
            tagline=str(data["tagline"])[:60],
            product_type=data["product_type"],
            product_id=str(data["product_id"])[:64],
            price_gc=_Dec(str(data["price_gc"])),
            active=True,
            display_order=int(data.get("display_order", 0)),
        )
        s.add(p)
        s.flush()
        out = {k: getattr(p, k) for k in ("id", "name", "logo_url", "tagline", "product_type", "product_id", "display_order", "active")}
        out["price_gc"] = float(p.price_gc)
    return jsonify(out), 201


@game_bp.patch("/admin/store/partners/<partner_id>")
@require_admin
def admin_update_partner(partner_id):
    """Toggle active flag or update fields on a partner."""
    from ..db.models import StorePartner
    from decimal import Decimal as _Dec
    data = request.get_json(force=True, silent=True) or {}
    with session_scope() as s:
        p = s.get(StorePartner, partner_id)
        if p is None:
            return _error("Partner not found", 404)
        if "active" in data:
            p.active = bool(data["active"])
        if "display_order" in data:
            p.display_order = int(data["display_order"])
        if "price_gc" in data:
            p.price_gc = _Dec(str(data["price_gc"]))
        if "tagline" in data:
            p.tagline = str(data["tagline"])[:60]
        out = {k: getattr(p, k) for k in ("id", "name", "logo_url", "tagline", "product_type", "product_id", "display_order", "active")}
        out["price_gc"] = float(p.price_gc)
    return jsonify(out)


@game_bp.delete("/admin/store/partners/<partner_id>")
@require_admin
def admin_delete_partner(partner_id):
    from ..db.models import StorePartner
    with session_scope() as s:
        p = s.get(StorePartner, partner_id)
        if p is None:
            return _error("Partner not found", 404)
        s.delete(p)
    return jsonify({"deleted": True})


@game_bp.get("/store/featured")
def store_featured():
    """Return up to 3 active, non-expired featured shelf items, enriched with price info."""
    from ..db.models import FeaturedItem, Strain
    from ..economy.config import get_economy_config as _cfg
    from datetime import datetime as _dt
    cfg = _cfg()
    now = _dt.utcnow()
    with session_scope() as s:
        items = (
            s.query(FeaturedItem)
            .filter(FeaturedItem.active.is_(True))
            .order_by(FeaturedItem.created_at.asc())
            .all()
        )
        # Enforce expiry; cap display to 3
        valid_items = [
            f for f in items
            if f.valid_through is None or f.valid_through > now
        ][:3]
        out = []
        for f in valid_items:
            price = None
            name = f.item_id
            if f.item_type == "consumable":
                item_cfg = cfg.shop_consumables.get(f.item_id) or {}
                price = float(item_cfg.get("cost", 0)) if item_cfg else None
                name = item_cfg.get("name", f.item_id)
            elif f.item_type == "strain":
                strain = s.get(Strain, f.item_id)
                name = strain.name if strain else f.item_id
            out.append({
                "id": f.id,
                "item_type": f.item_type,
                "item_id": f.item_id,
                "label": f.label,
                "badge": f.badge,
                "valid_through": f.valid_through.isoformat() if f.valid_through else None,
                "price_gc": price,
                "product_name": name,
            })
    return jsonify(out)


@game_bp.post("/admin/store/featured")
@require_admin
def admin_add_featured():
    from ..db.models import FeaturedItem
    from datetime import datetime as _dt
    data = request.get_json(force=True, silent=True) or {}
    for f in ["item_type", "item_id", "label"]:
        if not data.get(f):
            return _error(f"{f} is required")
    with session_scope() as s:
        # Enforce 3-item cap
        now = _dt.utcnow()
        active_count = (
            s.query(FeaturedItem)
            .filter(
                FeaturedItem.active.is_(True),
                (FeaturedItem.valid_through.is_(None)) | (FeaturedItem.valid_through > now),
            )
            .count()
        )
        if active_count >= 3:
            return _error("Featured shelf is full (3/3). Unpin an item before adding another.", 409)
        vt = None
        if data.get("valid_through"):
            try:
                vt = _dt.fromisoformat(data["valid_through"])
            except ValueError:
                return _error("valid_through must be ISO datetime")
        item = FeaturedItem(
            item_type=str(data["item_type"])[:16],
            item_id=str(data["item_id"])[:64],
            label=str(data["label"])[:128],
            badge=str(data.get("badge", "limited"))[:16],
            active=True,
            valid_through=vt,
        )
        s.add(item)
        s.flush()
        out = {"id": item.id, "item_type": item.item_type, "item_id": item.item_id,
               "label": item.label, "badge": item.badge,
               "valid_through": item.valid_through.isoformat() if item.valid_through else None}
    return jsonify(out), 201


@game_bp.delete("/admin/store/featured/<item_id>")
@require_admin
def admin_delete_featured(item_id):
    from ..db.models import FeaturedItem
    with session_scope() as s:
        item = s.get(FeaturedItem, item_id)
        if item is None:
            return _error("Featured item not found", 404)
        s.delete(item)
    return jsonify({"deleted": True})


@game_bp.get("/store/bundles")
def store_bundles():
    from ..db.models import Bundle
    from ..economy.config import get_economy_config as _cfg
    cfg = _cfg()
    with session_scope() as s:
        bundles = s.query(Bundle).filter(Bundle.active.is_(True)).all()
        out = []
        for b in bundles:
            full_price = 0.0
            enriched = []
            for comp in (b.components or []):
                key = comp.get("key", "")
                qty = int(comp.get("qty", 1))
                item_cfg = cfg.shop_consumables.get(key) or {}
                cost = float(item_cfg.get("cost", 0)) * qty
                full_price += cost
                enriched.append({**comp, "name": item_cfg.get("name", key), "cost": cost})
            bundle_price = round(full_price * (1 - float(b.discount_pct)), 2)
            out.append({"id": b.id, "name": b.name, "description": b.description,
                        "discount_pct": float(b.discount_pct), "components": enriched,
                        "full_price": full_price, "bundle_price": bundle_price, "active": b.active})
    return jsonify(out)


@game_bp.post("/players/<player_id>/store/bundles/<bundle_id>/purchase")
@require_player
def purchase_bundle(player_id, bundle_id):
    from ..db.models import Bundle, ConsumableInventory, SeedInventory, Strain
    from ..economy.ledger import post as _post
    from ..economy.config import get_economy_config as _cfg
    from ..enums import LedgerEntryType
    from decimal import Decimal as _Dec
    try:
        with session_scope() as s:
            b = s.get(Bundle, bundle_id)
            if b is None or not b.active:
                return _error("Bundle not found or inactive", 404)
            cfg = _cfg()
            # Compute full price across consumable + strain components
            full_price = 0.0
            for c in (b.components or []):
                ctype = c.get("type", "consumable")
                qty = int(c.get("qty", 1))
                if ctype == "consumable":
                    full_price += float((cfg.shop_consumables.get(c.get("key", "")) or {}).get("cost", 0)) * qty
                elif ctype == "strain":
                    # Strain component: use the strain's catalog seed price
                    strain_id = c.get("strain_id", "")
                    if strain_id:
                        strain = s.get(Strain, strain_id)
                        if strain:
                            from ..economy import pricing as _pricing
                            try:
                                full_price += float(_pricing.seed_price(strain.rarity, cfg)) * qty
                            except Exception:
                                full_price += 0.0
            bundle_price = _Dec(str(round(full_price * (1 - float(b.discount_pct)), 6)))
            _post(s, player_id, -bundle_price, LedgerEntryType.SHOP_PURCHASE,
                  ref_type="bundle", ref_id=bundle_id)
            # Deliver components
            items_delivered = []
            for comp in (b.components or []):
                ctype = comp.get("type", "consumable")
                qty = int(comp.get("qty", 1))
                if qty < 1:
                    continue
                if ctype == "consumable":
                    key = comp.get("key", "")
                    if not key:
                        continue
                    stack = (s.query(ConsumableInventory)
                             .filter(ConsumableInventory.player_id == player_id,
                                     ConsumableInventory.item_key == key)
                             .one_or_none())
                    if stack is None:
                        stack = ConsumableInventory(player_id=player_id, item_key=key, quantity=0)
                        s.add(stack)
                        s.flush()
                    stack.quantity += qty
                    items_delivered.append({"type": "consumable", "key": key, "qty": qty})
                elif ctype == "strain":
                    strain_id = comp.get("strain_id", "")
                    if not strain_id:
                        continue
                    seed_stack = (s.query(SeedInventory)
                                  .filter(SeedInventory.player_id == player_id,
                                          SeedInventory.strain_id == strain_id)
                                  .one_or_none())
                    if seed_stack is None:
                        seed_stack = SeedInventory(player_id=player_id, strain_id=strain_id,
                                                   quantity=0, source="bundle")
                        s.add(seed_stack)
                        s.flush()
                    seed_stack.quantity += qty
                    items_delivered.append({"type": "strain", "strain_id": strain_id, "qty": qty})
        return jsonify({"purchased": b.name, "items_delivered": items_delivered}), 201
    except InsufficientFundsError as e:
        return _error(str(e))
    except GameError as e:
        return _error(str(e))


@game_bp.post("/players/<player_id>/store/partners/<partner_id>/purchase")
@require_player
def purchase_partner_product(player_id, partner_id):
    from ..db.models import StorePartner, ConsumableInventory, SeedInventory
    from ..economy.ledger import post as _post
    from ..enums import LedgerEntryType
    try:
        with session_scope() as s:
            p = s.get(StorePartner, partner_id)
            if p is None or not p.active:
                return _error("Partner not found or inactive", 404)
            _post(s, player_id, -p.price_gc, LedgerEntryType.SHOP_PURCHASE,
                  ref_type="partner_product", ref_id=partner_id)
            if p.product_type == "consumable":
                stack = (s.query(ConsumableInventory)
                         .filter(ConsumableInventory.player_id == player_id,
                                 ConsumableInventory.item_key == p.product_id)
                         .one_or_none())
                if stack is None:
                    stack = ConsumableInventory(player_id=player_id, item_key=p.product_id, quantity=0)
                    s.add(stack)
                    s.flush()
                stack.quantity += 1
            elif p.product_type == "strain":
                seed_stack = (s.query(SeedInventory)
                              .filter(SeedInventory.player_id == player_id,
                                      SeedInventory.strain_id == p.product_id)
                              .one_or_none())
                if seed_stack is None:
                    seed_stack = SeedInventory(player_id=player_id, strain_id=p.product_id,
                                               quantity=0, source="partner")
                    s.add(seed_stack)
                    s.flush()
                seed_stack.quantity += 1
        return jsonify({"purchased": p.name, "product_type": p.product_type, "product_id": p.product_id}), 201
    except InsufficientFundsError as e:
        return _error(str(e))
    except GameError as e:
        return _error(str(e))


# ----- Store: grow-room gear (lights/fans/soils) -------------------------
@game_bp.get("/players/<player_id>/store/gear")
@require_player
def list_gear(player_id):
    """Gear catalog merged with the player's owned counts + equipped state."""
    try:
        with session_scope() as s:
            items = GameService(s).list_gear(player_id)
        return jsonify(items)
    except GameError as e:
        return _error(str(e), 404)


@game_bp.post("/players/<player_id>/store/gear/<gear_key>/purchase")
@require_player
def purchase_gear(player_id, gear_key):
    data = request.get_json(force=True, silent=True) or {}
    qty = bounded_int(data.get("quantity", 1), "quantity", default=1, low=1, high=99)
    try:
        with session_scope() as s:
            svc = GameService(s)
            svc.buy_gear(player_id, gear_key, qty)
            items = svc.list_gear(player_id)
        return jsonify(items), 201
    except (GameError, InsufficientFundsError) as e:
        return _error(str(e))


@game_bp.post("/players/<player_id>/pods/<pod_id>/equip-light")
@require_player
def equip_light(player_id, pod_id):
    data = request.get_json(force=True, silent=True) or {}
    gear_key = data.get("gear_key")
    if not gear_key:
        return _error("gear_key is required")
    try:
        with session_scope() as s:
            pod = GameService(s).equip_light(player_id, pod_id, gear_key)
            payload = S.pod_dict(pod)
        return jsonify(payload)
    except (GameError, InsufficientFundsError) as e:
        return _error(str(e))


@game_bp.post("/players/<player_id>/pods/<pod_id>/equip-fan")
@require_player
def equip_fan(player_id, pod_id):
    data = request.get_json(force=True, silent=True) or {}
    gear_key = data.get("gear_key")
    if not gear_key:
        return _error("gear_key is required")
    try:
        with session_scope() as s:
            pod = GameService(s).equip_fan(player_id, pod_id, gear_key)
            payload = S.pod_dict(pod)
        return jsonify(payload)
    except (GameError, InsufficientFundsError) as e:
        return _error(str(e))


@game_bp.post("/players/<player_id>/store/gear/<gear_key>/service")
@require_player
def service_gear(player_id, gear_key):
    try:
        with session_scope() as s:
            svc = GameService(s)
            svc.service_gear(player_id, gear_key)
            items = svc.list_gear(player_id)
        return jsonify(items)
    except (GameError, InsufficientFundsError) as e:
        return _error(str(e))


@game_bp.post("/players/<player_id>/store/gear/<gear_key>/sell")
@require_player
def sell_gear(player_id, gear_key):
    data = request.get_json(force=True, silent=True) or {}
    qty = bounded_int(data.get("quantity", 1), "quantity", default=1, low=1, high=99)
    try:
        with session_scope() as s:
            svc = GameService(s)
            proceeds = svc.sell_gear(player_id, gear_key, qty)
            items = svc.list_gear(player_id)
        return jsonify({"proceeds": proceeds, "gear": items})
    except (GameError, InsufficientFundsError) as e:
        return _error(str(e))


@game_bp.post("/players/<player_id>/harvests/<harvest_id>/mint")
@require_feature("chain")
@require_player
def mint_harvest(player_id, harvest_id):
    try:
        with session_scope() as s:
            harvest = MintingService(s).mint_harvest(player_id, harvest_id)
            BadgeService(s).check_all(player_id)
            payload = S.harvest_dict(harvest)
        return jsonify(payload), 201
    except GameError as e:
        return _error(str(e))


@game_bp.post("/players/<player_id>/strains/<strain_id>/mint")
@require_feature("chain")
@require_player
def mint_strain(player_id, strain_id):
    try:
        with session_scope() as s:
            strain = MintingService(s).mint_strain(player_id, strain_id)
            payload = S.strain_dict(strain)
        return jsonify(payload), 201
    except GameError as e:
        return _error(str(e))


@game_bp.get("/nft/<kind>/<obj_id>.json")
@require_feature("chain")
def nft_metadata(kind, obj_id):
    """Serve ARC-3 metadata JSON referenced by a minted asset's URL."""
    try:
        with session_scope() as s:
            payload = MintingService(s).metadata_for(kind, obj_id)
        return jsonify(payload)
    except GameError as e:
        return _error(str(e), 404)
