from __future__ import annotations

import hashlib
import os
import re
from typing import Any

from flask import request

# Support both package and standalone imports
try:
    from .models import SearchResult
except ImportError:
    from models import SearchResult

DEFAULT_USER_AGENT = "shovo-movielist/1.0 (+https://example.com)"


def request_user_agent() -> str:
    """Get the user agent from the current request."""
    return request.headers.get("User-Agent") or DEFAULT_USER_AGENT


def serialize_result(result: SearchResult) -> dict[str, Any]:
    """Serialize a SearchResult to a dictionary."""
    return {
        "title_id": result.title_id,
        "title": result.title,
        "year": result.year,
        "original_language": result.original_language,
        "type_label": result.type_label,
        "image": result.image,
        "rating": result.rating,
        "rotten_tomatoes": result.rotten_tomatoes,
        "runtime_minutes": result.runtime_minutes,
        "total_seasons": result.total_seasons,
        "total_episodes": result.total_episodes,
        "avg_episode_length": result.avg_episode_length,
    }


def room_from_request() -> str:
    """Extract and sanitize room from request arguments or JSON body."""
    room = request.args.get("room") or request.json.get("room") if request.is_json else None
    if not room:
        return ""
    room = room.strip().lower()
    room = re.sub(r"[^a-z0-9-]", "", room)
    return room


def sanitize_room(value: str | None) -> str:
    """Sanitize a room name."""
    if not value:
        return ""
    value = value.strip().lower()
    return re.sub(r"[^a-z0-9-]", "", value)


def default_room() -> str:
    """Generate a random default room ID."""
    entropy = os.urandom(10)
    return hashlib.sha256(entropy).hexdigest()[:10]


def parse_watched(value: Any) -> int:
    """Parse a watched value to an integer (0 or 1)."""
    if isinstance(value, bool):
        return 1 if value else 0
    if isinstance(value, (int, float)):
        return 1 if value else 0
    if isinstance(value, str):
        return 1 if value.lower() in {"1", "true", "yes", "watched"} else 0
    return 0
