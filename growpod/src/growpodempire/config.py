"""
Environment-driven configuration for GrowPodEmpire.

Reads from process env (and a local .env via python-dotenv) so the same code
runs against SQLite locally/in tests and Postgres on Render. No secrets are
hardcoded here.
"""

import os
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()  # no-op if .env is absent

# Package root, used to locate bundled data files (balance / strain catalog).
PACKAGE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(PACKAGE_DIR, "data")


class Settings:
    """Lightweight settings object sourced from environment variables."""

    def __init__(self) -> None:
        # Default to a local SQLite file; Render injects a Postgres DATABASE_URL.
        self.database_url: str = os.environ.get(
            "DATABASE_URL", "sqlite:///growpod.db"
        )
        # SQLAlchemy historically used the "postgres://" scheme; normalise it.
        if self.database_url.startswith("postgres://"):
            self.database_url = self.database_url.replace(
                "postgres://", "postgresql://", 1
            )

        self.balance_file: str = os.environ.get(
            "BALANCE_FILE", os.path.join(DATA_DIR, "balance.yaml")
        )
        self.strains_file: str = os.environ.get(
            "STRAINS_FILE", os.path.join(DATA_DIR, "strains.yaml")
        )
        self.strain_knowledge_file: str = os.environ.get(
            "STRAIN_KNOWLEDGE_FILE", os.path.join(DATA_DIR, "strain_knowledge.yaml")
        )
        self.curriculum_file: str = os.environ.get(
            "CURRICULUM_FILE", os.path.join(DATA_DIR, "curriculum.yaml")
        )
        self.terpene_effects_file: str = os.environ.get(
            "TERPENE_EFFECTS_FILE", os.path.join(DATA_DIR, "terpene_effects.yaml")
        )

        # Optional global RNG seed for reproducible breeding in deterministic
        # contexts (tests / demos). When None, breeding draws a fresh seed.
        seed = os.environ.get("RNG_SEED")
        self.rng_seed = int(seed) if seed not in (None, "") else None

        self.sql_echo: bool = os.environ.get("SQL_ECHO", "false").lower() == "true"

        # --- Deployment environment ---------------------------------------
        # Names the running environment. "production"/"prod" hard-disables every
        # dev-only affordance (currently the simulation test clock below),
        # regardless of any other flag. Defaults to "development" so local runs
        # and CI stay unlocked without extra config.
        self.app_env: str = os.environ.get("APP_ENV", "development").strip().lower()
        self.is_production: bool = self.app_env in {"production", "prod"}

        # --- Simulation test clock (DEV/TEST ONLY) ------------------------
        # A controllable clock that lets developers/testers fast-forward grow
        # time without touching the economy or real players. OFF by default and
        # FORCE-DISABLED in production: enabling it requires GROW_TEST_CLOCK=true
        # AND a non-production APP_ENV. When on, it registers the /api/dev/clock
        # endpoints and makes the engine read an advanceable offset clock.
        _test_clock_requested = (
            os.environ.get("GROW_TEST_CLOCK", "false").strip().lower() == "true"
        )
        self.test_clock_enabled: bool = _test_clock_requested and not self.is_production

        # --- Security / hardening -----------------------------------------
        # Allowed browser origins for CORS. Comma-separated; defaults to the
        # local web dev server. Set to the deployed web origin in production.
        # "*" is honoured but strongly discouraged (kept only as an escape hatch).
        self.cors_allowed_origins: list[str] = [
            o.strip()
            for o in os.environ.get(
                "CORS_ALLOWED_ORIGINS", "http://localhost:3000"
            ).split(",")
            if o.strip()
        ]
        # Rate limiting: in-memory by default; point at Redis in production so
        # limits hold across multiple workers/instances.
        self.ratelimit_enabled: bool = (
            os.environ.get("RATELIMIT_ENABLED", "true").lower() == "true"
        )
        self.ratelimit_storage_uri: str = os.environ.get(
            "RATELIMIT_STORAGE_URI", "memory://"
        )
        self.ratelimit_default: str = os.environ.get(
            "RATELIMIT_DEFAULT", "240 per minute"
        )
        # Cap on-chain withdrawals per player per rolling 24h (defence in depth
        # around the treasury). 0 disables the cap.
        wd_cap = os.environ.get("MAX_WITHDRAWAL_PER_DAY", "10000")
        self.max_withdrawal_per_day = wd_cap if wd_cap not in (None, "") else "0"

        # --- Algorand on-chain layer (Phase 3) -----------------------------
        # Default to TestNet via AlgoNode. The treasury mnemonic is a SECRET and
        # must be supplied via the host's secret store, never committed.
        self.algorand_network: str = os.environ.get("ALGORAND_NETWORK", "testnet")
        self.algod_url: str = os.environ.get(
            "ALGOD_URL", "https://testnet-api.algonode.cloud"
        )
        self.algod_token: str = os.environ.get("ALGOD_TOKEN", "")
        self.indexer_url: str = os.environ.get(
            "INDEXER_URL", "https://testnet-idx.algonode.cloud"
        )
        self.algo_treasury_mnemonic = os.environ.get("ALGO_TREASURY_MNEMONIC")
        asa = os.environ.get("ASA_ID")
        self.asa_id = int(asa) if asa not in (None, "") else None
        self.nft_metadata_base_url: str = os.environ.get("NFT_METADATA_BASE_URL", "")
        # Force the offline mock chain even if a treasury is configured (tests/dev).
        self.use_mock_chain: bool = (
            os.environ.get("USE_MOCK_CHAIN", "false").lower() == "true"
        )

        # --- AI "Master Grower" advisor (greenfield) -----------------------
        # The advisor reads a plant's live state and returns diagnosis + care
        # recommendations. ANTHROPIC_API_KEY is a SECRET (host secret store
        # only). With no key configured (or USE_MOCK_AI=true), an offline
        # deterministic mock advisor is used, so the app and tests need no key.
        self.anthropic_api_key = os.environ.get("ANTHROPIC_API_KEY")
        self.advisor_model: str = os.environ.get("ADVISOR_MODEL", "claude-opus-4-8")
        self.use_mock_ai: bool = (
            os.environ.get("USE_MOCK_AI", "false").lower() == "true"
        )
        # Agentic auto-care lets the advisor CALL care actions itself (spending
        # in-game GROW within a per-invocation budget cap). On by default — the
        # budget/action caps are the guardrail — but can be disabled outright.
        self.enable_auto_care: bool = (
            os.environ.get("ENABLE_AUTO_CARE", "true").lower() == "true"
        )

        # NOTE: Feature flags are NOT defined here. The single source of truth is
        # balance.yaml `feature_flags:` (data-driven, per the tuning-surface
        # convention), resolved by growpodempire.feature_flags with per-env
        # `FEATURE_<NAME>` overrides. See that module + GET /api/game/flags.


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a cached Settings instance."""
    return Settings()
