from __future__ import annotations

import os

from flask import Flask

# Support both package and standalone imports
try:
    from .database import close_db, init_db
    from .routes import bp as main_bp
except ImportError:
    from database import close_db, init_db
    from routes import bp as main_bp


def create_app() -> Flask:
    """Create and configure the Flask application."""
    application = Flask(__name__)

    # Register teardown to close database connections
    application.teardown_appcontext(close_db)

    # Register blueprints
    application.register_blueprint(main_bp)

    # Initialize database on first request
    with application.app_context():
        init_db()

    return application


app = create_app()

if __name__ == "__main__":
    debug_mode = os.environ.get("FLASK_DEBUG", "").lower() in {"1", "true", "yes", "on"}
    app.run(host="0.0.0.0", port=5000, debug=debug_mode)
