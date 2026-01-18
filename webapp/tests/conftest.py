"""Pytest configuration and fixtures."""
from __future__ import annotations

import os
import tempfile

import pytest

# Set test database path before importing app
TEST_DB_FD, TEST_DB_PATH = tempfile.mkstemp()
os.environ["SHOVO_TEST_DB"] = TEST_DB_PATH


@pytest.fixture
def app():
    """Create application for testing."""
    # Import here to use test database
    from webapp import database

    # Override database path for tests
    original_db_path = database.DB_PATH
    database.DB_PATH = TEST_DB_PATH

    from webapp import create_app

    app = create_app()
    app.config.update(
        {
            "TESTING": True,
        }
    )

    # Initialize test database
    with app.app_context():
        database.init_db()

    yield app

    # Cleanup
    database.DB_PATH = original_db_path
    try:
        os.close(TEST_DB_FD)
    except OSError:
        pass  # File descriptor may already be closed
    try:
        os.unlink(TEST_DB_PATH)
    except FileNotFoundError:
        pass  # File may already be deleted


@pytest.fixture
def client(app):
    """Create test client."""
    return app.test_client()


@pytest.fixture
def runner(app):
    """Create CLI test runner."""
    return app.test_cli_runner()
