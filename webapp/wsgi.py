"""WSGI entry point for the application."""
# Support both package and standalone imports
try:
    from webapp import app
except ImportError:
    from app import app

application = app

if __name__ == "__main__":
    application.run()
