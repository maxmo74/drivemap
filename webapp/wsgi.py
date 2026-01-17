"""WSGI entry point for the application."""
from webapp import app

application = app

if __name__ == "__main__":
    application.run()
