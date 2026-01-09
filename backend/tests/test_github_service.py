"""
Tests for the GitHubService.
Covers git clone operations, credential handling, cleanup,
repo listing, and rate limit handling.
"""

import pytest
import tempfile
import os
import shutil
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch, call
import asyncio

from app.services.github import GitHubService, _sanitize_git_error
from app.models.schemas import GitHubRepoInfo


# ==================== Fixtures ====================

@pytest.fixture
def github_service():
    """Create a GitHubService with a test token."""
    return GitHubService(access_token="ghp_test_token_12345")


@pytest.fixture
def github_service_no_token():
    """Create a GitHubService without a token."""
    with patch("app.services.github.settings") as mock_settings:
        mock_settings.github_token = None
        return GitHubService(access_token=None)


@pytest.fixture
def sample_repo_info():
    """Create sample repository info."""
    return GitHubRepoInfo(
        owner="testuser",
        repo="test-repo",
        branch="main",
        path=None,
    )


@pytest.fixture
def temp_dir():
    """Create a temporary directory."""
    tmpdir = tempfile.mkdtemp()
    yield Path(tmpdir)
    # Cleanup
    if os.path.exists(tmpdir):
        shutil.rmtree(tmpdir)


# ==================== Token Sanitization Tests ====================

class TestTokenSanitization:
    """Tests for sanitizing tokens in error messages."""

    def test_sanitize_url_with_token(self):
        """Test sanitizing URL with embedded token."""
        error = "fatal: Authentication failed for 'https://ghp_abc123xyz@github.com/user/repo.git'"

        result = _sanitize_git_error(error)

        assert "ghp_abc123xyz" not in result
        assert "[REDACTED]" in result

    def test_sanitize_personal_access_token(self):
        """Test sanitizing personal access token pattern."""
        error = "Token ghp_abcdefghijklmnopqrstuvwxyz123456789012 is invalid"

        result = _sanitize_git_error(error)

        assert "ghp_" not in result or "[REDACTED]" in result

    def test_sanitize_oauth_token(self):
        """Test sanitizing OAuth token pattern."""
        error = "Token gho_abcdefghijklmnopqrstuvwxyz123456789012 expired"

        result = _sanitize_git_error(error)

        assert "gho_" not in result or "[REDACTED]" in result

    def test_sanitize_fine_grained_pat(self):
        """Test sanitizing fine-grained PAT pattern."""
        error = "Token github_pat_abcdefghijklmnopqrstuvwxyz is invalid"

        result = _sanitize_git_error(error)

        assert "github_pat_" not in result or "[REDACTED]" in result

    def test_sanitize_no_token_unchanged(self):
        """Test that messages without tokens are unchanged."""
        error = "Repository not found"

        result = _sanitize_git_error(error)

        assert result == error


# ==================== Clone Repository Tests ====================

class TestCloneRepository:
    """Tests for cloning repositories."""

    @pytest.mark.asyncio
    async def test_clone_success(self, github_service, sample_repo_info, temp_dir):
        """Test successful repository clone."""
        with patch("asyncio.create_subprocess_exec") as mock_exec:
            # Mock successful git clone
            mock_process = MagicMock()
            mock_process.returncode = 0
            mock_process.communicate = AsyncMock(return_value=(b"", b""))
            mock_exec.return_value = mock_process

            result = await github_service.clone_repository(sample_repo_info, temp_dir)

            assert result == temp_dir
            mock_exec.assert_called_once()

    @pytest.mark.asyncio
    async def test_clone_with_branch(self, github_service, temp_dir):
        """Test cloning with specific branch."""
        repo_info = GitHubRepoInfo(
            owner="testuser",
            repo="test-repo",
            branch="develop",
            path=None,
        )

        with patch("asyncio.create_subprocess_exec") as mock_exec:
            mock_process = MagicMock()
            mock_process.returncode = 0
            mock_process.communicate = AsyncMock(return_value=(b"", b""))
            mock_exec.return_value = mock_process

            await github_service.clone_repository(repo_info, temp_dir)

            # Verify branch argument was passed
            call_args = mock_exec.call_args
            assert "--branch" in call_args[0]
            assert "develop" in call_args[0]

    @pytest.mark.asyncio
    async def test_clone_with_subdirectory(self, github_service, temp_dir):
        """Test cloning and returning subdirectory path."""
        repo_info = GitHubRepoInfo(
            owner="testuser",
            repo="test-repo",
            branch="main",
            path="src",
        )

        # Create the subdirectory that would exist after clone
        (temp_dir / "src").mkdir()

        with patch("asyncio.create_subprocess_exec") as mock_exec:
            mock_process = MagicMock()
            mock_process.returncode = 0
            mock_process.communicate = AsyncMock(return_value=(b"", b""))
            mock_exec.return_value = mock_process

            result = await github_service.clone_repository(repo_info, temp_dir)

            assert result == temp_dir / "src"

    @pytest.mark.asyncio
    async def test_clone_subdirectory_not_exists(self, github_service, temp_dir):
        """Test error when subdirectory doesn't exist."""
        repo_info = GitHubRepoInfo(
            owner="testuser",
            repo="test-repo",
            branch="main",
            path="nonexistent",
        )

        with patch("asyncio.create_subprocess_exec") as mock_exec:
            mock_process = MagicMock()
            mock_process.returncode = 0
            mock_process.communicate = AsyncMock(return_value=(b"", b""))
            mock_exec.return_value = mock_process

            with pytest.raises(RuntimeError) as exc_info:
                await github_service.clone_repository(repo_info, temp_dir)

            assert "does not exist" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_clone_failure(self, github_service, sample_repo_info, temp_dir):
        """Test handling of clone failure."""
        with patch("asyncio.create_subprocess_exec") as mock_exec:
            mock_process = MagicMock()
            mock_process.returncode = 1
            mock_process.communicate = AsyncMock(
                return_value=(b"", b"fatal: repository not found")
            )
            mock_exec.return_value = mock_process

            with pytest.raises(RuntimeError) as exc_info:
                await github_service.clone_repository(sample_repo_info, temp_dir)

            assert "repository not found" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_clone_uses_shallow_clone(self, github_service, sample_repo_info, temp_dir):
        """Test that shallow clone is used."""
        with patch("asyncio.create_subprocess_exec") as mock_exec:
            mock_process = MagicMock()
            mock_process.returncode = 0
            mock_process.communicate = AsyncMock(return_value=(b"", b""))
            mock_exec.return_value = mock_process

            await github_service.clone_repository(sample_repo_info, temp_dir)

            call_args = mock_exec.call_args
            assert "--depth" in call_args[0]
            assert "1" in call_args[0]

    @pytest.mark.asyncio
    async def test_clone_uses_single_branch(self, github_service, sample_repo_info, temp_dir):
        """Test that single-branch is used."""
        with patch("asyncio.create_subprocess_exec") as mock_exec:
            mock_process = MagicMock()
            mock_process.returncode = 0
            mock_process.communicate = AsyncMock(return_value=(b"", b""))
            mock_exec.return_value = mock_process

            await github_service.clone_repository(sample_repo_info, temp_dir)

            call_args = mock_exec.call_args
            assert "--single-branch" in call_args[0]


# ==================== Credential Handling Tests ====================

class TestCredentialHandling:
    """Tests for secure credential handling."""

    @pytest.mark.asyncio
    async def test_askpass_script_created(self, github_service, sample_repo_info, temp_dir):
        """Test that GIT_ASKPASS script is created."""
        with patch("asyncio.create_subprocess_exec") as mock_exec:
            mock_process = MagicMock()
            mock_process.returncode = 0
            mock_process.communicate = AsyncMock(return_value=(b"", b""))
            mock_exec.return_value = mock_process

            await github_service.clone_repository(sample_repo_info, temp_dir)

            # Check that env was passed with GIT_ASKPASS
            call_kwargs = mock_exec.call_args.kwargs
            assert "env" in call_kwargs
            assert "GIT_ASKPASS" in call_kwargs["env"]

    @pytest.mark.asyncio
    async def test_askpass_script_cleanup(self, github_service, sample_repo_info, temp_dir):
        """Test that askpass script is cleaned up after clone."""
        askpass_scripts_before = set()

        def track_script(*args, **kwargs):
            if "env" in kwargs and "GIT_ASKPASS" in kwargs["env"]:
                askpass_scripts_before.add(kwargs["env"]["GIT_ASKPASS"])
            mock_process = MagicMock()
            mock_process.returncode = 0
            mock_process.communicate = AsyncMock(return_value=(b"", b""))
            return mock_process

        with patch("asyncio.create_subprocess_exec", side_effect=track_script):
            await github_service.clone_repository(sample_repo_info, temp_dir)

        # After clone completes, script should be deleted
        for script_path in askpass_scripts_before:
            assert not os.path.exists(script_path), f"Askpass script was not cleaned up: {script_path}"

    @pytest.mark.asyncio
    async def test_token_not_in_url(self, github_service, sample_repo_info, temp_dir):
        """Test that token is not embedded in clone URL."""
        with patch("asyncio.create_subprocess_exec") as mock_exec:
            mock_process = MagicMock()
            mock_process.returncode = 0
            mock_process.communicate = AsyncMock(return_value=(b"", b""))
            mock_exec.return_value = mock_process

            await github_service.clone_repository(sample_repo_info, temp_dir)

            # Check that token is not in the command arguments
            call_args = mock_exec.call_args[0]
            for arg in call_args:
                assert "ghp_" not in str(arg)
                assert github_service.access_token not in str(arg)

    @pytest.mark.asyncio
    async def test_clone_without_token(self, github_service_no_token, sample_repo_info, temp_dir):
        """Test cloning without a token (public repos)."""
        with patch("asyncio.create_subprocess_exec") as mock_exec:
            mock_process = MagicMock()
            mock_process.returncode = 0
            mock_process.communicate = AsyncMock(return_value=(b"", b""))
            mock_exec.return_value = mock_process

            await github_service_no_token.clone_repository(sample_repo_info, temp_dir)

            # GIT_ASKPASS should not be set when no token
            call_kwargs = mock_exec.call_args.kwargs
            if "env" in call_kwargs:
                assert "GIT_ASKPASS" not in call_kwargs["env"] or call_kwargs["env"].get("GIT_ASKPASS") is None


# ==================== Cleanup Tests ====================

class TestCleanup:
    """Tests for cleanup functionality."""

    def test_cleanup_existing_directory(self, temp_dir):
        """Test cleanup of existing directory."""
        # Create a file in the temp dir
        test_file = temp_dir / "test.txt"
        test_file.write_text("test")

        GitHubService.cleanup(temp_dir)

        assert not temp_dir.exists()

    def test_cleanup_nonexistent_directory(self):
        """Test cleanup of non-existent directory doesn't raise."""
        nonexistent = Path("/nonexistent/path/12345")

        # Should not raise
        GitHubService.cleanup(nonexistent)

    def test_cleanup_with_nested_files(self, temp_dir):
        """Test cleanup removes nested structure."""
        nested = temp_dir / "a" / "b" / "c"
        nested.mkdir(parents=True)
        (nested / "file.txt").write_text("content")

        GitHubService.cleanup(temp_dir)

        assert not temp_dir.exists()


# ==================== List User Repos Tests ====================

class TestListUserRepos:
    """Tests for listing user repositories."""

    @pytest.mark.asyncio
    async def test_list_user_repos_success(self, github_service):
        """Test successful repo listing."""
        mock_repos = [
            {"name": "repo1", "full_name": "user/repo1"},
            {"name": "repo2", "full_name": "user/repo2"},
        ]

        with patch("httpx.AsyncClient") as mock_client:
            mock_response = MagicMock()
            mock_response.json.return_value = mock_repos
            mock_response.headers = {"Link": ""}
            mock_response.raise_for_status = MagicMock()

            mock_instance = MagicMock()
            mock_instance.get = AsyncMock(return_value=mock_response)
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=None)
            mock_client.return_value = mock_instance

            result = await github_service.list_user_repos()

            assert result["total_count"] == 2
            assert len(result["repositories"]) == 2

    @pytest.mark.asyncio
    async def test_list_user_repos_pagination(self, github_service):
        """Test repo listing with pagination."""
        mock_repos = [{"name": "repo1"}]

        with patch("httpx.AsyncClient") as mock_client:
            mock_response = MagicMock()
            mock_response.json.return_value = mock_repos
            mock_response.headers = {"Link": '<...>; rel="next"'}
            mock_response.raise_for_status = MagicMock()

            mock_instance = MagicMock()
            mock_instance.get = AsyncMock(return_value=mock_response)
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=None)
            mock_client.return_value = mock_instance

            result = await github_service.list_user_repos(page=1)

            assert result["has_next_page"] is True
            assert result["next_page"] == 2

    @pytest.mark.asyncio
    async def test_list_user_repos_params(self, github_service):
        """Test that pagination params are passed correctly."""
        with patch("httpx.AsyncClient") as mock_client:
            mock_response = MagicMock()
            mock_response.json.return_value = []
            mock_response.headers = {}
            mock_response.raise_for_status = MagicMock()

            mock_instance = MagicMock()
            mock_instance.get = AsyncMock(return_value=mock_response)
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=None)
            mock_client.return_value = mock_instance

            await github_service.list_user_repos(
                page=2,
                per_page=50,
                sort="created",
                direction="asc"
            )

            call_kwargs = mock_instance.get.call_args.kwargs
            assert call_kwargs["params"]["page"] == 2
            assert call_kwargs["params"]["per_page"] == 50
            assert call_kwargs["params"]["sort"] == "created"
            assert call_kwargs["params"]["direction"] == "asc"

    @pytest.mark.asyncio
    async def test_list_user_repos_max_per_page(self, github_service):
        """Test that per_page is capped at 100."""
        with patch("httpx.AsyncClient") as mock_client:
            mock_response = MagicMock()
            mock_response.json.return_value = []
            mock_response.headers = {}
            mock_response.raise_for_status = MagicMock()

            mock_instance = MagicMock()
            mock_instance.get = AsyncMock(return_value=mock_response)
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=None)
            mock_client.return_value = mock_instance

            await github_service.list_user_repos(per_page=200)

            call_kwargs = mock_instance.get.call_args.kwargs
            assert call_kwargs["params"]["per_page"] == 100

    @pytest.mark.asyncio
    async def test_list_user_repos_error(self, github_service):
        """Test error handling for repo listing."""
        with patch("httpx.AsyncClient") as mock_client:
            mock_instance = MagicMock()
            mock_instance.get = AsyncMock(side_effect=Exception("API Error"))
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=None)
            mock_client.return_value = mock_instance

            with pytest.raises(RuntimeError) as exc_info:
                await github_service.list_user_repos()

            assert "Failed to fetch" in str(exc_info.value)


# ==================== List Owner Repos Tests ====================

class TestListOwnerRepos:
    """Tests for listing repos by owner."""

    @pytest.mark.asyncio
    async def test_list_owner_repos_success(self, github_service):
        """Test successful owner repo listing."""
        mock_repos = [
            {"name": "repo1", "full_name": "owner/repo1"},
        ]

        with patch("httpx.AsyncClient") as mock_client:
            mock_response = MagicMock()
            mock_response.json.return_value = mock_repos
            mock_response.headers = {}
            mock_response.raise_for_status = MagicMock()

            mock_instance = MagicMock()
            mock_instance.get = AsyncMock(return_value=mock_response)
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=None)
            mock_client.return_value = mock_instance

            result = await github_service.list_owner_repos("octocat")

            assert result["owner"] == "octocat"
            assert result["is_own_repos"] is False
            assert len(result["repositories"]) == 1

    @pytest.mark.asyncio
    async def test_list_owner_repos_not_found(self, github_service):
        """Test handling of non-existent user."""
        import httpx

        with patch("httpx.AsyncClient") as mock_client:
            mock_response = MagicMock()
            mock_response.status_code = 404

            mock_instance = MagicMock()
            mock_instance.get = AsyncMock(return_value=mock_response)
            mock_response.raise_for_status = MagicMock(
                side_effect=httpx.HTTPStatusError(
                    "Not Found",
                    request=MagicMock(),
                    response=mock_response
                )
            )
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=None)
            mock_client.return_value = mock_instance

            with pytest.raises(RuntimeError) as exc_info:
                await github_service.list_owner_repos("nonexistent_user_12345")

            assert "not found" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_list_owner_repos_uses_correct_endpoint(self, github_service):
        """Test that correct API endpoint is used."""
        with patch("httpx.AsyncClient") as mock_client:
            mock_response = MagicMock()
            mock_response.json.return_value = []
            mock_response.headers = {}
            mock_response.raise_for_status = MagicMock()

            mock_instance = MagicMock()
            mock_instance.get = AsyncMock(return_value=mock_response)
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=None)
            mock_client.return_value = mock_instance

            await github_service.list_owner_repos("testowner")

            call_args = mock_instance.get.call_args
            assert "users/testowner/repos" in call_args[0][0]


# ==================== Get Default Branch Tests ====================

class TestGetDefaultBranch:
    """Tests for getting default branch."""

    @pytest.mark.asyncio
    async def test_get_default_branch_success(self, github_service):
        """Test successful default branch retrieval."""
        with patch("httpx.AsyncClient") as mock_client:
            mock_response = MagicMock()
            mock_response.json.return_value = {"default_branch": "develop"}
            mock_response.raise_for_status = MagicMock()

            mock_instance = MagicMock()
            mock_instance.get = AsyncMock(return_value=mock_response)
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=None)
            mock_client.return_value = mock_instance

            result = await github_service.get_default_branch("owner", "repo")

            assert result == "develop"

    @pytest.mark.asyncio
    async def test_get_default_branch_fallback(self, github_service):
        """Test fallback to 'main' on error."""
        with patch("httpx.AsyncClient") as mock_client:
            mock_instance = MagicMock()
            mock_instance.get = AsyncMock(side_effect=Exception("API Error"))
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=None)
            mock_client.return_value = mock_instance

            result = await github_service.get_default_branch("owner", "repo")

            assert result == "main"


# ==================== Path Traversal Protection Tests ====================

class TestPathTraversalProtection:
    """Tests for path traversal attack prevention."""

    @pytest.mark.asyncio
    async def test_path_traversal_blocked(self, github_service, temp_dir):
        """Test that path traversal attempts are blocked."""
        repo_info = GitHubRepoInfo(
            owner="testuser",
            repo="test-repo",
            branch="main",
            path="../../../etc/passwd",
        )

        # Create fake cloned directory
        (temp_dir / ".git").mkdir()

        with patch("asyncio.create_subprocess_exec") as mock_exec:
            mock_process = MagicMock()
            mock_process.returncode = 0
            mock_process.communicate = AsyncMock(return_value=(b"", b""))
            mock_exec.return_value = mock_process

            with pytest.raises(RuntimeError) as exc_info:
                await github_service.clone_repository(repo_info, temp_dir)

            # Should be blocked by path validation
            assert "Invalid subdirectory path" in str(exc_info.value) or "path traversal" in str(exc_info.value).lower()


# ==================== Headers Tests ====================

class TestHeaders:
    """Tests for API headers."""

    def test_headers_include_auth(self, github_service):
        """Test that headers include authorization."""
        assert "Authorization" in github_service.headers
        assert "Bearer" in github_service.headers["Authorization"]

    def test_headers_include_accept(self, github_service):
        """Test that headers include Accept."""
        assert "Accept" in github_service.headers
        assert "application/vnd.github" in github_service.headers["Accept"]

    def test_headers_include_api_version(self, github_service):
        """Test that headers include API version."""
        assert "X-GitHub-Api-Version" in github_service.headers


# ==================== Constructor Tests ====================

class TestConstructor:
    """Tests for GitHubService constructor."""

    def test_constructor_with_token(self):
        """Test constructor with provided token."""
        service = GitHubService(access_token="my_token")
        assert service.access_token == "my_token"

    def test_constructor_uses_settings_token(self):
        """Test constructor falls back to settings token."""
        with patch("app.services.github.settings") as mock_settings:
            mock_settings.github_token = "settings_token"
            service = GitHubService()
            assert service.access_token == "settings_token"
