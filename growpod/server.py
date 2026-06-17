"""
Render entry point.

Serves the application factory (the DB-backed game API) on Render's dynamic PORT.
"""

import os

from growpodempire.api.flask_api import create_app

app = create_app()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    debug_mode = os.environ.get("FLASK_DEBUG", "false").lower() == "true"
    app.run(host="0.0.0.0", port=port, debug=debug_mode)
