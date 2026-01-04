from __future__ import annotations

import hashlib
import json
import os
import re
import sqlite3
import threading
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
OMDB_URL = "https://www.omdbapi.com/"
DEFAULT_USER_AGENT = "shovo-movielist/1.0 (+https://example.com)"
APP_VERSION = "1.3.3"
MAX_RESULTS = 10
IMDB_TRENDING_URL = "https://www.imdb.com/chart/moviemeter/"
ALLOWED_TYPE_LABELS = {"feature", "movie", "tvseries", "tvminiseries", "tvmovie"}
OMDB_API_KEY = os.environ.get("OMDB_API_KEY", "thewdb")

app = Flask(__name__)

_refresh_lock = threading.Lock()
_refresh_state: dict[str, dict[str, int | bool]] = {}


@dataclass
class SearchResult:
    title_id: str
    title: str
    year: str | None
    type_label: str | None
    image: str | None
    rating: str | None
    rotten_tomatoes: str | None
    runtime_minutes: int | None
    total_seasons: int | None
    total_episodes: int | None
    avg_episode_length: int | None



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


def _backfill_positions(conn: sqlite3.Connection, force: bool = False) -> None:
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
    with _get_db() as conn:
        _migrate_db(conn)


def _rating_cache_get(conn: sqlite3.Connection, title_id: str) -> tuple[str | None, str | None] | None:
    row = conn.execute(
        "SELECT rating, rotten_tomatoes, cached_at FROM rating_cache WHERE title_id = ?",
        (title_id,),
    ).fetchone()
    if not row:
        return None
    if int(row["cached_at"]) + CACHE_TTL_SECONDS < int(time.time()):
        return None
    return row["rating"], row["rotten_tomatoes"]


def _rating_cache_set(
    conn: sqlite3.Connection,
    title_id: str,
    rating: str | None,
    rotten_tomatoes: str | None,
) -> None:
    conn.execute(
        "REPLACE INTO rating_cache (title_id, rating, rotten_tomatoes, cached_at) VALUES (?, ?, ?, ?)",
        (title_id, rating, rotten_tomatoes, int(time.time())),
    )


def _metadata_cache_get(
    conn: sqlite3.Connection, title_id: str
) -> tuple[int | None, int | None, int | None, int | None] | None:
    row = conn.execute(
        """
        SELECT runtime_minutes, total_seasons, total_episodes, avg_episode_length, cached_at
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
    )


def _metadata_cache_set(
    conn: sqlite3.Connection,
    title_id: str,
    runtime_minutes: int | None,
    total_seasons: int | None,
    total_episodes: int | None,
    avg_episode_length: int | None,
) -> None:
    conn.execute(
        """
        REPLACE INTO metadata_cache (
            title_id, runtime_minutes, total_seasons, total_episodes, avg_episode_length, cached_at
        ) VALUES (?, ?, ?, ?, ?, ?)
        """,
        (title_id, runtime_minutes, total_seasons, total_episodes, avg_episode_length, int(time.time())),
    )


def _fetch_rotten_tomatoes(title_id: str, user_agent: str) -> str | None:
    if not OMDB_API_KEY:
        return None
    response = requests.get(
        OMDB_URL,
        params={"i": title_id, "apikey": OMDB_API_KEY},
        headers={"User-Agent": user_agent},
        timeout=10,
    )
    response.raise_for_status()
    payload = response.json()
    if payload.get("Response") != "True":
        return None
    ratings = payload.get("Ratings") or []
    for rating in ratings:
        if rating.get("Source") == "Rotten Tomatoes":
            return rating.get("Value")
    return None


def _fetch_omdb_title(title_id: str, user_agent: str, season: int | None = None) -> dict[str, Any]:
    if not OMDB_API_KEY:
        return {}
    params: dict[str, Any] = {"i": title_id, "apikey": OMDB_API_KEY}
    if season is not None:
        params["Season"] = season
    response = requests.get(
        OMDB_URL,
        params=params,
        headers={"User-Agent": user_agent},
        timeout=10,
    )
    response.raise_for_status()
    payload = response.json()
    if payload.get("Response") != "True":
        return {}
    return payload


def _parse_runtime(runtime: str | None) -> int | None:
    if not runtime or runtime == "N/A":
        return None
    match = re.search(r"(\d+)", runtime)
    if not match:
        return None
    return int(match.group(1))


def _fetch_metadata(
    title_id: str, user_agent: str, normalized_type: str
) -> tuple[int | None, int | None, int | None, int | None]:
    payload = _fetch_omdb_title(title_id, user_agent)
    runtime_minutes = _parse_runtime(payload.get("Runtime"))
    total_seasons = payload.get("totalSeasons")
    try:
        total_seasons_int = int(total_seasons) if total_seasons else None
    except ValueError:
        total_seasons_int = None
    avg_episode_length = runtime_minutes if normalized_type in {"tvseries", "tvminiseries"} else None
    total_episodes = None
    if normalized_type == "tvminiseries" and total_seasons_int:
        total_episodes_count = 0
        for season in range(1, total_seasons_int + 1):
            season_payload = _fetch_omdb_title(title_id, user_agent, season=season)
            episodes = season_payload.get("Episodes") or []
            total_episodes_count += len(episodes)
        total_episodes = total_episodes_count if total_episodes_count else None
    return runtime_minutes, total_seasons_int, total_episodes, avg_episode_length


def get_metadata(
    title_id: str, user_agent: str, normalized_type: str
) -> tuple[int | None, int | None, int | None, int | None]:
    with _get_db() as conn:
        _migrate_db(conn)
        cached = _metadata_cache_get(conn, title_id)
        if cached is not None:
            return cached
        try:
            metadata = _fetch_metadata(title_id, user_agent, normalized_type)
        except requests.RequestException:
            metadata = (None, None, None, None)
        _metadata_cache_set(conn, title_id, *metadata)
        conn.commit()
        return metadata


def _fetch_ratings(title_id: str, user_agent: str) -> tuple[str | None, str | None]:
    headers = {"User-Agent": user_agent}
    response = requests.get(IMDB_TITLE_URL.format(title_id=title_id), headers=headers, timeout=10)
    response.raise_for_status()
    match = re.search(r'<script type="application/ld\+json">(.*?)</script>', response.text, re.S)
    if not match:
        imdb_rating = None
    else:
        try:
            data = json.loads(match.group(1))
        except json.JSONDecodeError:
            data = {}
        imdb_rating = data.get("aggregateRating", {}).get("ratingValue")
        imdb_rating = str(imdb_rating) if imdb_rating is not None else None
    try:
        rotten_rating = _fetch_rotten_tomatoes(title_id, user_agent)
    except requests.RequestException:
        rotten_rating = None
    return imdb_rating, rotten_rating


def get_ratings(title_id: str, user_agent: str) -> tuple[str | None, str | None]:
    with _get_db() as conn:
        cached = _rating_cache_get(conn, title_id)
        if cached is not None:
            return cached
        try:
            imdb_rating, rotten_rating = _fetch_ratings(title_id, user_agent)
        except requests.RequestException:
            imdb_rating, rotten_rating = None, None
        _rating_cache_set(conn, title_id, imdb_rating, rotten_rating)
        conn.commit()
        return imdb_rating, rotten_rating


def get_rating(title_id: str, user_agent: str) -> str | None:
    imdb_rating, _ = get_ratings(title_id, user_agent)
    return imdb_rating


def get_rotten_tomatoes(title_id: str, user_agent: str) -> str | None:
    _, rotten_rating = get_ratings(title_id, user_agent)
    return rotten_rating


def _normalize_type_label(type_label: str | None) -> str:
    if not type_label:
        return ""
    return re.sub(r"[^a-z]", "", type_label.lower())


def _refresh_title_details(
    conn: sqlite3.Connection, title_id: str, user_agent: str, normalized_type: str
) -> tuple[str | None, str | None, int | None, int | None, int | None, int | None]:
    try:
        imdb_rating, rotten_rating = _fetch_ratings(title_id, user_agent)
    except requests.RequestException:
        imdb_rating, rotten_rating = None, None
    try:
        runtime_minutes, total_seasons, total_episodes, avg_episode_length = _fetch_metadata(
            title_id, user_agent, normalized_type
        )
    except requests.RequestException:
        runtime_minutes = total_seasons = total_episodes = avg_episode_length = None
    _rating_cache_set(conn, title_id, imdb_rating, rotten_rating)
    _metadata_cache_set(
        conn, title_id, runtime_minutes, total_seasons, total_episodes, avg_episode_length
    )
    return (
        imdb_rating,
        rotten_rating,
        runtime_minutes,
        total_seasons,
        total_episodes,
        avg_episode_length,
    )


def _start_refresh(room: str, user_agent: str) -> int:
    with _get_db() as conn:
        _migrate_db(conn)
        rows = conn.execute(
            "SELECT title_id, type_label FROM lists WHERE room = ?",
            (room,),
        ).fetchall()
    items = [(row["title_id"], row["type_label"]) for row in rows]
    total = len(items)
    with _refresh_lock:
        _refresh_state[room] = {"refreshing": True, "processed": 0, "total": total}

    def _run_refresh() -> None:
        with _get_db() as conn:
            _migrate_db(conn)
            for title_id, type_label in items:
                normalized_type = _normalize_type_label(type_label)
                if normalized_type not in ALLOWED_TYPE_LABELS:
                    normalized_type = "movie"
                (
                    imdb_rating,
                    rotten_rating,
                    runtime_minutes,
                    total_seasons,
                    total_episodes,
                    avg_episode_length,
                ) = _refresh_title_details(conn, title_id, user_agent, normalized_type)
                conn.execute(
                    """
                    UPDATE lists
                    SET rating = ?, rotten_tomatoes = ?, runtime_minutes = ?, total_seasons = ?,
                        total_episodes = ?, avg_episode_length = ?
                    WHERE room = ? AND title_id = ?
                    """,
                    (
                        imdb_rating,
                        rotten_rating,
                        runtime_minutes,
                        total_seasons,
                        total_episodes,
                        avg_episode_length,
                        room,
                        title_id,
                    ),
                )
                conn.commit()
                with _refresh_lock:
                    state = _refresh_state.get(room)
                    if state:
                        state["processed"] = int(state.get("processed", 0)) + 1
            with _refresh_lock:
                state = _refresh_state.get(room)
                if state:
                    state["refreshing"] = False

    thread = threading.Thread(target=_run_refresh, daemon=True)
    thread.start()
    return total


def parse_suggestion_item(
    item: dict[str, Any], user_agent: str, include_details: bool = True
) -> SearchResult | None:
    title_id = item.get("id")
    if not title_id:
        return None
    type_label = item.get("qid") or item.get("q")
    normalized_type = _normalize_type_label(type_label)
    if normalized_type not in ALLOWED_TYPE_LABELS:
        return None
    image_url = item.get("i", {}).get("imageUrl")
    runtime_minutes = total_seasons = total_episodes = avg_episode_length = None
    rating = rotten_tomatoes = None
    if include_details:
        runtime_minutes, total_seasons, total_episodes, avg_episode_length = get_metadata(
            title_id, user_agent, normalized_type
        )
        rating, rotten_tomatoes = get_ratings(title_id, user_agent)
    return SearchResult(
        title_id=title_id,
        title=item.get("l") or "Untitled",
        year=str(item.get("y")) if item.get("y") else None,
        type_label=type_label,
        image=_shrink_image_url(image_url),
        rating=rating,
        rotten_tomatoes=rotten_tomatoes,
        runtime_minutes=runtime_minutes,
        total_seasons=total_seasons,
        total_episodes=total_episodes,
        avg_episode_length=avg_episode_length,
    )


def _shrink_image_url(url: str | None) -> str | None:
    if not url:
        return None
    match = re.search(r"\._V1_.*(\.jpg|\.png)$", url)
    if not match:
        return url
    return re.sub(
        r"\._V1_.*(\.jpg|\.png)$",
        r"._V1_UX120_CR0,0,120,180_AL_\1",
        url,
    )


def fetch_suggestions(query: str, user_agent: str) -> list[SearchResult]:
    if not query:
        return []
    safe_query = query.strip().lower()
    if not safe_query:
        return []
    first = safe_query[0]
    url = IMDB_SUGGESTION_URL.format(first=first, query=requests.utils.quote(safe_query))
    headers = {"User-Agent": user_agent}
    response = requests.get(url, headers=headers, timeout=10)
    response.raise_for_status()
    payload = response.json()
    items: Iterable[dict[str, Any]] = payload.get("d", [])
    results: list[SearchResult] = []
    for item in items:
        parsed = parse_suggestion_item(item, user_agent, include_details=False)
        if parsed:
            results.append(parsed)
    return results


def fetch_title_by_id(title_id: str, user_agent: str) -> SearchResult | None:
    if not title_id:
        return None
    first = title_id[0].lower()
    url = IMDB_SUGGESTION_URL.format(first=first, query=requests.utils.quote(title_id))
    headers = {"User-Agent": user_agent}
    response = requests.get(url, headers=headers, timeout=10)
    response.raise_for_status()
    payload = response.json()
    items: Iterable[dict[str, Any]] = payload.get("d", [])
    for item in items:
        if item.get("id") == title_id:
            return parse_suggestion_item(item, user_agent, include_details=False)
    return None


def fetch_trending(user_agent: str) -> list[SearchResult]:
    headers = {"User-Agent": user_agent}
    response = requests.get(IMDB_TRENDING_URL, headers=headers, timeout=10)
    response.raise_for_status()
    ids = re.findall(r"/title/(tt\d+)/", response.text)
    seen: set[str] = set()
    results: list[SearchResult] = []
    for title_id in ids:
        if title_id in seen:
            continue
        seen.add(title_id)
        result = fetch_title_by_id(title_id, user_agent)
        if result:
            results.append(result)
        if len(results) >= MAX_RESULTS:
            break
    return results


def _request_user_agent() -> str:
    return request.headers.get("User-Agent") or DEFAULT_USER_AGENT


def serialize_result(result: SearchResult) -> dict[str, Any]:
    return {
        "title_id": result.title_id,
        "title": result.title,
        "year": result.year,
        "type_label": result.type_label,
        "image": result.image,
        "rating": result.rating,
        "rotten_tomatoes": result.rotten_tomatoes,
        "runtime_minutes": result.runtime_minutes,
        "total_seasons": result.total_seasons,
        "total_episodes": result.total_episodes,
        "avg_episode_length": result.avg_episode_length,
    }


def _room_from_request() -> str:
    room = request.args.get("room") or request.json.get("room") if request.is_json else None
    if not room:
        return ""
    room = room.strip().lower()
    room = re.sub(r"[^a-z0-9-]", "", room)
    return room


def _sanitize_room(value: str | None) -> str:
    if not value:
        return ""
    value = value.strip().lower()
    return re.sub(r"[^a-z0-9-]", "", value)


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
    return render_template("index.html", room=room, app_version=APP_VERSION)


@app.route("/api/search")
def api_search() -> Any:
    query = request.args.get("q", "")
    user_agent = _request_user_agent()
    try:
        results = fetch_suggestions(query, user_agent)
    except requests.RequestException as exc:
        return jsonify({"error": "imdb_fetch_failed", "detail": str(exc)}), 502
    return jsonify({"results": [serialize_result(result) for result in results[:MAX_RESULTS]]})


@app.route("/api/details")
def api_details() -> Any:
    title_id = request.args.get("title_id")
    if not title_id:
        return jsonify({"error": "missing_title_id"}), 400
    type_label = request.args.get("type_label")
    normalized_type = _normalize_type_label(type_label)
    if normalized_type not in ALLOWED_TYPE_LABELS:
        normalized_type = "movie"
    user_agent = _request_user_agent()
    runtime_minutes, total_seasons, total_episodes, avg_episode_length = get_metadata(
        title_id, user_agent, normalized_type
    )
    rating, rotten_tomatoes = get_ratings(title_id, user_agent)
    return jsonify(
        {
            "rating": rating,
            "rotten_tomatoes": rotten_tomatoes,
            "runtime_minutes": runtime_minutes,
            "total_seasons": total_seasons,
            "total_episodes": total_episodes,
            "avg_episode_length": avg_episode_length,
        }
    )


@app.route("/api/refresh", methods=["POST"])
def api_refresh() -> Any:
    if not request.is_json:
        return jsonify({"error": "invalid_payload"}), 400
    room = _room_from_request()
    if not room:
        return jsonify({"error": "missing_room"}), 400
    user_agent = _request_user_agent()
    with _refresh_lock:
        state = _refresh_state.get(room)
        if state and state.get("refreshing"):
            return jsonify({"error": "refresh_in_progress"}), 409
    total = _start_refresh(room, user_agent)
    return jsonify({"status": "started", "total": total})


@app.route("/api/refresh/status")
def api_refresh_status() -> Any:
    room = request.args.get("room", "")
    if not room:
        return jsonify({"error": "missing_room"}), 400
    with _refresh_lock:
        state = _refresh_state.get(room, {"refreshing": False, "processed": 0, "total": 0})
        return jsonify(state)


@app.route("/api/trending")
def api_trending() -> Any:
    user_agent = _request_user_agent()
    try:
        results = fetch_trending(user_agent)
    except requests.RequestException as exc:
        return jsonify({"error": "imdb_fetch_failed", "detail": str(exc)}), 502
    return jsonify({"results": [serialize_result(result) for result in results]})


@app.route("/api/list", methods=["GET"])
def api_list() -> Any:
    room = _room_from_request() or request.args.get("room", "")
    if not room:
        return jsonify({"error": "missing_room"}), 400
    status = request.args.get("status", "unwatched")
    watched_flag = 1 if status == "watched" else 0
    page = max(int(request.args.get("page", 1)), 1)
    per_page = max(int(request.args.get("per_page", MAX_RESULTS)), 1)
    offset = (page - 1) * per_page
    with _get_db() as conn:
        _migrate_db(conn)
        total_count = conn.execute(
            "SELECT COUNT(*) FROM lists WHERE room = ? AND watched = ?",
            (room, watched_flag),
        ).fetchone()[0]
        rows = conn.execute(
            """
            SELECT * FROM lists
            WHERE room = ? AND watched = ?
            ORDER BY (position IS NULL) ASC, position DESC, added_at DESC
            LIMIT ? OFFSET ?
            """,
            (room, watched_flag, per_page, offset),
        ).fetchall()
    total_pages = max((total_count + per_page - 1) // per_page, 1)
    return jsonify(
        {
            "items": [dict(row) for row in rows],
            "page": page,
            "per_page": per_page,
            "total_pages": total_pages,
            "total_count": total_count,
        }
    )


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
        next_position = conn.execute(
            "SELECT COALESCE(MAX(position), 0) + 1 FROM lists WHERE room = ? AND watched = ?",
            (room, watched),
        ).fetchone()[0]
        conn.execute(
            """
            REPLACE INTO lists (
                room, title_id, title, year, type_label, image, rating, rotten_tomatoes,
                runtime_minutes, total_seasons, total_episodes, avg_episode_length, added_at, watched
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                room,
                title_id,
                title,
                data.get("year"),
                data.get("type_label"),
                data.get("image"),
                data.get("rating"),
                data.get("rotten_tomatoes"),
                data.get("runtime_minutes"),
                data.get("total_seasons"),
                data.get("total_episodes"),
                data.get("avg_episode_length"),
                int(time.time()),
                watched,
            ),
        )
        conn.execute(
            "UPDATE lists SET position = ? WHERE room = ? AND title_id = ?",
            (next_position, room, title_id),
        )
        conn.commit()
    return jsonify({"status": "ok"})


@app.route("/api/list", methods=["PATCH"], endpoint="api_list_patch")
def api_patch_list() -> Any:
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


@app.route("/api/list/order", methods=["PATCH"])
def api_order() -> Any:
    if not request.is_json:
        return jsonify({"error": "invalid_payload"}), 400
    room = _room_from_request()
    if not room:
        return jsonify({"error": "missing_room"}), 400
    order = request.json.get("order")
    if not isinstance(order, list) or not order:
        return jsonify({"error": "invalid_order"}), 400
    with _get_db() as conn:
        _migrate_db(conn)
        total = len(order)
        for index, title_id in enumerate(order):
            position = total - index
            conn.execute(
                "UPDATE lists SET position = ? WHERE room = ? AND title_id = ?",
                (position, room, title_id),
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


@app.route("/api/list/rename", methods=["PATCH"])
def api_rename_list() -> Any:
    if not request.is_json:
        return jsonify({"error": "invalid_payload"}), 400
    room = _room_from_request()
    if not room:
        return jsonify({"error": "missing_room"}), 400
    next_room = _sanitize_room(request.json.get("next_room"))
    if not next_room:
        return jsonify({"error": "missing_next_room"}), 400
    if next_room == room:
        return jsonify({"status": "ok", "room": room})
    with _get_db() as conn:
        _migrate_db(conn)
        existing = conn.execute(
            "SELECT 1 FROM lists WHERE room = ? LIMIT 1",
            (next_room,),
        ).fetchone()
        if existing:
            return (
                jsonify(
                    {
                        "error": "room_exists",
                        "message": "That List ID already exists. Pick another name.",
                    }
                ),
                409,
            )
        conn.execute("UPDATE lists SET room = ? WHERE room = ?", (next_room, room))
        conn.commit()
    return jsonify({"status": "ok", "room": next_room})


if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=5000, debug=True)
