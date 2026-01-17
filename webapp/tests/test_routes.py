"""Tests for API routes."""
from __future__ import annotations

import json


class TestRootRoute:
    """Tests for root route."""

    def test_root_redirects_to_new(self, client):
        """Test root redirects to /r/new."""
        response = client.get("/")
        assert response.status_code == 302
        assert "/r/" in response.location

    def test_new_room_redirects_to_generated(self, client):
        """Test /r/new generates a new room."""
        response = client.get("/r/new")
        assert response.status_code == 302
        assert "/r/" in response.location
        assert response.location != "/r/new"


class TestRoomRoute:
    """Tests for room route."""

    def test_room_renders_template(self, client):
        """Test room page renders successfully."""
        response = client.get("/r/testroom")
        assert response.status_code == 200
        assert b"Shovo" in response.data
        assert b"testroom" in response.data


class TestListAPI:
    """Tests for list API endpoints."""

    def test_get_list_requires_room(self, client):
        """Test GET /api/list requires room parameter."""
        response = client.get("/api/list")
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data["error"] == "missing_room"

    def test_get_list_empty(self, client):
        """Test GET /api/list returns empty for new room."""
        response = client.get("/api/list?room=emptyroom")
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data["items"] == []
        assert data["total_count"] == 0

    def test_add_item_requires_json(self, client):
        """Test POST /api/list requires JSON."""
        response = client.post("/api/list", data="not json")
        assert response.status_code == 400

    def test_add_item_requires_room(self, client):
        """Test POST /api/list requires room."""
        response = client.post(
            "/api/list",
            json={"title_id": "tt1234567", "title": "Test Movie"},
        )
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data["error"] == "missing_room"

    def test_add_item_requires_title(self, client):
        """Test POST /api/list requires title."""
        response = client.post(
            "/api/list",
            json={"room": "testroom", "title_id": "tt1234567"},
        )
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data["error"] == "missing_title"

    def test_add_and_get_item(self, client):
        """Test adding and retrieving an item."""
        # Add item
        add_response = client.post(
            "/api/list",
            json={
                "room": "testroom",
                "title_id": "tt1234567",
                "title": "Test Movie",
                "year": "2024",
                "type_label": "movie",
            },
        )
        assert add_response.status_code == 200

        # Get item
        get_response = client.get("/api/list?room=testroom")
        assert get_response.status_code == 200
        data = json.loads(get_response.data)
        assert len(data["items"]) == 1
        assert data["items"][0]["title"] == "Test Movie"
        assert data["items"][0]["title_id"] == "tt1234567"

    def test_add_watched_item(self, client):
        """Test adding an item as watched."""
        # Add watched item
        add_response = client.post(
            "/api/list",
            json={
                "room": "watchedroom",
                "title_id": "tt7654321",
                "title": "Watched Movie",
                "watched": True,
            },
        )
        assert add_response.status_code == 200

        # Get unwatched (should be empty)
        unwatched_response = client.get("/api/list?room=watchedroom&status=unwatched")
        assert unwatched_response.status_code == 200
        unwatched_data = json.loads(unwatched_response.data)
        assert len(unwatched_data["items"]) == 0

        # Get watched
        watched_response = client.get("/api/list?room=watchedroom&status=watched")
        assert watched_response.status_code == 200
        watched_data = json.loads(watched_response.data)
        assert len(watched_data["items"]) == 1

    def test_update_watched_status(self, client):
        """Test updating watched status."""
        # Add unwatched item
        client.post(
            "/api/list",
            json={
                "room": "updateroom",
                "title_id": "tt1111111",
                "title": "Update Test",
            },
        )

        # Mark as watched
        patch_response = client.patch(
            "/api/list",
            json={
                "room": "updateroom",
                "title_id": "tt1111111",
                "watched": 1,
            },
        )
        assert patch_response.status_code == 200

        # Verify it's in watched list
        watched_response = client.get("/api/list?room=updateroom&status=watched")
        watched_data = json.loads(watched_response.data)
        assert len(watched_data["items"]) == 1

    def test_delete_item(self, client):
        """Test deleting an item."""
        # Add item
        client.post(
            "/api/list",
            json={
                "room": "deleteroom",
                "title_id": "tt2222222",
                "title": "Delete Test",
            },
        )

        # Delete item
        delete_response = client.delete(
            "/api/list",
            json={
                "room": "deleteroom",
                "title_id": "tt2222222",
            },
        )
        assert delete_response.status_code == 200

        # Verify it's gone
        get_response = client.get("/api/list?room=deleteroom")
        get_data = json.loads(get_response.data)
        assert len(get_data["items"]) == 0

    def test_delete_requires_title_id(self, client):
        """Test DELETE /api/list requires title_id."""
        response = client.delete(
            "/api/list",
            json={"room": "testroom"},
        )
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data["error"] == "missing_title_id"


class TestOrderAPI:
    """Tests for order API."""

    def test_update_order(self, client):
        """Test updating item order."""
        # Add multiple items
        for i in range(3):
            client.post(
                "/api/list",
                json={
                    "room": "orderroom",
                    "title_id": f"tt000000{i}",
                    "title": f"Movie {i}",
                },
            )

        # Reorder
        order_response = client.patch(
            "/api/list/order",
            json={
                "room": "orderroom",
                "order": ["tt0000002", "tt0000001", "tt0000000"],
            },
        )
        assert order_response.status_code == 200

    def test_update_order_requires_list(self, client):
        """Test order update requires valid list."""
        response = client.patch(
            "/api/list/order",
            json={"room": "testroom", "order": []},
        )
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data["error"] == "invalid_order"


class TestRenameAPI:
    """Tests for rename API."""

    def test_rename_list(self, client):
        """Test renaming a list."""
        # Add item to original room
        client.post(
            "/api/list",
            json={
                "room": "originalroom",
                "title_id": "tt9999999",
                "title": "Rename Test",
            },
        )

        # Rename
        rename_response = client.patch(
            "/api/list/rename",
            json={
                "room": "originalroom",
                "next_room": "newroomname",
            },
        )
        assert rename_response.status_code == 200
        rename_data = json.loads(rename_response.data)
        assert rename_data["room"] == "newroomname"

        # Verify item is in new room
        get_response = client.get("/api/list?room=newroomname")
        get_data = json.loads(get_response.data)
        assert len(get_data["items"]) == 1

    def test_rename_to_existing_fails(self, client):
        """Test renaming to existing room fails."""
        # Create two rooms
        client.post(
            "/api/list",
            json={"room": "room1", "title_id": "tt1111111", "title": "Movie 1"},
        )
        client.post(
            "/api/list",
            json={"room": "room2", "title_id": "tt2222222", "title": "Movie 2"},
        )

        # Try to rename room1 to room2
        rename_response = client.patch(
            "/api/list/rename",
            json={"room": "room1", "next_room": "room2"},
        )
        assert rename_response.status_code == 409
        data = json.loads(rename_response.data)
        assert data["error"] == "room_exists"


class TestDetailsAPI:
    """Tests for details API."""

    def test_details_requires_title_id(self, client):
        """Test GET /api/details requires title_id."""
        response = client.get("/api/details")
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data["error"] == "missing_title_id"


class TestRefreshAPI:
    """Tests for refresh API."""

    def test_refresh_requires_room(self, client):
        """Test POST /api/refresh requires room."""
        response = client.post("/api/refresh", json={})
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data["error"] == "missing_room"

    def test_refresh_status_requires_room(self, client):
        """Test GET /api/refresh/status requires room."""
        response = client.get("/api/refresh/status")
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data["error"] == "missing_room"

    def test_refresh_status_returns_state(self, client):
        """Test refresh status returns state."""
        response = client.get("/api/refresh/status?room=testroom")
        assert response.status_code == 200
        data = json.loads(response.data)
        assert "refreshing" in data
        assert "processed" in data
        assert "total" in data


class TestPagination:
    """Tests for pagination."""

    def test_pagination(self, client):
        """Test list pagination."""
        # Add 15 items
        for i in range(15):
            client.post(
                "/api/list",
                json={
                    "room": "paginationroom",
                    "title_id": f"tt{i:07d}",
                    "title": f"Movie {i}",
                },
            )

        # Get first page
        page1_response = client.get("/api/list?room=paginationroom&page=1&per_page=10")
        page1_data = json.loads(page1_response.data)
        assert len(page1_data["items"]) == 10
        assert page1_data["total_count"] == 15
        assert page1_data["total_pages"] == 2

        # Get second page
        page2_response = client.get("/api/list?room=paginationroom&page=2&per_page=10")
        page2_data = json.loads(page2_response.data)
        assert len(page2_data["items"]) == 5
