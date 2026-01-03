from __future__ import annotations

import hashlib
import json
import os
import re
import sqlite3
import time
from dataclasses import dataclass
from typing import Any, Iterable

import requests
from flask import Flask, jsonify, redirect, render_template, request

APP_ROOT = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(APP_ROOT, "data.sqlite3")
CACHE_TTL_SECONDS = 60 * 60
IMDB_SUGGESTION_URL = "https://v3.sg.media-imdb.com/suggestion/{first}/{query}.json"
IMDB_TITLE_URL = "https://www.imdb.com/title/{title_id}/"
USER_AGENT = "drivemap-movielist/1.0 (+https://example.com)"

app = Flask(__name__)


@dataclass
class SearchResult:
    title_id: str
    title: str
    year: str | None
    type_label: str | None
    image: str | None
    rating: str | None


def _get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _migrate_db(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS lists (
            room TEXT NOT NULL,
            title_id TEXT NOT NULL,
            title TEXT NOT NULL,
            year TEXT,
            type_label TEXT,
            image TEXT,
            rating TEXT,
            added_at INTEGER NOT NULL,
            PRIMARY KEY (room, title_id)
        );

        CREATE TABLE IF NOT EXISTS rating_cache (
            title_id TEXT PRIMARY KEY,
            rating TEXT,
            cached_at INTEGER NOT NULL
        );
        """
    )
    columns = {row["name"] for row in conn.execute("PRAGMA table_info(lists)")}
    if "watched" not in columns:
        conn.execute("ALTER TABLE lists ADD COLUMN watched INTEGER NOT NULL DEFAULT 0")


def init_db() -> None:
    with _get_db() as conn:
        _migrate_db(conn)


def _rating_cache_get(conn: sqlite3.Connection, title_id: str) -> str | None:
    row = conn.execute(
        "SELECT rating, cached_at FROM rating_cache WHERE title_id = ?",
        (title_id,),
    ).fetchone()
    if not row:
        return None
    if int(row["cached_at"]) + CACHE_TTL_SECONDS < int(time.time()):
        return None
    return row["rating"]


def _rating_cache_set(conn: sqlite3.Connection, title_id: str, rating: str | None) -> None:
    conn.execute(
        "REPLACE INTO rating_cache (title_id, rating, cached_at) VALUES (?, ?, ?)",
        (title_id, rating, int(time.time())),
    )


def _fetch_rating(title_id: str) -> str | None:
    headers = {"User-Agent": USER_AGENT}
    response = requests.get(IMDB_TITLE_URL.format(title_id=title_id), headers=headers, timeout=10)
    response.raise_for_status()
    match = re.search(r'<script type="application/ld\+json">(.*?)</script>', response.text, re.S)
    if not match:
        return None
    try:
        data = json.loads(match.group(1))
    except json.JSONDecodeError:
        return None
    rating = data.get("aggregateRating", {}).get("ratingValue")
    if rating is None:
        return None
    return str(rating)


def get_rating(title_id: str) -> str | None:
    with _get_db() as conn:
        cached = _rating_cache_get(conn, title_id)
        if cached is not None:
            return cached
        try:
            rating = _fetch_rating(title_id)
        except requests.RequestException:
            rating = None
        _rating_cache_set(conn, title_id, rating)
        conn.commit()
        return rating


def parse_suggestion_item(item: dict[str, Any]) -> SearchResult | None:
    title_id = item.get("id")
    if not title_id:
        return None
    return SearchResult(
        title_id=title_id,
        title=item.get("l") or "Untitled",
        year=str(item.get("y")) if item.get("y") else None,
        type_label=item.get("q"),
        image=item.get("i", {}).get("imageUrl"),
        rating=get_rating(title_id),
    )


def fetch_suggestions(query: str) -> list[SearchResult]:
    if not query:
        return []
    safe_query = query.strip().lower()
    if not safe_query:
        return []
    first = safe_query[0]
    url = IMDB_SUGGESTION_URL.format(first=first, query=requests.utils.quote(safe_query))
    headers = {"User-Agent": USER_AGENT}
    response = requests.get(url, headers=headers, timeout=10)
    response.raise_for_status()
    payload = response.json()
    items: Iterable[dict[str, Any]] = payload.get("d", [])
    results: list[SearchResult] = []
    for item in items:
        parsed = parse_suggestion_item(item)
        if parsed:
            results.append(parsed)
    return results


def serialize_result(result: SearchResult) -> dict[str, Any]:
    return {
        "title_id": result.title_id,
        "title": result.title,
        "year": result.year,
        "type_label": result.type_label,
        "image": result.image,
        "rating": result.rating,
    }


def _room_from_request() -> str:
    room = request.args.get("room") or request.json.get("room") if request.is_json else None
    if not room:
        return ""
    room = room.strip().lower()
    room = re.sub(r"[^a-z0-9-]", "", room)
    return room


def _default_room() -> str:
    entropy = os.urandom(10)
    return hashlib.sha256(entropy).hexdigest()[:10]


def _parse_watched(value: Any) -> int:
    if isinstance(value, bool):
        return 1 if value else 0
    if isinstance(value, (int, float)):
        return 1 if value else 0
    if isinstance(value, str):
        return 1 if value.lower() in {"1", "true", "yes", "watched"} else 0
    return 0


@app.route("/")
def root() -> Any:
    return redirect("/r/new")


@app.route("/r/<room>")
def room(room: str) -> Any:
    if room == "new":
        return redirect(f"/r/{_default_room()}")
    return render_template("index.html", room=room)


@app.route("/api/search")
def api_search() -> Any:
    query = request.args.get("q", "")
    try:
        results = fetch_suggestions(query)
    except requests.RequestException as exc:
        return jsonify({"error": "imdb_fetch_failed", "detail": str(exc)}), 502
    return jsonify({"results": [serialize_result(result) for result in results[:8]]})


@app.route("/api/list", methods=["GET"])
def api_list() -> Any:
    room = _room_from_request() or request.args.get("room", "")
    if not room:
        return jsonify({"error": "missing_room"}), 400
    status = request.args.get("status", "unwatched")
    watched_flag = 1 if status == "watched" else 0
    with _get_db() as conn:
        _migrate_db(conn)
        rows = conn.execute(
            "SELECT * FROM lists WHERE room = ? AND watched = ? ORDER BY added_at DESC",
            (room, watched_flag),
        ).fetchall()
    return jsonify({"items": [dict(row) for row in rows]})


@app.route("/api/list", methods=["POST"])
def api_add() -> Any:
    if not request.is_json:
        return jsonify({"error": "invalid_payload"}), 400
    room = _room_from_request()
    if not room:
        return jsonify({"error": "missing_room"}), 400
    data = request.json
    title_id = data.get("title_id")
    title = data.get("title")
    if not title_id or not title:
        return jsonify({"error": "missing_title"}), 400
    watched = _parse_watched(data.get("watched", 0))
    with _get_db() as conn:
        _migrate_db(conn)
        conn.execute(
            "REPLACE INTO lists (room, title_id, title, year, type_label, image, rating, added_at, watched) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                room,
                title_id,
                title,
                data.get("year"),
                data.get("type_label"),
                data.get("image"),
                data.get("rating"),
                int(time.time()),
                watched,
            ),
        )
        conn.commit()
    return jsonify({"status": "ok"})


@app.route("/api/list", methods=["PATCH"])
def api_update() -> Any:
    if not request.is_json:
        return jsonify({"error": "invalid_payload"}), 400
    room = _room_from_request()
    if not room:
        return jsonify({"error": "missing_room"}), 400
    title_id = request.json.get("title_id")
    watched = _parse_watched(request.json.get("watched"))
    if not title_id:
        return jsonify({"error": "missing_title_id"}), 400
    with _get_db() as conn:
        _migrate_db(conn)
        conn.execute(
            "UPDATE lists SET watched = ? WHERE room = ? AND title_id = ?",
            (watched, room, title_id),
        )
        conn.commit()
    return jsonify({"status": "ok"})


@app.route("/api/list", methods=["DELETE"])
def api_delete() -> Any:
    if not request.is_json:
        return jsonify({"error": "invalid_payload"}), 400
    room = _room_from_request()
    if not room:
        return jsonify({"error": "missing_room"}), 400
    title_id = request.json.get("title_id")
    if not title_id:
        return jsonify({"error": "missing_title_id"}), 400
    with _get_db() as conn:
        _migrate_db(conn)
        conn.execute(
            "DELETE FROM lists WHERE room = ? AND title_id = ?",
            (room, title_id),
        )
        conn.commit()
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=5000, debug=True)
