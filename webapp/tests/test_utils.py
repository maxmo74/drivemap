"""Tests for utility functions."""
from __future__ import annotations

from webapp.utils import default_room, parse_watched, sanitize_room, serialize_result
from webapp.models import SearchResult


class TestSanitizeRoom:
    """Tests for sanitize_room function."""

    def test_sanitize_lowercase(self):
        """Test sanitization lowercases."""
        assert sanitize_room("MYROOM") == "myroom"

    def test_sanitize_removes_special_chars(self):
        """Test sanitization removes special characters."""
        assert sanitize_room("my_room!@#") == "myroom"

    def test_sanitize_allows_hyphen(self):
        """Test sanitization allows hyphens."""
        assert sanitize_room("my-room") == "my-room"

    def test_sanitize_allows_numbers(self):
        """Test sanitization allows numbers."""
        assert sanitize_room("room123") == "room123"

    def test_sanitize_strips_whitespace(self):
        """Test sanitization strips whitespace."""
        assert sanitize_room("  myroom  ") == "myroom"

    def test_sanitize_empty(self):
        """Test sanitization of empty string."""
        assert sanitize_room("") == ""

    def test_sanitize_none(self):
        """Test sanitization of None."""
        assert sanitize_room(None) == ""


class TestDefaultRoom:
    """Tests for default_room function."""

    def test_default_room_length(self):
        """Test default room has correct length."""
        room = default_room()
        assert len(room) == 10

    def test_default_room_unique(self):
        """Test default rooms are unique."""
        rooms = [default_room() for _ in range(100)]
        assert len(set(rooms)) == 100

    def test_default_room_alphanumeric(self):
        """Test default room is alphanumeric."""
        room = default_room()
        assert room.isalnum()


class TestParseWatched:
    """Tests for parse_watched function."""

    def test_parse_boolean_true(self):
        """Test parsing True."""
        assert parse_watched(True) == 1

    def test_parse_boolean_false(self):
        """Test parsing False."""
        assert parse_watched(False) == 0

    def test_parse_int_one(self):
        """Test parsing 1."""
        assert parse_watched(1) == 1

    def test_parse_int_zero(self):
        """Test parsing 0."""
        assert parse_watched(0) == 0

    def test_parse_string_true(self):
        """Test parsing 'true'."""
        assert parse_watched("true") == 1
        assert parse_watched("True") == 1
        assert parse_watched("TRUE") == 1

    def test_parse_string_false(self):
        """Test parsing 'false'."""
        assert parse_watched("false") == 0
        assert parse_watched("False") == 0

    def test_parse_string_one(self):
        """Test parsing '1'."""
        assert parse_watched("1") == 1

    def test_parse_string_zero(self):
        """Test parsing '0'."""
        assert parse_watched("0") == 0

    def test_parse_string_yes(self):
        """Test parsing 'yes'."""
        assert parse_watched("yes") == 1

    def test_parse_string_watched(self):
        """Test parsing 'watched'."""
        assert parse_watched("watched") == 1

    def test_parse_none(self):
        """Test parsing None."""
        assert parse_watched(None) == 0


class TestSerializeResult:
    """Tests for serialize_result function."""

    def test_serialize_full_result(self):
        """Test serializing a full SearchResult."""
        result = SearchResult(
            title_id="tt1234567",
            title="Test Movie",
            year="2024",
            original_language="English",
            type_label="movie",
            image="https://example.com/image.jpg",
            rating="8.5",
            rotten_tomatoes="90%",
            runtime_minutes=120,
            total_seasons=None,
            total_episodes=None,
            avg_episode_length=None,
        )
        serialized = serialize_result(result)

        assert serialized["title_id"] == "tt1234567"
        assert serialized["title"] == "Test Movie"
        assert serialized["year"] == "2024"
        assert serialized["original_language"] == "English"
        assert serialized["type_label"] == "movie"
        assert serialized["image"] == "https://example.com/image.jpg"
        assert serialized["rating"] == "8.5"
        assert serialized["rotten_tomatoes"] == "90%"
        assert serialized["runtime_minutes"] == 120
        assert serialized["total_seasons"] is None
        assert serialized["total_episodes"] is None
        assert serialized["avg_episode_length"] is None

    def test_serialize_minimal_result(self):
        """Test serializing a minimal SearchResult."""
        result = SearchResult(
            title_id="tt0000001",
            title="Minimal",
            year=None,
            original_language=None,
            type_label=None,
            image=None,
            rating=None,
            rotten_tomatoes=None,
            runtime_minutes=None,
            total_seasons=None,
            total_episodes=None,
            avg_episode_length=None,
        )
        serialized = serialize_result(result)

        assert serialized["title_id"] == "tt0000001"
        assert serialized["title"] == "Minimal"
        assert serialized["year"] is None
