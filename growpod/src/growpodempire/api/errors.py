"""
App-wide error handling: every error leaves as JSON in a consistent shape
`{"error": <message>, "status": <code>}` instead of Flask's default HTML, so API
clients always get machine-readable failures. Unexpected exceptions are logged
and returned as a generic 500 (no internals leaked).
"""

import logging

from flask import jsonify
from sqlalchemy.orm.exc import StaleDataError
from werkzeug.exceptions import HTTPException

log = logging.getLogger("growpodempire")

# 1 MiB request-body cap (protects against oversized payloads).
MAX_CONTENT_LENGTH = 1 * 1024 * 1024


def register_error_handlers(app) -> None:
    if not app.config.get("MAX_CONTENT_LENGTH"):
        app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH

    @app.errorhandler(HTTPException)
    def _handle_http(exc: HTTPException):
        return jsonify({"error": exc.description, "status": exc.code}), exc.code

    @app.errorhandler(StaleDataError)
    def _handle_conflict(exc: StaleDataError):
        # Optimistic-lock loss: a concurrent write to the same row won the race.
        # The transaction is rolled back, so no state changed — the client should
        # simply retry. Surface a clean 409 rather than a generic 500.
        return (
            jsonify({"error": "Conflicting concurrent update; please retry", "status": 409}),
            409,
        )

    @app.errorhandler(Exception)
    def _handle_unexpected(exc: Exception):
        log.exception("Unhandled error: %s", exc)
        return jsonify({"error": "Internal server error", "status": 500}), 500
