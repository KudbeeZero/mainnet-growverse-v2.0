"""
Operational endpoints + request observability.

- GET /health   : liveness (process is up), no dependencies.
- GET /readiness: readiness (can serve traffic) — pings the database.
- Per-request: a request id (echoed as X-Request-ID) and a structured access log
  line with method, path, status, and duration.
"""

import logging
import time
import uuid

from flask import g, jsonify, request
from sqlalchemy import text

from ..db.session import get_engine

log = logging.getLogger("growpodempire.access")


def register_observability(app) -> None:
    if not logging.getLogger().handlers:
        logging.basicConfig(level=logging.INFO)

    @app.before_request
    def _start_timer():
        g.request_id = request.headers.get("X-Request-ID") or uuid.uuid4().hex
        g.start_time = time.monotonic()

    @app.after_request
    def _log_request(response):
        duration_ms = (time.monotonic() - getattr(g, "start_time", time.monotonic())) * 1000
        request_id = getattr(g, "request_id", "-")
        response.headers["X-Request-ID"] = request_id
        log.info(
            "%s %s -> %s (%.1fms) rid=%s",
            request.method,
            request.path,
            response.status_code,
            duration_ms,
            request_id,
        )
        return response

    @app.get("/health")
    def health():
        return jsonify({"status": "ok"})

    @app.get("/readiness")
    def readiness():
        try:
            with get_engine().connect() as conn:
                conn.execute(text("SELECT 1"))
            return jsonify({"status": "ready", "database": "ok"})
        except Exception as exc:  # pragma: no cover - failure path
            log.error("Readiness DB check failed: %s", exc)
            return jsonify({"status": "unavailable", "database": "error"}), 503
