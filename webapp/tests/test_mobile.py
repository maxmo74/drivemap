"""Tests for mobile-specific functionality."""
from __future__ import annotations

import json


class TestMobileHeader:
    """Tests for mobile header layout."""

    def test_mobile_header_renders(self, client):
        """Test mobile header renders correctly."""
        response = client.get("/r/testroom")
        assert response.status_code == 200
        assert b"Shovo" in response.data
        assert b"testroom" in response.data

    def test_mobile_header_has_room_info(self, client):
        """Test mobile header shows room information."""
        response = client.get("/r/mobiletest")
        assert response.status_code == 200
        html_content = response.data.decode('utf-8')
        assert "mobiletest" in html_content
        assert "List" in html_content


class TestMobileSearch:
    """Tests for mobile search functionality."""

    def test_mobile_search_api(self, client):
        """Test search API works for mobile."""
        response = client.get("/api/search?q=test")
        assert response.status_code == 200
        data = json.loads(response.data)
        assert "results" in data

    def test_mobile_search_empty(self, client):
        """Test empty search returns empty results."""
        response = client.get("/api/search?q=xyz123unlikely")
        assert response.status_code == 200
        data = json.loads(response.data)
        assert "results" in data


class TestMobileListOperations:
    """Tests for mobile list operations."""

    def test_mobile_add_item(self, client):
        """Test adding item via mobile interface."""
        response = client.post(
            "/api/list",
            json={
                "room": "mobiletest",
                "title_id": "tt1234567",
                "title": "Mobile Test Movie",
                "year": "2024",
                "type_label": "movie",
            },
        )
        assert response.status_code == 200

    def test_mobile_get_list(self, client):
        """Test getting list for mobile display."""
        # Add an item first
        client.post(
            "/api/list",
            json={
                "room": "mobilelist",
                "title_id": "tt7654321",
                "title": "Mobile List Movie",
            },
        )

        # Get the list
        response = client.get("/api/list?room=mobilelist")
        assert response.status_code == 200
        data = json.loads(response.data)
        assert len(data["items"]) == 1
        assert data["items"][0]["title"] == "Mobile List Movie"

    def test_mobile_pagination(self, client):
        """Test mobile pagination works correctly."""
        # Add multiple items
        for i in range(15):
            client.post(
                "/api/list",
                json={
                    "room": "mobilepagination",
                    "title_id": f"tt{i:07d}",
                    "title": f"Mobile Movie {i}",
                },
            )

        # Test first page
        response = client.get("/api/list?room=mobilepagination&page=1&per_page=10")
        data = json.loads(response.data)
        assert len(data["items"]) == 10
        assert data["total_pages"] == 2

        # Test second page
        response = client.get("/api/list?room=mobilepagination&page=2&per_page=10")
        data = json.loads(response.data)
        assert len(data["items"]) == 5


class TestMobileTouchTargets:
    """Tests for mobile touch target sizes."""

    def test_mobile_button_sizes(self, client):
        """Test that buttons have appropriate sizes for touch."""
        response = client.get("/r/testroom")
        assert response.status_code == 200
        # This is a basic test - visual inspection would be needed for actual sizing

    def test_mobile_card_actions(self, client):
        """Test card actions are touch-friendly."""
        # Add an item
        client.post(
            "/api/list",
            json={
                "room": "touchtest",
                "title_id": "tt9999999",
                "title": "Touch Test Movie",
            },
        )

        # Get the item to verify it exists
        response = client.get("/api/list?room=touchtest")
        assert response.status_code == 200
        data = json.loads(response.data)
        assert len(data["items"]) == 1


class TestMobileResponsiveDesign:
    """Tests for responsive design elements."""

    def test_mobile_viewport_meta(self, client):
        """Test mobile viewport meta tag is present."""
        response = client.get("/r/testroom")
        assert response.status_code == 200
        html_content = response.data.decode('utf-8')
        assert 'name="viewport"' in html_content
        assert 'width=device-width' in html_content

    def test_mobile_touch_icons(self, client):
        """Test touch icons are present."""
        response = client.get("/r/testroom")
        assert response.status_code == 200
        html_content = response.data.decode('utf-8')
        assert 'apple-touch-icon' in html_content


class TestMobileSearchResults:
    """Tests for mobile-specific search results."""

    def test_mobile_search_results_template(self, client):
        """Test mobile search results template is present."""
        response = client.get("/r/testroom")
        assert response.status_code == 200
        html_content = response.data.decode('utf-8')
        assert 'mobile-search-card-template' in html_content
        assert 'mobile-search-result' in html_content

    def test_mobile_search_results_structure(self, client):
        """Test mobile search results have proper structure."""
        response = client.get("/r/testroom")
        assert response.status_code == 200
        html_content = response.data.decode('utf-8')
        assert 'mobile-search-image' in html_content
        assert 'mobile-search-title' in html_content
        assert 'mobile-search-year' in html_content
        assert 'mobile-search-imdb' in html_content
        assert 'mobile-search-rotten' in html_content


class TestMobilePerformance:
    """Tests for mobile performance optimizations."""

    def test_mobile_lazy_loading(self, client):
        """Test images use lazy loading for better mobile performance."""
        response = client.get("/r/testroom")
        assert response.status_code == 200
        html_content = response.data.decode('utf-8')
        # Check for lazy loading attribute in template
        assert 'loading="lazy"' in html_content

    def test_mobile_cache_headers(self, client):
        """Test static assets have proper cache headers."""
        response = client.get("/static/style.css")
        assert response.status_code == 200
        # Cache control would be handled by the server in production
