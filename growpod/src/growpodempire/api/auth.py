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
