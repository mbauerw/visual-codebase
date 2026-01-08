"""
API endpoint tests for all routes in routes.py.

These tests cover:
- Authentication (valid/invalid tokens)
- Request validation
- Error handling (404, 401, 422)
- Response format verification
"""

import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi.testclient import TestClient

from app.main import app
from app.models.schemas import (
    AnalysisStatus,
    AnalysisStatusResponse,
)


# ==================== Fixtures ====================

@pytest.fixture
def client():
    """Create test client."""
    return TestClient(app)


@pytest.fixture
def mock_auth_user():
    """Mock authenticated user."""
    user = MagicMock()
    user.id = "test-user-123"
    user.email = "test@example.com"
    return user


# ==================== Health Check Tests ====================

class TestHealthEndpoint:
    """Test health check endpoint."""

    def test_health_check_returns_healthy(self, client):
        """Test that health check returns healthy status."""
        response = client.get("/api/health")
        assert response.status_code == 200
        assert response.json() == {"status": "healthy"}


# ==================== Authentication Tests ====================

class TestAuthentication:
    """Test authentication behavior across endpoints."""

    def test_user_analyses_requires_auth(self, client):
        """Test that /user/analyses requires authentication."""
        response = client.get("/api/user/analyses")
        assert response.status_code == 401
        assert "Authentication required" in response.json()["detail"]

    def test_delete_analysis_requires_auth(self, client):
        """Test that DELETE /analysis requires authentication."""
        response = client.delete("/api/analysis/some-id")
        assert response.status_code == 401

    def test_update_analysis_requires_auth(self, client):
        """Test that PATCH /analysis requires authentication."""
        response = client.patch("/api/analysis/some-id", json={"user_title": "New Title"})
        assert response.status_code == 401

    def test_github_repos_requires_auth(self, client):
        """Test that /github/repos requires authentication."""
        response = client.get("/api/github/repos")
        assert response.status_code == 401

    def test_tier_list_requires_auth(self, client):
        """Test that tier list endpoint requires authentication."""
        response = client.get("/api/analysis/some-id/functions/tier-list")
        assert response.status_code == 401

    def test_function_stats_requires_auth(self, client):
        """Test that function stats endpoint requires authentication."""
        response = client.get("/api/analysis/some-id/functions/stats")
        assert response.status_code == 401

    def test_file_content_requires_auth(self, client):
        """Test that file content endpoint requires authentication."""
        response = client.get("/api/analysis/some-id/file/node-1/content")
        assert response.status_code == 401

    def test_invalid_auth_header_format(self, client):
        """Test that invalid auth header format is rejected."""
        response = client.get(
            "/api/user/analyses",
            headers={"Authorization": "InvalidFormat token"}
        )
        assert response.status_code == 401
        assert "Invalid authorization header" in response.json()["detail"]

    def test_missing_bearer_prefix(self, client):
        """Test that auth header without Bearer prefix is rejected."""
        response = client.get(
            "/api/user/analyses",
            headers={"Authorization": "some-token"}
        )
        assert response.status_code == 401


# ==================== Request Validation Tests ====================

class TestRequestValidation:
    """Test request validation for analysis endpoints."""

    def test_analyze_requires_source(self, client):
        """Test that analysis request without source fails validation."""
        response = client.post("/api/analyze", json={})
        assert response.status_code == 422

    def test_analyze_cannot_have_both_sources(self, client):
        """Test that analysis request with both sources fails validation."""
        response = client.post(
            "/api/analyze",
            json={
                "directory_path": "/some/path",
                "github_repo": {"owner": "user", "repo": "repo"}
            }
        )
        assert response.status_code == 422

    def test_github_repo_invalid_owner(self, client):
        """Test that invalid GitHub owner is rejected."""
        response = client.post(
            "/api/analyze",
            json={
                "github_repo": {
                    "owner": "; rm -rf /",
                    "repo": "valid-repo"
                }
            }
        )
        assert response.status_code == 422

    def test_github_repo_invalid_repo_name(self, client):
        """Test that invalid GitHub repo name is rejected."""
        response = client.post(
            "/api/analyze",
            json={
                "github_repo": {
                    "owner": "valid-owner",
                    "repo": "$(whoami)"
                }
            }
        )
        assert response.status_code == 422

    def test_github_repo_dangerous_branch(self, client):
        """Test that dangerous branch names are rejected."""
        response = client.post(
            "/api/analyze",
            json={
                "github_repo": {
                    "owner": "valid-owner",
                    "repo": "valid-repo",
                    "branch": "; rm -rf /"
                }
            }
        )
        assert response.status_code == 422


# ==================== Analysis Status Tests ====================

class TestAnalysisStatus:
    """Test GET /api/analysis/{id}/status endpoint."""

    def test_get_status_not_found(self, client):
        """Test 404 when analysis not found."""
        with patch("app.api.routes.get_analysis_service") as mock_analysis:
            mock_service = MagicMock()
            mock_service.get_status.return_value = None
            mock_analysis.return_value = mock_service

            with patch("app.api.routes.get_database_service") as mock_db:
                mock_db_service = MagicMock()
                mock_db_service.get_analysis_status = AsyncMock(return_value=None)
                mock_db.return_value = mock_db_service

                response = client.get("/api/analysis/nonexistent/status")

                assert response.status_code == 404
                assert "not found" in response.json()["detail"].lower()

    def test_get_status_from_in_memory(self, client):
        """Test getting status from in-memory storage."""
        with patch("app.api.routes.get_analysis_service") as mock_analysis:
            mock_service = MagicMock()
            mock_service.get_status.return_value = AnalysisStatusResponse(
                analysis_id="test-123",
                status=AnalysisStatus.ANALYZING,
                current_step="Analyzing files...",
                total_files=50,
                progress=45,
            )
            mock_analysis.return_value = mock_service

            response = client.get("/api/analysis/test-123/status")

            assert response.status_code == 200
            data = response.json()
            assert data["analysis_id"] == "test-123"
            assert data["status"] == "analyzing"
            assert data["progress"] == 45


# ==================== Analysis Result Tests ====================

class TestAnalysisResult:
    """Test GET /api/analysis/{id} endpoint."""

    def test_get_result_not_found(self, client):
        """Test 404 when analysis not found."""
        with patch("app.api.routes.get_analysis_service") as mock_analysis:
            mock_service = MagicMock()
            mock_service.get_status.return_value = None
            mock_analysis.return_value = mock_service

            with patch("app.api.routes.get_database_service") as mock_db:
                mock_db_service = MagicMock()
                mock_db_service.get_analysis_result = AsyncMock(return_value=None)
                mock_db.return_value = mock_db_service

                response = client.get("/api/analysis/nonexistent")

                assert response.status_code == 404

    def test_get_result_in_progress(self, client):
        """Test 202 when analysis still in progress."""
        with patch("app.api.routes.get_analysis_service") as mock_analysis:
            mock_service = MagicMock()
            mock_service.get_status.return_value = AnalysisStatusResponse(
                analysis_id="test-123",
                status=AnalysisStatus.ANALYZING,
                current_step="Working...",
                total_files=50,
                progress=50,
            )
            mock_service.get_result.return_value = None
            mock_analysis.return_value = mock_service

            with patch("app.api.routes.get_database_service") as mock_db:
                mock_db_service = MagicMock()
                mock_db_service.get_analysis_result = AsyncMock(return_value=None)
                mock_db.return_value = mock_db_service

                response = client.get("/api/analysis/test-123")

                assert response.status_code == 202
                assert "still in progress" in response.json()["detail"].lower()

    def test_get_result_failed(self, client):
        """Test 500 when analysis failed."""
        with patch("app.api.routes.get_analysis_service") as mock_analysis:
            mock_service = MagicMock()
            mock_service.get_status.return_value = AnalysisStatusResponse(
                analysis_id="test-123",
                status=AnalysisStatus.FAILED,
                current_step="Failed",
                total_files=0,
                progress=0,
                error="Something went wrong",
            )
            mock_analysis.return_value = mock_service

            with patch("app.api.routes.get_database_service") as mock_db:
                mock_db_service = MagicMock()
                mock_db_service.get_analysis_result = AsyncMock(return_value=None)
                mock_db.return_value = mock_db_service

                response = client.get("/api/analysis/test-123")

                assert response.status_code == 500
                assert "failed" in response.json()["detail"].lower()


# ==================== GitHub Username Validation Tests ====================

class TestGitHubOwnerRepos:
    """Test GitHub owner repository endpoint validation."""

    @patch("app.auth.get_supabase_client")
    def test_invalid_github_username_rejected(self, mock_supabase, client, mock_auth_user):
        """Test that invalid GitHub usernames are rejected."""
        # Setup auth
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.user = mock_auth_user
        mock_client.auth.get_user.return_value = mock_response
        mock_supabase.return_value = mock_client

        # Test various invalid usernames
        invalid_usernames = [
            "--invalid",
            "invalid--",
            "-start",
            "end-",
            "in valid",
            "user;name",
            "a" * 40,  # Too long
        ]

        for username in invalid_usernames:
            response = client.get(
                f"/api/github/users/{username}/repos",
                headers={"Authorization": "Bearer valid-token"}
            )
            assert response.status_code == 400, f"Expected 400 for username: {username}"
            assert "Invalid GitHub username" in response.json()["detail"]


# ==================== GitHub Token Tests ====================

class TestGitHubReposEndpoint:
    """Test GitHub repos endpoint."""

    @patch("app.auth.get_supabase_client")
    def test_github_repos_requires_github_token(self, mock_supabase, client, mock_auth_user):
        """Test that GitHub token is required for /github/repos."""
        # Setup auth
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.user = mock_auth_user
        mock_client.auth.get_user.return_value = mock_response
        mock_supabase.return_value = mock_client

        response = client.get(
            "/api/github/repos",
            headers={"Authorization": "Bearer valid-token"}
            # No X-GitHub-Token header
        )

        assert response.status_code == 401
        assert "GitHub token required" in response.json()["detail"]


# ==================== User Analyses Tests ====================

class TestUserAnalyses:
    """Test GET /api/user/analyses endpoint."""

    @patch("app.auth.get_supabase_client")
    @patch("app.api.routes.get_database_service")
    def test_get_user_analyses_returns_list(
        self, mock_db, mock_supabase, client, mock_auth_user
    ):
        """Test that user analyses returns a list."""
        # Setup auth
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.user = mock_auth_user
        mock_client.auth.get_user.return_value = mock_response
        mock_supabase.return_value = mock_client

        # Setup db
        mock_db_service = MagicMock()
        mock_db_service.get_user_analyses = AsyncMock(return_value=[
            {"analysis_id": "test-1", "status": "completed"},
            {"analysis_id": "test-2", "status": "completed"},
        ])
        mock_db.return_value = mock_db_service

        response = client.get(
            "/api/user/analyses",
            headers={"Authorization": "Bearer valid-token"}
        )

        assert response.status_code == 200
        data = response.json()
        assert "analyses" in data
        assert len(data["analyses"]) == 2


# ==================== Delete Analysis Tests ====================

class TestDeleteAnalysis:
    """Test DELETE /api/analysis/{id} endpoint."""

    @patch("app.auth.get_supabase_client")
    @patch("app.api.routes.get_database_service")
    def test_delete_success(self, mock_db, mock_supabase, client, mock_auth_user):
        """Test successful analysis deletion."""
        # Setup auth
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.user = mock_auth_user
        mock_client.auth.get_user.return_value = mock_response
        mock_supabase.return_value = mock_client

        # Setup db
        mock_db_service = MagicMock()
        mock_db_service.delete_analysis = AsyncMock(return_value=True)
        mock_db.return_value = mock_db_service

        response = client.delete(
            "/api/analysis/test-123",
            headers={"Authorization": "Bearer valid-token"}
        )

        assert response.status_code == 200
        assert "deleted" in response.json()["message"].lower()

    @patch("app.auth.get_supabase_client")
    @patch("app.api.routes.get_database_service")
    def test_delete_not_found(self, mock_db, mock_supabase, client, mock_auth_user):
        """Test deleting non-existent analysis returns 404."""
        # Setup auth
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.user = mock_auth_user
        mock_client.auth.get_user.return_value = mock_response
        mock_supabase.return_value = mock_client

        # Setup db - returns False (not found)
        mock_db_service = MagicMock()
        mock_db_service.delete_analysis = AsyncMock(return_value=False)
        mock_db.return_value = mock_db_service

        response = client.delete(
            "/api/analysis/nonexistent",
            headers={"Authorization": "Bearer valid-token"}
        )

        assert response.status_code == 404


# ==================== Update Analysis Tests ====================

class TestUpdateAnalysis:
    """Test PATCH /api/analysis/{id} endpoint."""

    @patch("app.auth.get_supabase_client")
    @patch("app.api.routes.get_database_service")
    def test_update_title_success(self, mock_db, mock_supabase, client, mock_auth_user):
        """Test successful title update."""
        # Setup auth
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.user = mock_auth_user
        mock_client.auth.get_user.return_value = mock_response
        mock_supabase.return_value = mock_client

        # Setup db
        mock_db_service = MagicMock()
        mock_db_service.update_analysis_title = AsyncMock(return_value=True)
        mock_db.return_value = mock_db_service

        response = client.patch(
            "/api/analysis/test-123",
            json={"user_title": "My Custom Title"},
            headers={"Authorization": "Bearer valid-token"}
        )

        assert response.status_code == 200
        assert "updated" in response.json()["message"].lower()

    @patch("app.auth.get_supabase_client")
    @patch("app.api.routes.get_database_service")
    def test_update_not_found(self, mock_db, mock_supabase, client, mock_auth_user):
        """Test updating non-existent analysis returns 404."""
        # Setup auth
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.user = mock_auth_user
        mock_client.auth.get_user.return_value = mock_response
        mock_supabase.return_value = mock_client

        # Setup db - returns False
        mock_db_service = MagicMock()
        mock_db_service.update_analysis_title = AsyncMock(return_value=False)
        mock_db.return_value = mock_db_service

        response = client.patch(
            "/api/analysis/nonexistent",
            json={"user_title": "Title"},
            headers={"Authorization": "Bearer valid-token"}
        )

        assert response.status_code == 404


# ==================== Tier List Tests ====================

class TestTierListEndpoints:
    """Test function tier list endpoints."""

    @patch("app.auth.get_supabase_client")
    @patch("app.api.routes.get_database_service")
    def test_tier_list_not_found(self, mock_db, mock_supabase, client, mock_auth_user):
        """Test tier list for non-existent analysis."""
        # Setup auth
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.user = mock_auth_user
        mock_client.auth.get_user.return_value = mock_response
        mock_supabase.return_value = mock_client

        # Setup db - returns None
        mock_db_service = MagicMock()
        mock_db_service.get_tier_list = AsyncMock(return_value=None)
        mock_db.return_value = mock_db_service

        response = client.get(
            "/api/analysis/nonexistent/functions/tier-list",
            headers={"Authorization": "Bearer valid-token"}
        )

        assert response.status_code == 404

    @patch("app.auth.get_supabase_client")
    @patch("app.api.routes.get_database_service")
    def test_function_stats_not_found(self, mock_db, mock_supabase, client, mock_auth_user):
        """Test function stats for non-existent analysis."""
        # Setup auth
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.user = mock_auth_user
        mock_client.auth.get_user.return_value = mock_response
        mock_supabase.return_value = mock_client

        # Setup db - returns None
        mock_db_service = MagicMock()
        mock_db_service.get_function_stats = AsyncMock(return_value=None)
        mock_db.return_value = mock_db_service

        response = client.get(
            "/api/analysis/nonexistent/functions/stats",
            headers={"Authorization": "Bearer valid-token"}
        )

        assert response.status_code == 404

    @patch("app.auth.get_supabase_client")
    @patch("app.api.routes.get_database_service")
    def test_function_detail_not_found(self, mock_db, mock_supabase, client, mock_auth_user):
        """Test function detail for non-existent function."""
        # Setup auth
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.user = mock_auth_user
        mock_client.auth.get_user.return_value = mock_response
        mock_supabase.return_value = mock_client

        # Setup db - returns None
        mock_db_service = MagicMock()
        mock_db_service.get_function_detail = AsyncMock(return_value=None)
        mock_db.return_value = mock_db_service

        response = client.get(
            "/api/analysis/test-123/functions/nonexistent",
            headers={"Authorization": "Bearer valid-token"}
        )

        assert response.status_code == 404


# ==================== File Content Tests ====================

class TestFileContentEndpoint:
    """Test file content endpoint."""

    @patch("app.auth.get_supabase_client")
    @patch("app.api.routes.get_database_service")
    def test_file_content_not_found(self, mock_db, mock_supabase, client, mock_auth_user):
        """Test 404 for non-existent file content."""
        # Setup auth
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.user = mock_auth_user
        mock_client.auth.get_user.return_value = mock_response
        mock_supabase.return_value = mock_client

        # Setup db - returns None
        mock_db_service = MagicMock()
        mock_db_service.get_file_content = AsyncMock(return_value=None)
        mock_db.return_value = mock_db_service

        response = client.get(
            "/api/analysis/test-123/file/nonexistent/content",
            headers={"Authorization": "Bearer valid-token"}
        )

        assert response.status_code == 404
