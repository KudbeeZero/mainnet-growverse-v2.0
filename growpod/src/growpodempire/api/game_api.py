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
from ..services.seasonal_service import SeasonalService
from ..services.research_service import ResearchService
from ..services import leveling_service
from ..services.badge_service import BadgeService, rank_for_level
from ..economy.ledger import InsufficientFundsError
from ..feature_flags import all_flags, FeatureDisabledError, feature_required as require_feature
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
                player_id, data["seed_id"], data["pod_id"]
            )
            payload = S.plant_dict(plant)
        return jsonify(payload), 201
    except GameError as e:
        return _error(str(e))


# ----- Breeding ----------------------------------------------------------
@game_bp.post("/players/<player_id>/breed")
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
            payload["recent_events"] = [S.event_dict(e) for e in events]
        return jsonify(payload)
    except GameError as e:
        return _error(str(e), 404)


@game_bp.get("/players/<player_id>/plants/<plant_id>/advisor")
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


@game_bp.post("/players/<player_id>/plants/<plant_id>/water")
@require_player
def water_plant(player_id, plant_id):
    data = request.get_json(force=True, silent=True) or {}
    return _care_action(player_id, plant_id, "water", amount=data.get("amount"))


@game_bp.post("/players/<player_id>/plants/<plant_id>/feed")
@require_player
def feed_plant(player_id, plant_id):
    data = request.get_json(force=True, silent=True) or {}
    return _care_action(player_id, plant_id, "feed", amount=data.get("amount"))


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

        # Optionally generate / serve cached TTS audio (no-op if key not set).
        from ..config import get_settings
        from ..ai.elevenlabs_narrator import generate_narration
        from ..services.university_service import load_curriculum
        dept = (load_curriculum().get("courses", {}).get(course_key) or {}).get("department")
        audio_path = generate_narration(payload, department=dept,
                                        api_key=get_settings().elevenlabs_api_key)
        if audio_path:
            payload["audio_url"] = f"/api/game/narration/{course_key}/{level}"

        return jsonify(payload)
    except GameError as e:
        return _error(str(e), 404)
    except AdvisorError as e:
        return _error(f"Professor unavailable: {e}", 503)


@game_bp.get("/narration/<course_key>/<level>")
def serve_narration(course_key, level):
    """Serve the cached TTS MP3 for a lecture (no auth — file name is a SHA hash)."""
    import os
    from flask import send_file
    from ..ai.elevenlabs_narrator import _CACHE_DIR, _voice_for, _build_spoken_text
    from ..services.university_service import load_curriculum
    import hashlib

    curriculum = load_curriculum()
    course = curriculum.get("courses", {}).get(course_key)
    if not course:
        return _error("Course not found", 404)

    dept = course.get("department")
    voice_id = _voice_for(dept)

    # Re-derive the cache key the same way generate_narration does.
    # We don't have the full LectureReport here, so we serve the first cached file
    # matching the voice prefix for this course_key+level combo.
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
        from ..ai.elevenlabs_narrator import generate_narration_for_course
        with session_scope() as s:
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
