"""
Integration tests for authentication flow.
Covers:
- User authentication → analysis → view results
- Token verification
- Permission enforcement (user isolation)
"""

import pytest
import tempfile
import shutil
from datetime import datetime
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.models.schemas import (
    AnalysisStatus,
    AnalyzeRequest,
    Language,
    ArchitecturalRole,
    Category,
    LLMFileAnalysis,
    ParsedFile,
    CodebaseSummary,
    TechStackInfo,
    ComplexityInfo,
    ModuleInfo,
)


# ==================== Fixtures ====================

@pytest.fixture
def test_client():
    """Create a FastAPI test client."""
    return TestClient(app)


@pytest.fixture
def mock_user():
    """Create a mock authenticated user."""
    user = MagicMock()
    user.id = "test-user-id-12345"
    user.email = "testuser@example.com"
    user.app_metadata = {}
    user.user_metadata = {"name": "Test User"}
    return user


@pytest.fixture
def mock_user_2():
    """Create a second mock user for testing isolation."""
    user = MagicMock()
    user.id = "other-user-id-67890"
    user.email = "otheruser@example.com"
    user.app_metadata = {}
    user.user_metadata = {"name": "Other User"}
    return user


@pytest.fixture
def temp_project():
    """Create a temporary project directory with sample files."""
    tmpdir = tempfile.mkdtemp()

    src_dir = Path(tmpdir) / "src"
    src_dir.mkdir()

    (src_dir / "App.tsx").write_text('''
import React from 'react';

export function App() {
    return <div>Hello</div>;
}
''')

    (src_dir / "utils.ts").write_text('''
export function helper() {
    return 'help';
}
''')

    yield tmpdir

    shutil.rmtree(tmpdir)


def create_mock_supabase_client():
    """Create a fully mocked Supabase client."""
    client = MagicMock()

    # Mock auth methods
    client.auth = MagicMock()
    client.auth.get_user = MagicMock()

    # Mock table methods with chainable interface
    def create_table_mock():
        table = MagicMock()
        table.select = MagicMock(return_value=table)
        table.insert = MagicMock(return_value=table)
        table.update = MagicMock(return_value=table)
        table.delete = MagicMock(return_value=table)
        table.eq = MagicMock(return_value=table)
        table.neq = MagicMock(return_value=table)
        table.ilike = MagicMock(return_value=table)
        table.order = MagicMock(return_value=table)
        table.range = MagicMock(return_value=table)
        table.limit = MagicMock(return_value=table)

        # Default execute response
        execute_result = MagicMock()
        execute_result.data = []
        execute_result.count = 0
        table.execute = MagicMock(return_value=execute_result)

        return table

    client.table = MagicMock(side_effect=lambda name: create_table_mock())

    return client


def create_mock_summary() -> CodebaseSummary:
    """Create a mock CodebaseSummary for testing."""
    return CodebaseSummary(
        project_type="web_app",
        primary_purpose="Test application",
        tech_stack=TechStackInfo(
            languages=["typescript"],
            frameworks=[],
            libraries=[],
            patterns=[],
        ),
        architecture_summary="Simple test architecture",
        key_modules=[
            ModuleInfo(name="App", purpose="Main application"),
        ],
        complexity_assessment=ComplexityInfo(
            level="simple",
            reasoning="Simple test project",
        ),
        notable_aspects=[],
    )


# ==================== Authentication Flow Tests ====================

@pytest.mark.integration
class TestAuthenticationFlow:
    """Integration tests for authentication flow."""

    def test_unauthenticated_request_blocked(self, test_client):
        """Test that protected endpoints block unauthenticated requests."""
        # Try to access user analyses without auth
        response = test_client.get("/api/user/analyses")
        assert response.status_code == 401

    def test_unauthenticated_delete_blocked(self, test_client):
        """Test that delete endpoint blocks unauthenticated requests."""
        response = test_client.delete("/api/analysis/some-id")
        assert response.status_code == 401

    def test_invalid_token_rejected(self, test_client, mock_user):
        """Test that invalid tokens are rejected."""
        with patch("app.auth.get_supabase_client") as mock_supabase:
            mock_client = create_mock_supabase_client()
            mock_client.auth.get_user.side_effect = Exception("Invalid token")
            mock_supabase.return_value = mock_client

            response = test_client.get(
                "/api/user/analyses",
                headers={"Authorization": "Bearer invalid-token"}
            )

            assert response.status_code == 401

    def test_valid_token_accepted(self, test_client, mock_user):
        """Test that valid tokens are accepted."""
        with patch("app.auth.get_supabase_client") as mock_supabase:
            mock_client = create_mock_supabase_client()
            user_response = MagicMock()
            user_response.user = mock_user
            mock_client.auth.get_user.return_value = user_response
            mock_supabase.return_value = mock_client

            with patch("app.api.routes.get_database_service") as mock_db:
                mock_db_instance = MagicMock()
                mock_db_instance.get_user_analyses = AsyncMock(return_value=[])
                mock_db.return_value = mock_db_instance

                response = test_client.get(
                    "/api/user/analyses",
                    headers={"Authorization": "Bearer valid-token"}
                )

                assert response.status_code == 200

    def test_missing_bearer_prefix_rejected(self, test_client):
        """Test that tokens without Bearer prefix are rejected."""
        response = test_client.get(
            "/api/user/analyses",
            headers={"Authorization": "just-a-token"}
        )

        assert response.status_code == 401

    def test_empty_auth_header_rejected(self, test_client):
        """Test that empty auth headers are rejected."""
        response = test_client.get(
            "/api/user/analyses",
            headers={"Authorization": ""}
        )

        assert response.status_code == 401


# ==================== User Analysis Flow Tests ====================

@pytest.mark.integration
class TestUserAnalysisFlow:
    """Integration tests for user analysis → view results flow."""

    @pytest.mark.asyncio
    async def test_authenticated_user_can_start_analysis(self, mock_user, temp_project):
        """Test that authenticated users can start an analysis."""
        transport = ASGITransport(app=app)

        async with AsyncClient(transport=transport, base_url="http://test") as client:
            with patch("app.auth.get_supabase_client") as mock_supabase:
                mock_sb_client = create_mock_supabase_client()
                user_response = MagicMock()
                user_response.user = mock_user
                mock_sb_client.auth.get_user.return_value = user_response
                mock_supabase.return_value = mock_sb_client

                with patch("app.api.routes.get_database_service") as mock_db:
                    mock_db_instance = MagicMock()
                    mock_db_instance.create_analysis = AsyncMock(return_value={"id": "db-id"})
                    mock_db_instance.complete_analysis = AsyncMock()
                    mock_db_instance.save_functions = AsyncMock()
                    mock_db_instance.save_function_calls = AsyncMock()
                    mock_db.return_value = mock_db_instance

                    # Also mock the database service in the analysis service module
                    with patch("app.services.database.get_database_service") as mock_db_service:
                        mock_db_service.return_value = mock_db_instance

                        response = await client.post(
                            "/api/analyze",
                            json={"directory_path": temp_project},
                            headers={"Authorization": "Bearer valid-token"}
                        )

                        assert response.status_code == 200
                        data = response.json()
                        assert "analysis_id" in data

    @pytest.mark.asyncio
    async def test_anonymous_user_can_start_analysis(self, temp_project):
        """Test that anonymous users can start an analysis (without persistence)."""
        transport = ASGITransport(app=app)

        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/analyze",
                json={"directory_path": temp_project}
            )

            assert response.status_code == 200
            data = response.json()
            assert "analysis_id" in data

    @pytest.mark.asyncio
    async def test_user_can_view_their_analyses(self, mock_user):
        """Test that users can view their own analyses."""
        transport = ASGITransport(app=app)

        async with AsyncClient(transport=transport, base_url="http://test") as client:
            with patch("app.auth.get_supabase_client") as mock_supabase:
                mock_sb_client = create_mock_supabase_client()
                user_response = MagicMock()
                user_response.user = mock_user
                mock_sb_client.auth.get_user.return_value = user_response
                mock_supabase.return_value = mock_sb_client

                with patch("app.api.routes.get_database_service") as mock_db:
                    mock_db_instance = MagicMock()
                    mock_db_instance.get_user_analyses = AsyncMock(return_value=[
                        {
                            "analysis_id": "analysis-1",
                            "status": "completed",
                            "directory_path": "/path/to/project",
                        }
                    ])
                    mock_db.return_value = mock_db_instance

                    response = await client.get(
                        "/api/user/analyses",
                        headers={"Authorization": "Bearer valid-token"}
                    )

                    assert response.status_code == 200
                    data = response.json()
                    assert "analyses" in data
                    assert len(data["analyses"]) == 1


# ==================== Permission Enforcement Tests ====================

@pytest.mark.integration
class TestPermissionEnforcement:
    """Integration tests for permission enforcement."""

    def test_user_can_delete_own_analysis(self, test_client, mock_user):
        """Test that users can delete their own analyses."""
        with patch("app.auth.get_supabase_client") as mock_supabase:
            mock_sb_client = create_mock_supabase_client()
            user_response = MagicMock()
            user_response.user = mock_user
            mock_sb_client.auth.get_user.return_value = user_response
            mock_supabase.return_value = mock_sb_client

            with patch("app.api.routes.get_database_service") as mock_db:
                mock_db_instance = MagicMock()
                mock_db_instance.delete_analysis = AsyncMock(return_value=True)
                mock_db.return_value = mock_db_instance

                response = test_client.delete(
                    "/api/analysis/my-analysis-id",
                    headers={"Authorization": "Bearer valid-token"}
                )

                assert response.status_code == 200
                mock_db_instance.delete_analysis.assert_called_once_with(
                    "my-analysis-id", mock_user.id
                )

    def test_user_cannot_delete_other_user_analysis(self, test_client, mock_user):
        """Test that users cannot delete another user's analysis."""
        with patch("app.auth.get_supabase_client") as mock_supabase:
            mock_sb_client = create_mock_supabase_client()
            user_response = MagicMock()
            user_response.user = mock_user
            mock_sb_client.auth.get_user.return_value = user_response
            mock_supabase.return_value = mock_sb_client

            with patch("app.api.routes.get_database_service") as mock_db:
                mock_db_instance = MagicMock()
                # Return False to simulate not finding/not owning the analysis
                mock_db_instance.delete_analysis = AsyncMock(return_value=False)
                mock_db.return_value = mock_db_instance

                response = test_client.delete(
                    "/api/analysis/other-user-analysis-id",
                    headers={"Authorization": "Bearer valid-token"}
                )

                assert response.status_code == 404

    def test_user_can_update_own_analysis(self, test_client, mock_user):
        """Test that users can update their own analysis title."""
        with patch("app.auth.get_supabase_client") as mock_supabase:
            mock_sb_client = create_mock_supabase_client()
            user_response = MagicMock()
            user_response.user = mock_user
            mock_sb_client.auth.get_user.return_value = user_response
            mock_supabase.return_value = mock_sb_client

            with patch("app.api.routes.get_database_service") as mock_db:
                mock_db_instance = MagicMock()
                mock_db_instance.update_analysis_title = AsyncMock(return_value=True)
                mock_db.return_value = mock_db_instance

                response = test_client.patch(
                    "/api/analysis/my-analysis-id",
                    json={"user_title": "My New Title"},
                    headers={"Authorization": "Bearer valid-token"}
                )

                assert response.status_code == 200

    def test_user_cannot_update_other_user_analysis(self, test_client, mock_user):
        """Test that users cannot update another user's analysis."""
        with patch("app.auth.get_supabase_client") as mock_supabase:
            mock_sb_client = create_mock_supabase_client()
            user_response = MagicMock()
            user_response.user = mock_user
            mock_sb_client.auth.get_user.return_value = user_response
            mock_supabase.return_value = mock_sb_client

            with patch("app.api.routes.get_database_service") as mock_db:
                mock_db_instance = MagicMock()
                # Return False to simulate not finding/not owning
                mock_db_instance.update_analysis_title = AsyncMock(return_value=False)
                mock_db.return_value = mock_db_instance

                response = test_client.patch(
                    "/api/analysis/other-user-analysis-id",
                    json={"user_title": "Hacked Title"},
                    headers={"Authorization": "Bearer valid-token"}
                )

                assert response.status_code == 404

    def test_file_content_requires_ownership(self, test_client, mock_user):
        """Test that file content access requires analysis ownership."""
        with patch("app.auth.get_supabase_client") as mock_supabase:
            mock_sb_client = create_mock_supabase_client()
            user_response = MagicMock()
            user_response.user = mock_user
            mock_sb_client.auth.get_user.return_value = user_response
            mock_supabase.return_value = mock_sb_client

            with patch("app.api.routes.get_database_service") as mock_db:
                mock_db_instance = MagicMock()
                # Return None to simulate not owning the analysis
                mock_db_instance.get_file_content = AsyncMock(return_value=None)
                mock_db.return_value = mock_db_instance

                response = test_client.get(
                    "/api/analysis/other-analysis/file/some-node/content",
                    headers={"Authorization": "Bearer valid-token"}
                )

                assert response.status_code == 404

    def test_tier_list_requires_ownership(self, test_client, mock_user):
        """Test that tier list access requires analysis ownership."""
        with patch("app.auth.get_supabase_client") as mock_supabase:
            mock_sb_client = create_mock_supabase_client()
            user_response = MagicMock()
            user_response.user = mock_user
            mock_sb_client.auth.get_user.return_value = user_response
            mock_supabase.return_value = mock_sb_client

            with patch("app.api.routes.get_database_service") as mock_db:
                mock_db_instance = MagicMock()
                # Return None to simulate not owning
                mock_db_instance.get_tier_list = AsyncMock(return_value=None)
                mock_db.return_value = mock_db_instance

                response = test_client.get(
                    "/api/analysis/other-analysis/functions/tier-list",
                    headers={"Authorization": "Bearer valid-token"}
                )

                assert response.status_code == 404


# ==================== Token Verification Tests ====================

@pytest.mark.integration
class TestTokenVerification:
    """Integration tests for token verification."""

    def test_token_extraction_from_header(self, test_client, mock_user):
        """Test that token is correctly extracted from Authorization header."""
        with patch("app.auth.get_supabase_client") as mock_supabase:
            mock_sb_client = create_mock_supabase_client()
            user_response = MagicMock()
            user_response.user = mock_user
            mock_sb_client.auth.get_user.return_value = user_response
            mock_supabase.return_value = mock_sb_client

            with patch("app.api.routes.get_database_service") as mock_db:
                mock_db_instance = MagicMock()
                mock_db_instance.get_user_analyses = AsyncMock(return_value=[])
                mock_db.return_value = mock_db_instance

                test_client.get(
                    "/api/user/analyses",
                    headers={"Authorization": "Bearer my-special-token"}
                )

                # Verify the token was passed to Supabase
                mock_sb_client.auth.get_user.assert_called_once_with("my-special-token")

    def test_expired_token_rejected(self, test_client):
        """Test that expired tokens are rejected."""
        with patch("app.auth.get_supabase_client") as mock_supabase:
            mock_sb_client = create_mock_supabase_client()
            mock_sb_client.auth.get_user.side_effect = Exception("Token expired")
            mock_supabase.return_value = mock_sb_client

            response = test_client.get(
                "/api/user/analyses",
                headers={"Authorization": "Bearer expired-token"}
            )

            assert response.status_code == 401
            assert "Authentication error" in response.json()["detail"]


# ==================== User Isolation Tests ====================

@pytest.mark.integration
class TestUserIsolation:
    """Integration tests for user isolation (RLS simulation)."""

    def test_get_analyses_only_returns_user_analyses(self, test_client, mock_user):
        """Test that get_analyses only returns the requesting user's analyses."""
        with patch("app.auth.get_supabase_client") as mock_supabase:
            mock_sb_client = create_mock_supabase_client()
            user_response = MagicMock()
            user_response.user = mock_user
            mock_sb_client.auth.get_user.return_value = user_response
            mock_supabase.return_value = mock_sb_client

            with patch("app.api.routes.get_database_service") as mock_db:
                mock_db_instance = MagicMock()
                # Simulate that get_user_analyses is called with correct user_id
                mock_db_instance.get_user_analyses = AsyncMock(return_value=[
                    {"analysis_id": "user-analysis-1"},
                    {"analysis_id": "user-analysis-2"},
                ])
                mock_db.return_value = mock_db_instance

                response = test_client.get(
                    "/api/user/analyses",
                    headers={"Authorization": "Bearer valid-token"}
                )

                assert response.status_code == 200
                # Verify get_user_analyses was called with correct user_id
                mock_db_instance.get_user_analyses.assert_called_once_with(mock_user.id)

    def test_delete_verifies_ownership(self, test_client, mock_user, mock_user_2):
        """Test that delete operation verifies ownership."""
        with patch("app.auth.get_supabase_client") as mock_supabase:
            mock_sb_client = create_mock_supabase_client()
            user_response = MagicMock()
            user_response.user = mock_user
            mock_sb_client.auth.get_user.return_value = user_response
            mock_supabase.return_value = mock_sb_client

            with patch("app.api.routes.get_database_service") as mock_db:
                mock_db_instance = MagicMock()
                mock_db_instance.delete_analysis = AsyncMock(return_value=True)
                mock_db.return_value = mock_db_instance

                test_client.delete(
                    "/api/analysis/test-analysis-id",
                    headers={"Authorization": "Bearer valid-token"}
                )

                # Verify delete_analysis was called with both analysis_id and user_id
                mock_db_instance.delete_analysis.assert_called_once_with(
                    "test-analysis-id",
                    mock_user.id
                )


# ==================== Optional Auth Tests ====================

@pytest.mark.integration
class TestOptionalAuth:
    """Integration tests for endpoints with optional authentication."""

    @pytest.mark.asyncio
    async def test_analysis_result_accessible_without_auth(self, temp_project):
        """Test that analysis results can be accessed without auth (in-memory)."""
        transport = ASGITransport(app=app)

        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # Start analysis without auth
            response = await client.post(
                "/api/analyze",
                json={"directory_path": temp_project}
            )

            assert response.status_code == 200
            analysis_id = response.json()["analysis_id"]

            # Status should be accessible
            response = await client.get(f"/api/analysis/{analysis_id}/status")
            assert response.status_code == 200

    def test_health_check_no_auth_required(self, test_client):
        """Test that health check doesn't require authentication."""
        response = test_client.get("/api/health")
        assert response.status_code == 200
        assert response.json() == {"status": "healthy"}


# ==================== GitHub Token Tests ====================

@pytest.mark.integration
class TestGitHubTokenHandling:
    """Integration tests for GitHub token handling."""

    def test_github_repos_requires_token(self, test_client, mock_user):
        """Test that GitHub repos endpoint requires GitHub token."""
        with patch("app.auth.get_supabase_client") as mock_supabase:
            mock_sb_client = create_mock_supabase_client()
            user_response = MagicMock()
            user_response.user = mock_user
            mock_sb_client.auth.get_user.return_value = user_response
            mock_supabase.return_value = mock_sb_client

            response = test_client.get(
                "/api/github/repos",
                headers={"Authorization": "Bearer valid-token"}
                # Note: No X-GitHub-Token header
            )

            assert response.status_code == 401
            assert "GitHub token required" in response.json()["detail"]

    def test_github_repos_with_token(self, test_client, mock_user):
        """Test that GitHub repos endpoint works with GitHub token."""
        with patch("app.auth.get_supabase_client") as mock_supabase:
            mock_sb_client = create_mock_supabase_client()
            user_response = MagicMock()
            user_response.user = mock_user
            mock_sb_client.auth.get_user.return_value = user_response
            mock_supabase.return_value = mock_sb_client

            # Patch GitHubService where it's imported in routes
            with patch("app.api.routes.GitHubService") as mock_github:
                mock_instance = MagicMock()
                mock_instance.list_user_repos = AsyncMock(return_value={
                    "repos": [{"name": "test-repo"}],
                    "total": 1,
                })
                mock_github.return_value = mock_instance

                response = test_client.get(
                    "/api/github/repos",
                    headers={
                        "Authorization": "Bearer valid-token",
                        "X-GitHub-Token": "ghp_test_token",
                    }
                )

                assert response.status_code == 200
