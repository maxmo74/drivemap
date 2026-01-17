"""Tests for external API functions."""
from __future__ import annotations

from webapp.external_api import normalize_type_label, shrink_image_url


class TestNormalizeTypeLabel:
    """Tests for normalize_type_label function."""

    def test_normalize_movie(self):
        """Test normalizing movie type."""
        assert normalize_type_label("movie") == "movie"
        assert normalize_type_label("Movie") == "movie"
        assert normalize_type_label("MOVIE") == "movie"

    def test_normalize_tvseries(self):
        """Test normalizing TV series type."""
        assert normalize_type_label("tvSeries") == "tvseries"
        assert normalize_type_label("TV Series") == "tvseries"

    def test_normalize_feature(self):
        """Test normalizing feature type."""
        assert normalize_type_label("feature") == "feature"
        assert normalize_type_label("Feature") == "feature"

    def test_normalize_empty(self):
        """Test normalizing empty string."""
        assert normalize_type_label("") == ""

    def test_normalize_none(self):
        """Test normalizing None."""
        assert normalize_type_label(None) == ""

    def test_normalize_removes_non_alpha(self):
        """Test normalization removes non-alphabetic characters."""
        assert normalize_type_label("tv-series") == "tvseries"
        assert normalize_type_label("tv_movie") == "tvmovie"


class TestShrinkImageUrl:
    """Tests for shrink_image_url function."""

    def test_shrink_standard_url(self):
        """Test shrinking a standard IMDB image URL."""
        url = "https://m.media-amazon.com/images/M/test._V1_SX300.jpg"
        result = shrink_image_url(url)
        assert "_V1_UX120_CR0,0,120,180_AL_" in result
        assert result.endswith(".jpg")

    def test_shrink_png_url(self):
        """Test shrinking a PNG URL."""
        url = "https://m.media-amazon.com/images/M/test._V1_SX300.png"
        result = shrink_image_url(url)
        assert "_V1_UX120_CR0,0,120,180_AL_" in result
        assert result.endswith(".png")

    def test_shrink_none(self):
        """Test shrinking None."""
        assert shrink_image_url(None) is None

    def test_shrink_empty(self):
        """Test shrinking empty string."""
        assert shrink_image_url("") is None

    def test_shrink_non_imdb_url(self):
        """Test shrinking non-IMDB URL returns unchanged."""
        url = "https://example.com/image.jpg"
        assert shrink_image_url(url) == url
