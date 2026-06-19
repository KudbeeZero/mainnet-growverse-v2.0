"""
Shared rate limiter (Flask-Limiter).

A single `limiter` instance is created here and initialised in the app factory.
Routes import it to attach tighter, per-endpoint limits (e.g. faucet/auth
routes). Requests are keyed by API key when present (so a single account can't
spread abuse across IPs) and fall back to the client IP otherwise.

Defaults to in-memory storage for dev/test; set RATELIMIT_STORAGE_URI to a Redis
URL in production so limits hold across workers.
"""

from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

from ..config import get_settings


def _rate_key() -> str:
    # Key by client IP. We deliberately do NOT key by the supplied API key:
    # a brute-forcer varies the guessed key on every request, which would give
    # each guess its own bucket and defeat the limit. IP keying caps brute-force
    # and spam per source. (ProxyFix makes remote_addr reflect the real client
    # IP behind Render's proxy.)
    return get_remote_address()


# A single global default limit applied to every route; per-route decorators add
# tighter caps. The limit string is resolved lazily so env changes are honoured.
limiter = Limiter(
    key_func=_rate_key,
    default_limits=[lambda: get_settings().ratelimit_default],
)


def init_limiter(app) -> None:
    """Configure and attach the shared limiter to `app` from its config."""
    if not app.config.get("RATELIMIT_ENABLED", True):
        return
    settings = get_settings()
    storage_uri = app.config.get(
        "RATELIMIT_STORAGE_URI", settings.ratelimit_storage_uri
    )
    # Fail-closed: in-memory limits live per-worker, so a multi-worker production
    # server lets an attacker round-robin requests across workers to bypass the
    # cap. Refuse to boot prod with ineffective rate limiting rather than provide
    # a false sense of protection. (Dev/CI keep memory:// for zero-config runs.)
    if settings.is_production and storage_uri.startswith("memory://"):
        raise RuntimeError(
            "Rate limiting is in-memory (memory://) but APP_ENV is production. "
            "In-memory limits are bypassable across workers — set "
            "RATELIMIT_STORAGE_URI to a shared store (e.g. redis://...), or "
            "explicitly set RATELIMIT_ENABLED=false to opt out."
        )
    app.config["RATELIMIT_STORAGE_URI"] = storage_uri
    # Keep the default limit headers off internal probes (health checks).
    limiter.init_app(app)
