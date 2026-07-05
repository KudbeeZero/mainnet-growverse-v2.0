"""
Flask API for GROWv2
RESTful API endpoints for the cultivation game.
"""

from flask import Flask, jsonify
from flask_cors import CORS
from werkzeug.middleware.proxy_fix import ProxyFix

from .. import __version__
from ..config import get_settings
from ..db.session import init_db
from .game_api import game_bp
from .chain_api import chain_bp
from .errors import register_error_handlers
from .observability import register_observability
from .openapi import register_openapi
from .ratelimit import init_limiter


def create_app(init_database: bool = True):
    """Create and configure Flask application"""
    app = Flask(__name__)
    settings = get_settings()

    # Trust `settings.proxy_trusted_hops` reverse-proxy hops for X-Forwarded-For/
    # -Proto so client IPs (used for rate limiting + logging) and scheme are
    # accurate. Was hardcoded to 1 (correct for the old Render-only topology);
    # now configurable via PROXY_TRUSTED_HOPS since the deploy moved to a
    # Vercel-rewrite -> Fly two-hop topology (security audit 2026-07-05) — the
    # right value needs live verification against the actual XFF chain before
    # changing the default, so this defaults to the old value (1) unchanged.
    app.wsgi_app = ProxyFix(
        app.wsgi_app, x_for=settings.proxy_trusted_hops, x_proto=1
    )

    # Restrict CORS to an explicit origin allowlist (no wildcard by default) and
    # only on the API surface. Allow the X-API-Key header used for auth.
    CORS(
        app,
        resources={r"/api/*": {"origins": settings.cors_allowed_origins}},
        allow_headers=["Content-Type", "X-API-Key"],
        methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        max_age=3600,
    )

    # Rate limiting (brute-force / spam protection), keyed by client IP.
    app.config["RATELIMIT_ENABLED"] = settings.ratelimit_enabled
    app.config["RATELIMIT_STORAGE_URI"] = settings.ratelimit_storage_uri
    init_limiter(app)

    # Feature flags are resolved data-driven from balance.yaml `feature_flags:`
    # (growpodempire.feature_flags), with per-env `FEATURE_<NAME>` overrides — no
    # app.config mirror needed. Gated routes use the `feature_required` decorator;
    # GET /api/game/flags serves the resolved map.

    # Ensure the persistent game schema exists (no-op for already-migrated DBs).
    if init_database:
        init_db()

    # Consistent JSON error responses + request-size cap.
    register_error_handlers(app)

    # Health/readiness probes + per-request logging.
    register_observability(app)

    # Self-describing API docs: /openapi.json + Swagger UI at /docs.
    register_openapi(app)

    # DB-backed game layer (players, economy, strains, breeding, market).
    app.register_blueprint(game_bp)

    # Internal chain helpers (seed minting) called by the TS api-server.
    app.register_blueprint(chain_bp)

    # Monthly auto-rollover: carry forward all auto_renew seasonal strains into
    # the next calendar month.  Runs immediately at startup (catches any missed
    # boundary) and then sleeps until the 1st of each subsequent month.
    from .seasonal_rollover import start_rollover_thread
    start_rollover_thread()

    # Pre-warm ElevenLabs audio for all curriculum courses in the background
    # so the first player request always hits the DB cache instead of waiting
    # on a live API call.  Only runs when ELEVENLABS_API_KEY is set.
    if settings.elevenlabs_api_key:
        from .audio_prewarm import start_prewarm_thread
        start_prewarm_thread()

    # DEV/TEST ONLY: the simulation test clock (/api/dev/clock/*). Registered
    # only when explicitly enabled on a non-production environment, so it can
    # never exist on a live deployment.
    if settings.test_clock_enabled:
        from .dev_api import dev_bp
        app.register_blueprint(dev_bp)

    @app.route('/')
    def index():
        """API root endpoint"""
        return jsonify({
            "name": "GROWv2 API",
            "version": __version__,
            "description": "Cannabis cultivation game: economy, genetics, real-time sim & on-chain assets",
            "endpoints": {
                "game": "/api/game",
                "docs": "/docs",
            }
        })

    return app


if __name__ == '__main__':
    import os
    app = create_app()
    # Only enable debug mode if explicitly set in environment
    debug_mode = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'
    app.run(debug=debug_mode, host='0.0.0.0', port=5000)
