"""
Self-describing API docs.

`/openapi.json` is generated from Flask's URL map at request time, so it never
drifts from the actual routes. `/docs` serves a Swagger UI page against it. Write
methods are tagged with the X-API-Key security scheme.
"""

import re

from flask import jsonify, Response

from .. import __version__

_PARAM_RE = re.compile(r"<(?:[^:<>]+:)?([^<>]+)>")
_WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def _tag_for(path: str) -> str:
    parts = [p for p in path.split("/") if p and not p.startswith("{")]
    if path.startswith("/api/game"):
        return parts[2] if len(parts) > 2 else "game"
    return parts[0] if parts else "root"


def build_spec(app) -> dict:
    paths: dict = {}
    for rule in app.url_map.iter_rules():
        if rule.endpoint == "static":
            continue
        path = _PARAM_RE.sub(r"{\1}", rule.rule)
        params = [
            {"name": arg, "in": "path", "required": True, "schema": {"type": "string"}}
            for arg in sorted(rule.arguments)
        ]
        item = paths.setdefault(path, {})
        for method in sorted(rule.methods - {"HEAD", "OPTIONS"}):
            op = {
                "tags": [_tag_for(path)],
                "summary": f"{method} {path}",
                "responses": {"200": {"description": "OK"}},
            }
            if params:
                op["parameters"] = params
            if method in _WRITE_METHODS:
                op["security"] = [{"ApiKeyAuth": []}]
                op["requestBody"] = {
                    "content": {"application/json": {"schema": {"type": "object"}}}
                }
            item[method.lower()] = op

    return {
        "openapi": "3.0.3",
        "info": {
            "title": "GROWv2 API",
            "version": __version__,
            "description": "Cannabis cultivation game — economy, genetics, real-time "
            "simulation, and Algorand on-chain assets.",
        },
        "servers": [{"url": "/"}],
        "paths": paths,
        "components": {
            "securitySchemes": {
                "ApiKeyAuth": {"type": "apiKey", "in": "header", "name": "X-API-Key"}
            }
        },
    }


_SWAGGER_HTML = """<!DOCTYPE html>
<html>
<head>
  <title>GROWv2 API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({ url: "/openapi.json", dom_id: "#swagger-ui" });
    };
  </script>
</body>
</html>"""


def register_openapi(app) -> None:
    @app.get("/openapi.json")
    def openapi_json():
        return jsonify(build_spec(app))

    @app.get("/docs")
    def docs():
        return Response(_SWAGGER_HTML, mimetype="text/html")
