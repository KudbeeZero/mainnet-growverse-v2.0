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
    app.config["RATELIMIT_STORAGE_URI"] = app.config.get(
        "RATELIMIT_STORAGE_URI", get_settings().ratelimit_storage_uri
    )
    # Keep the default limit headers off internal probes (health checks).
    limiter.init_app(app)
