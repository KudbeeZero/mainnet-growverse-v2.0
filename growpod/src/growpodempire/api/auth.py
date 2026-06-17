"""
Lightweight per-player API-key auth for write endpoints.

A player receives an API key once, at creation. Mutating endpoints scoped to a
player require the matching `X-API-Key` header; read endpoints stay public.
Keys are compared in constant time.
"""

import hmac
from functools import wraps

from flask import request, jsonify

from ..db.session import session_scope
from ..db.models import Player

API_KEY_HEADER = "X-API-Key"


def require_player(view):
    """Guard a `<player_id>`-scoped route with the player's API key."""

    @wraps(view)
    def wrapper(*args, **kwargs):
        player_id = kwargs.get("player_id")
        provided = request.headers.get(API_KEY_HEADER)
        if not provided:
            return jsonify({"error": f"{API_KEY_HEADER} header required"}), 401

        with session_scope() as s:
            player = s.get(Player, player_id)
            if player is None:
                return jsonify({"error": "Player not found"}), 404
            expected = player.api_key or ""

        if not expected or not hmac.compare_digest(provided, expected):
            return jsonify({"error": "Invalid API key"}), 403
        return view(*args, **kwargs)

    return wrapper


def require_admin(view):
    """Guard admin (non-player-scoped) routes.

    Authorization strategy (layered):

    1. If ``ADMIN_SECRET`` is set, the ``X-API-Key`` header must match it
       exactly (constant-time compare).  This is the production path.
    2. If ``ADMIN_SECRET`` is *not* set **and** the process is running in a
       non-production environment (``APP_ENV`` != "production"/"prod"), any
       valid player API key is accepted — convenience fallback for local dev
       so the admin UI works without additional config.
    3. If ``ADMIN_SECRET`` is not set **and** the process is in production,
       all requests are rejected (503 Admin not configured).  This is the
       secure-by-default posture: accidental omission of the secret in prod
       locks the routes rather than opening them.
    """

    @wraps(view)
    def wrapper(*args, **kwargs):
        from ..config import get_settings
        provided = request.headers.get(API_KEY_HEADER)
        if not provided:
            return jsonify({"error": f"{API_KEY_HEADER} header required"}), 401

        settings = get_settings()

        if settings.admin_secret:
            # Path 1 — production with explicit secret (constant-time compare).
            if not hmac.compare_digest(provided, settings.admin_secret):
                return jsonify({"error": "Admin access denied"}), 403

        elif not settings.is_production:
            # Path 2 — local dev / test only: any valid player key accepted.
            with session_scope() as s:
                player = s.query(Player).filter(Player.api_key == provided).first()
                if player is None:
                    return jsonify({"error": "Invalid API key"}), 403

        else:
            # Path 3 — production with no secret configured: lock the routes.
            return jsonify({
                "error": "Admin endpoints are not configured on this server"
            }), 503

        return view(*args, **kwargs)

    return wrapper
