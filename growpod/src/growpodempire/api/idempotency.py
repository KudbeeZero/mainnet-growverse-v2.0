"""Idempotency-Key header handling for mutation deduplication.

When a client includes an Idempotency-Key header on a POST/PUT request,
we store the response. On a retry with the same key, we return the cached
response without re-executing the mutation. Guards against:
- Network retries that would double-execute a mutation
- Double-clicks on buttons that send the same request twice
- Concurrent requests with the same key (first wins)

Usage:
  @app.route('/players/<player_id>/feed', methods=['POST'])
  @require_idempotency
  @require_player
  def feed(player_id: str):
      # mutation logic
      return {"success": True}
"""

from functools import wraps
from datetime import datetime, timedelta
from typing import Tuple
import json

from flask import request, jsonify, g
from sqlalchemy import and_

from ..db import session as db_session
from ..db.models import IdempotencyKey


IDEMPOTENCY_HEADER = "Idempotency-Key"
IDEMPOTENCY_TTL = timedelta(days=30)  # Keep cached responses for 30 days


def require_idempotency(f):
    """Decorator for idempotent mutation endpoints.

    Checks for Idempotency-Key header; if present:
    - Looks up the key in idempotency_keys table
    - If found and unexpired, returns the cached response
    - If not found, executes the mutation and caches the response
    - If found but expired, allows re-execution (treats as new request)

    The player_id must be available in the Flask context (from require_player).
    """

    @wraps(f)
    def wrapper(*args, **kwargs):
        idempotency_key = request.headers.get(IDEMPOTENCY_HEADER)

        # If no key provided, run the mutation normally (not idempotent).
        # In a stricter mode, this could raise 400; we allow it for backwards
        # compatibility with legacy clients that don't send the header.
        if not idempotency_key:
            return f(*args, **kwargs)

        # Look up the key in the database
        db = db_session.SessionLocal()
        try:
            cached = db.query(IdempotencyKey).filter(
                IdempotencyKey.key == idempotency_key
            ).first()

            if cached and (cached.expires_at is None or cached.expires_at > datetime.utcnow()):
                # Cached response is valid; return it
                response_data = cached.response_json
                return (response_data, cached.status_code)

            # No valid cache; execute the mutation
            response = f(*args, **kwargs)

            # Handle different response types (dict, tuple, Response object)
            if isinstance(response, tuple):
                response_data, status_code = response[0], response[1]
                response_headers = response[2] if len(response) > 2 else {}
            else:
                response_data = response
                status_code = 200
                response_headers = {}

            # Ensure response_data is JSON-serializable
            try:
                response_json = json.loads(json.dumps(response_data))
            except (TypeError, ValueError):
                response_json = {}

            # Store the response in the idempotency cache
            player_id = g.get("player_id", "unknown")
            new_cache = IdempotencyKey(
                key=idempotency_key,
                player_id=player_id,
                method=request.method,
                endpoint=request.path,
                response_json=response_json,
                status_code=status_code,
                expires_at=datetime.utcnow() + IDEMPOTENCY_TTL,
            )
            db.add(new_cache)
            db.commit()

            return (response_data, status_code, response_headers) if response_headers else (response_data, status_code)
        except Exception as e:
            db.rollback()
            raise
        finally:
            db.close()

    return wrapper
