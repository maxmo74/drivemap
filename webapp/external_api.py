from __future__ import annotations

import json
import os
import re
from typing import Any, Iterable

import requests

from .database import (
    get_db_context,
    metadata_cache_get,
    metadata_cache_set,
    migrate_db,
    rating_cache_get,
    rating_cache_set,
)
from .models import SearchResult

IMDB_SUGGESTION_URL = "https://v3.sg.media-imdb.com/suggestion/{first}/{query}.json"
IMDB_TITLE_URL = "https://www.imdb.com/title/{title_id}/"
IMDB_TRENDING_URL = "https://www.imdb.com/chart/moviemeter/"
OMDB_URL = "https://www.omdbapi.com/"
DEFAULT_USER_AGENT = "shovo-movielist/1.0 (+https://example.com)"
MAX_RESULTS = 10
ALLOWED_TYPE_LABELS = {"feature", "movie", "tvseries", "tvminiseries", "tvmovie"}
OMDB_API_KEY = os.environ.get("OMDB_API_KEY", "thewdb")


def normalize_type_label(type_label: str | None) -> str:
    """Normalize a type label to lowercase alphanumeric."""
    if not type_label:
        return ""
    return re.sub(r"[^a-z]", "", type_label.lower())


def shrink_image_url(url: str | None) -> str | None:
    """Resize IMDB image URL to a smaller size."""
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


def _fetch_rotten_tomatoes(title_id: str, user_agent: str) -> str | None:
    """Fetch Rotten Tomatoes rating from OMDB API."""
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
    """Fetch title info from OMDB API."""
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
    """Parse runtime string to minutes."""
    if not runtime or runtime == "N/A":
        return None
    match = re.search(r"(\d+)", runtime)
    if not match:
        return None
    return int(match.group(1))


def _parse_original_language(value: str | None) -> str | None:
    """Parse original language from comma-separated list."""
    if not value or value == "N/A":
        return None
    language = value.split(",")[0].strip()
    return language or None


def _fetch_metadata(
    title_id: str, user_agent: str, normalized_type: str
) -> tuple[int | None, int | None, int | None, int | None, str | None]:
    """Fetch metadata from OMDB API."""
    payload = _fetch_omdb_title(title_id, user_agent)
    runtime_minutes = _parse_runtime(payload.get("Runtime"))
    original_language = _parse_original_language(payload.get("Language"))
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
    return runtime_minutes, total_seasons_int, total_episodes, avg_episode_length, original_language


def get_metadata(
    title_id: str, user_agent: str, normalized_type: str
) -> tuple[int | None, int | None, int | None, int | None, str | None]:
    """Get metadata for a title, using cache if available."""
    with get_db_context() as conn:
        migrate_db(conn)
        cached = metadata_cache_get(conn, title_id)
        if cached is not None:
            return cached
        try:
            metadata = _fetch_metadata(title_id, user_agent, normalized_type)
        except requests.RequestException:
            metadata = (None, None, None, None, None)
        metadata_cache_set(conn, title_id, *metadata)
        conn.commit()
        return metadata


def _fetch_ratings(title_id: str, user_agent: str) -> tuple[str | None, str | None]:
    """Fetch IMDB and Rotten Tomatoes ratings."""
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
    """Get ratings for a title, using cache if available."""
    with get_db_context() as conn:
        cached = rating_cache_get(conn, title_id)
        if cached is not None:
            return cached
        try:
            imdb_rating, rotten_rating = _fetch_ratings(title_id, user_agent)
        except requests.RequestException:
            imdb_rating, rotten_rating = None, None
        rating_cache_set(conn, title_id, imdb_rating, rotten_rating)
        conn.commit()
        return imdb_rating, rotten_rating


def get_rating(title_id: str, user_agent: str) -> str | None:
    """Get IMDB rating for a title."""
    imdb_rating, _ = get_ratings(title_id, user_agent)
    return imdb_rating


def get_rotten_tomatoes(title_id: str, user_agent: str) -> str | None:
    """Get Rotten Tomatoes rating for a title."""
    _, rotten_rating = get_ratings(title_id, user_agent)
    return rotten_rating


def parse_suggestion_item(
    item: dict[str, Any], user_agent: str, include_details: bool = True
) -> SearchResult | None:
    """Parse an IMDB suggestion item into a SearchResult."""
    title_id = item.get("id")
    if not title_id:
        return None
    type_label = item.get("qid") or item.get("q")
    normalized_type = normalize_type_label(type_label)
    if normalized_type not in ALLOWED_TYPE_LABELS:
        return None
    image_url = item.get("i", {}).get("imageUrl")
    runtime_minutes = total_seasons = total_episodes = avg_episode_length = None
    original_language = None
    rating = rotten_tomatoes = None
    if include_details:
        (
            runtime_minutes,
            total_seasons,
            total_episodes,
            avg_episode_length,
            original_language,
        ) = get_metadata(title_id, user_agent, normalized_type)
        rating, rotten_tomatoes = get_ratings(title_id, user_agent)
    return SearchResult(
        title_id=title_id,
        title=item.get("l") or "Untitled",
        year=str(item.get("y")) if item.get("y") else None,
        original_language=original_language,
        type_label=type_label,
        image=shrink_image_url(image_url),
        rating=rating,
        rotten_tomatoes=rotten_tomatoes,
        runtime_minutes=runtime_minutes,
        total_seasons=total_seasons,
        total_episodes=total_episodes,
        avg_episode_length=avg_episode_length,
    )


def fetch_suggestions(query: str, user_agent: str) -> list[SearchResult]:
    """Fetch search suggestions from IMDB."""
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
    """Fetch a single title by its IMDB ID."""
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
    """Fetch trending titles from IMDB."""
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


def refresh_title_details(
    title_id: str, user_agent: str, normalized_type: str
) -> tuple[str | None, str | None, int | None, int | None, int | None, int | None, str | None]:
    """Refresh details for a title (ratings and metadata)."""
    try:
        imdb_rating, rotten_rating = _fetch_ratings(title_id, user_agent)
    except requests.RequestException:
        imdb_rating, rotten_rating = None, None
    try:
        (
            runtime_minutes,
            total_seasons,
            total_episodes,
            avg_episode_length,
            original_language,
        ) = _fetch_metadata(title_id, user_agent, normalized_type)
    except requests.RequestException:
        runtime_minutes = total_seasons = total_episodes = avg_episode_length = original_language = None
    with get_db_context() as conn:
        rating_cache_set(conn, title_id, imdb_rating, rotten_rating)
        metadata_cache_set(
            conn, title_id, runtime_minutes, total_seasons, total_episodes, avg_episode_length, original_language
        )
        conn.commit()
    return (
        imdb_rating,
        rotten_rating,
        runtime_minutes,
        total_seasons,
        total_episodes,
        avg_episode_length,
        original_language,
    )
