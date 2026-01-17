# Support both package and standalone imports
try:
    from .app import app, create_app
except ImportError:
    from app import app, create_app

__all__ = ["app", "create_app"]
