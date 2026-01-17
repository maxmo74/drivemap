from __future__ import annotations

import os
import sqlite3
import time
from contextlib import contextmanager
from typing import Generator

from flask import g

APP_ROOT = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(APP_ROOT, "data.sqlite3")
CACHE_TTL_SECONDS = 60 * 60


def get_db() -> sqlite3.Connection:
    """Get database connection from Flask's g object or create new one."""
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
    return g.db


def close_db(e=None) -> None:
    """Close database connection stored in g."""
    db = g.pop("db", None)
    if db is not None:
        db.close()


@contextmanager
def get_db_context() -> Generator[sqlite3.Connection, None, None]:
    """Context manager for database connections outside of request context."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def migrate_db(conn: sqlite3.Connection) -> None:
    """Run database migrations."""
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS lists (
            room TEXT NOT NULL,
            title_id TEXT NOT NULL,
            title TEXT NOT NULL,
            year TEXT,
            original_language TEXT,
            type_label TEXT,
            image TEXT,
            rating TEXT,
            rotten_tomatoes TEXT,
            added_at INTEGER NOT NULL,
            position INTEGER,
            PRIMARY KEY (room, title_id)
        );

        CREATE TABLE IF NOT EXISTS rating_cache (
            title_id TEXT PRIMARY KEY,
            rating TEXT,
            rotten_tomatoes TEXT,
            cached_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS metadata_cache (
            title_id TEXT PRIMARY KEY,
            runtime_minutes INTEGER,
            total_seasons INTEGER,
            total_episodes INTEGER,
            avg_episode_length INTEGER,
            original_language TEXT,
            cached_at INTEGER NOT NULL
        );
        """
    )
    columns = {row["name"] for row in conn.execute("PRAGMA table_info(lists)")}
    if "watched" not in columns:
        conn.execute("ALTER TABLE lists ADD COLUMN watched INTEGER NOT NULL DEFAULT 0")
    conn.execute("UPDATE lists SET watched = 0 WHERE watched IS NULL")
    columns = {row["name"] for row in conn.execute("PRAGMA table_info(lists)")}
    if "position" not in columns:
        conn.execute("ALTER TABLE lists ADD COLUMN position INTEGER")
        _backfill_positions(conn, force=True)
    else:
        conn.execute("UPDATE lists SET position = NULL WHERE position = 0")
        _backfill_positions(conn)
    if "rotten_tomatoes" not in columns:
        conn.execute("ALTER TABLE lists ADD COLUMN rotten_tomatoes TEXT")
    if "runtime_minutes" not in columns:
        conn.execute("ALTER TABLE lists ADD COLUMN runtime_minutes INTEGER")
    if "total_seasons" not in columns:
        conn.execute("ALTER TABLE lists ADD COLUMN total_seasons INTEGER")
    if "total_episodes" not in columns:
        conn.execute("ALTER TABLE lists ADD COLUMN total_episodes INTEGER")
    if "avg_episode_length" not in columns:
        conn.execute("ALTER TABLE lists ADD COLUMN avg_episode_length INTEGER")
    if "original_language" not in columns:
        conn.execute("ALTER TABLE lists ADD COLUMN original_language TEXT")
    rating_columns = {row["name"] for row in conn.execute("PRAGMA table_info(rating_cache)")}
    if "rotten_tomatoes" not in rating_columns:
        conn.execute("ALTER TABLE rating_cache ADD COLUMN rotten_tomatoes TEXT")
    metadata_columns = {row["name"] for row in conn.execute("PRAGMA table_info(metadata_cache)")}
    if "runtime_minutes" not in metadata_columns:
        conn.execute("ALTER TABLE metadata_cache ADD COLUMN runtime_minutes INTEGER")
    if "total_seasons" not in metadata_columns:
        conn.execute("ALTER TABLE metadata_cache ADD COLUMN total_seasons INTEGER")
    if "total_episodes" not in metadata_columns:
        conn.execute("ALTER TABLE metadata_cache ADD COLUMN total_episodes INTEGER")
    if "avg_episode_length" not in metadata_columns:
        conn.execute("ALTER TABLE metadata_cache ADD COLUMN avg_episode_length INTEGER")
    if "original_language" not in metadata_columns:
        conn.execute("ALTER TABLE metadata_cache ADD COLUMN original_language TEXT")


def _backfill_positions(conn: sqlite3.Connection, force: bool = False) -> None:
    """Backfill position values for list items."""
    rooms = [row["room"] for row in conn.execute("SELECT DISTINCT room FROM lists")]
    for room in rooms:
        if force:
            rows = conn.execute(
                "SELECT title_id FROM lists WHERE room = ? ORDER BY added_at ASC",
                (room,),
            ).fetchall()
            for index, row in enumerate(rows, start=1):
                conn.execute(
                    "UPDATE lists SET position = ? WHERE room = ? AND title_id = ?",
                    (index, room, row["title_id"]),
                )
            continue
        max_position = conn.execute(
            "SELECT COALESCE(MAX(position), 0) FROM lists WHERE room = ? AND position IS NOT NULL",
            (room,),
        ).fetchone()[0]
        rows = conn.execute(
            "SELECT title_id FROM lists WHERE room = ? AND position IS NULL ORDER BY added_at ASC",
            (room,),
        ).fetchall()
        for offset, row in enumerate(rows, start=1):
            conn.execute(
                "UPDATE lists SET position = ? WHERE room = ? AND title_id = ?",
                (max_position + offset, room, row["title_id"]),
            )


def init_db() -> None:
    """Initialize the database with migrations."""
    with get_db_context() as conn:
        migrate_db(conn)
        conn.commit()


def rating_cache_get(conn: sqlite3.Connection, title_id: str) -> tuple[str | None, str | None] | None:
    """Get cached rating for a title."""
    row = conn.execute(
        "SELECT rating, rotten_tomatoes, cached_at FROM rating_cache WHERE title_id = ?",
        (title_id,),
    ).fetchone()
    if not row:
        return None
    if int(row["cached_at"]) + CACHE_TTL_SECONDS < int(time.time()):
        return None
    return row["rating"], row["rotten_tomatoes"]


def rating_cache_set(
    conn: sqlite3.Connection,
    title_id: str,
    rating: str | None,
    rotten_tomatoes: str | None,
) -> None:
    """Set cached rating for a title."""
    conn.execute(
        "REPLACE INTO rating_cache (title_id, rating, rotten_tomatoes, cached_at) VALUES (?, ?, ?, ?)",
        (title_id, rating, rotten_tomatoes, int(time.time())),
    )


def metadata_cache_get(
    conn: sqlite3.Connection, title_id: str
) -> tuple[int | None, int | None, int | None, int | None, str | None] | None:
    """Get cached metadata for a title."""
    row = conn.execute(
        """
        SELECT runtime_minutes, total_seasons, total_episodes, avg_episode_length, original_language, cached_at
        FROM metadata_cache WHERE title_id = ?
        """,
        (title_id,),
    ).fetchone()
    if not row:
        return None
    if int(row["cached_at"]) + CACHE_TTL_SECONDS < int(time.time()):
        return None
    return (
        row["runtime_minutes"],
        row["total_seasons"],
        row["total_episodes"],
        row["avg_episode_length"],
        row["original_language"],
    )


def metadata_cache_set(
    conn: sqlite3.Connection,
    title_id: str,
    runtime_minutes: int | None,
    total_seasons: int | None,
    total_episodes: int | None,
    avg_episode_length: int | None,
    original_language: str | None,
) -> None:
    """Set cached metadata for a title."""
    conn.execute(
        """
        REPLACE INTO metadata_cache (
            title_id, runtime_minutes, total_seasons, total_episodes, avg_episode_length,
            original_language, cached_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            title_id,
            runtime_minutes,
            total_seasons,
            total_episodes,
            avg_episode_length,
            original_language,
            int(time.time()),
        ),
    )
