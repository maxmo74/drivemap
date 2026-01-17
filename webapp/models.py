from __future__ import annotations

from dataclasses import dataclass


@dataclass
class SearchResult:
    title_id: str
    title: str
    year: str | None
    original_language: str | None
    type_label: str | None
    image: str | None
    rating: str | None
    rotten_tomatoes: str | None
    runtime_minutes: int | None
    total_seasons: int | None
    total_episodes: int | None
    avg_episode_length: int | None
