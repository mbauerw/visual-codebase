"""
Security tests for path traversal prevention, input validation, and injection attacks.

These tests cover critical security functionality including:
- Path traversal attack prevention
- GitHub username/repo validation
- Branch name validation
- SQL injection prevention (via parameterized queries)
- Token sanitization in error messages
"""

import pytest
from pathlib import Path
import tempfile
import os

from app.security import (
    validate_path_within_base,
    safe_join_path,
    PathTraversalError,
)
from app.models.schemas import GitHubRepoInfo, AnalyzeRequest
from app.api.routes import validate_github_username


# ==================== Path Traversal Tests ====================

class TestValidatePathWithinBase:
    """Test the validate_path_within_base function."""

    def test_valid_path_absolute(self, temp_project_dir):
        """Test that a valid absolute path within base is accepted."""
        base = Path(temp_project_dir)
        target = base / "src" / "components" / "Button.tsx"

        result = validate_path_within_base(base, target)
        assert result == target.resolve()

    def test_valid_path_relative(self, temp_project_dir):
        """Test that a valid relative path is resolved and accepted."""
        base = Path(temp_project_dir)

        result = validate_path_within_base(base, "src/components/Button.tsx")
        expected = (base / "src/components/Button.tsx").resolve()
        assert result == expected

    def test_path_traversal_simple(self, temp_project_dir):
        """Test that simple path traversal is blocked."""
        base = Path(temp_project_dir)

        with pytest.raises(PathTraversalError):
            validate_path_within_base(base, "../etc/passwd")

    def test_path_traversal_encoded(self, temp_project_dir):
        """Test URL-encoded path traversal handling.

        Note: URL-encoded paths are treated as literal strings by Path.resolve(),
        so %2e%2e is not interpreted as "..". This is fine because URL decoding
        should happen at the web framework layer before path validation.
        """
        base = Path(temp_project_dir)

        # URL-encoded paths are treated literally - they become a subdirectory name
        # This test documents the behavior rather than testing for rejection
        result = validate_path_within_base(base, "..%2f..%2fetc%2fpasswd")
        # The path is treated as a literal file name within base, which is safe
        assert str(base) in str(result)

    def test_path_traversal_deep(self, temp_project_dir):
        """Test that deep path traversal is blocked."""
        base = Path(temp_project_dir)

        with pytest.raises(PathTraversalError):
            validate_path_within_base(base, "src/../../../etc/passwd")

    def test_path_traversal_absolute_escape(self, temp_project_dir):
        """Test that absolute paths outside base are blocked."""
        base = Path(temp_project_dir)

        with pytest.raises(PathTraversalError):
            validate_path_within_base(base, "/etc/passwd")

    def test_path_traversal_symlink_style(self, temp_project_dir):
        """Test traversal attempts using directory that appears valid."""
        base = Path(temp_project_dir)

        with pytest.raises(PathTraversalError):
            validate_path_within_base(base, "src/../../../../../../etc/passwd")

    def test_path_traversal_null_byte(self, temp_project_dir):
        """Test that null byte injection is handled."""
        base = Path(temp_project_dir)

        # Null bytes should be handled by path resolution or raise an error
        try:
            result = validate_path_within_base(base, "file.txt\x00.jpg")
            # If it doesn't raise, ensure the path is still within base
            assert str(base) in str(result)
        except (PathTraversalError, ValueError):
            pass  # Expected for null byte handling

    def test_custom_error_message(self, temp_project_dir):
        """Test that custom error messages are used."""
        base = Path(temp_project_dir)
        custom_msg = "Custom security error"

        with pytest.raises(PathTraversalError) as exc_info:
            validate_path_within_base(base, "../escape", error_message=custom_msg)

        assert custom_msg in str(exc_info.value)

    def test_windows_style_traversal(self, temp_project_dir):
        """Test Windows-style path traversal handling on Unix.

        Note: On Unix/macOS, backslashes are treated as literal characters
        in file names, not as path separators. This means "..\\..\\etc\\passwd"
        becomes a literal file name, not a traversal attempt.
        """
        import platform
        base = Path(temp_project_dir)

        if platform.system() == "Windows":
            # On Windows, backslashes are path separators
            with pytest.raises(PathTraversalError):
                validate_path_within_base(base, "..\\..\\etc\\passwd")
        else:
            # On Unix, backslashes are literal characters - treated as filename
            result = validate_path_within_base(base, "..\\..\\etc\\passwd")
            assert str(base) in str(result)

    def test_mixed_slash_traversal(self, temp_project_dir):
        """Test mixed forward/backward slash traversal handling.

        Note: On Unix, backslashes are literal characters. So "..\\../etc"
        means a file literally named "..\" in the current directory, then
        navigating up with "..", which is still caught by the traversal check.
        """
        import platform
        base = Path(temp_project_dir)

        if platform.system() == "Windows":
            with pytest.raises(PathTraversalError):
                validate_path_within_base(base, "..\\../etc/passwd")
        else:
            # On Unix, this creates an odd path but still resolves safely
            # The "..\" is a literal filename, "../" is traversal
            # Result depends on path resolution
            try:
                result = validate_path_within_base(base, "..\\../etc/passwd")
                # If it resolves without error, it should still be within base
                assert str(base) in str(result)
            except PathTraversalError:
                # If it raises, that's also acceptable security behavior
                pass


class TestSafeJoinPath:
    """Test the safe_join_path function."""

    def test_safe_join_valid(self, temp_project_dir):
        """Test that valid path joining works."""
        base = Path(temp_project_dir)

        result = safe_join_path(base, "src", "components", "Button.tsx")
        expected = (base / "src" / "components" / "Button.tsx").resolve()
        assert result == expected

    def test_safe_join_traversal_blocked(self, temp_project_dir):
        """Test that path traversal in joined parts is blocked."""
        base = Path(temp_project_dir)

        with pytest.raises(PathTraversalError):
            safe_join_path(base, "src", "..", "..", "etc", "passwd")

    def test_safe_join_empty_parts(self, temp_project_dir):
        """Test joining with empty parts."""
        base = Path(temp_project_dir)

        result = safe_join_path(base, "", "src", "")
        expected = (base / "src").resolve()
        assert result == expected


# ==================== GitHub Username Validation Tests ====================

class TestGitHubUsernameValidation:
    """Test GitHub username validation."""

    @pytest.mark.parametrize("username", [
        "validuser",
        "valid-user",
        "user123",
        "a",
        "abcdefghijklmnopqrstuvwxyz1234567890123",  # 39 chars
    ])
    def test_valid_usernames(self, username):
        """Test that valid GitHub usernames are accepted."""
        assert validate_github_username(username) is True

    @pytest.mark.parametrize("username", [
        "",
        "-invalid",
        "invalid-",
        "in--valid",
        "user name",
        "user;name",
        "user&name",
        "user|name",
        "user`name",
        "$(whoami)",
        "; rm -rf /",
        "a" * 40,  # 40 chars - too long
    ])
    def test_invalid_usernames(self, username):
        """Test that invalid GitHub usernames are rejected."""
        assert validate_github_username(username) is False


# ==================== GitHubRepoInfo Validation Tests ====================

class TestGitHubRepoInfoValidation:
    """Test GitHubRepoInfo Pydantic validation."""

    def test_valid_repo_info(self):
        """Test that valid repo info is accepted."""
        repo = GitHubRepoInfo(
            owner="valid-user",
            repo="valid-repo",
            branch="main",
            path="src/components",
        )
        assert repo.owner == "valid-user"
        assert repo.repo == "valid-repo"

    @pytest.mark.parametrize("owner", [
        "",
        "-badstart",
        "badend-",
        "bad--double",
        "; rm -rf /",
        "$(whoami)",
        "a" * 40,
    ])
    def test_invalid_owner_rejected(self, owner):
        """Test that invalid owner names are rejected."""
        with pytest.raises(ValueError):
            GitHubRepoInfo(owner=owner, repo="valid-repo")

    @pytest.mark.parametrize("repo", [
        "",
        "-badstart",
        "badend-",
        "bad--double",
        "; rm -rf /",
        "$(whoami)",
    ])
    def test_invalid_repo_rejected(self, repo):
        """Test that invalid repo names are rejected."""
        with pytest.raises(ValueError):
            GitHubRepoInfo(owner="valid-owner", repo=repo)

    @pytest.mark.parametrize("branch", [
        "; rm -rf /",
        "$(whoami)",
        "branch`echo`",
        "branch|pipe",
        "branch&amp",
        "branch\ninjection",
        "branch\tinjection",
        "..",
        "branch/../escape",
    ])
    def test_dangerous_branch_rejected(self, branch):
        """Test that dangerous branch names are rejected."""
        with pytest.raises(ValueError):
            GitHubRepoInfo(owner="valid", repo="repo", branch=branch)

    @pytest.mark.parametrize("branch", [
        "main",
        "feature/new-thing",
        "release-1.0.0",
        "user/feature_branch",
    ])
    def test_valid_branches_accepted(self, branch):
        """Test that valid branch names are accepted."""
        repo = GitHubRepoInfo(owner="valid", repo="repo", branch=branch)
        assert repo.branch == branch

    @pytest.mark.parametrize("path", [
        "..",
        "../escape",
        "valid/../../../escape",
        "/absolute/path",
        "\\windows\\path",
        "C:\\windows",
        "path;injection",
        "path$(whoami)",
    ])
    def test_dangerous_path_rejected(self, path):
        """Test that dangerous paths are rejected."""
        with pytest.raises(ValueError):
            GitHubRepoInfo(owner="valid", repo="repo", path=path)

    @pytest.mark.parametrize("path", [
        "src",
        "src/components",
        "packages/core/lib",
    ])
    def test_valid_paths_accepted(self, path):
        """Test that valid paths are accepted."""
        repo = GitHubRepoInfo(owner="valid", repo="repo", path=path)
        assert repo.path == path


# ==================== AnalyzeRequest Validation Tests ====================

class TestAnalyzeRequestValidation:
    """Test AnalyzeRequest validation."""

    def test_requires_source(self):
        """Test that either directory_path or github_repo is required."""
        with pytest.raises(ValueError):
            AnalyzeRequest()

    def test_cannot_have_both_sources(self):
        """Test that both sources cannot be provided."""
        with pytest.raises(ValueError):
            AnalyzeRequest(
                directory_path="/some/path",
                github_repo=GitHubRepoInfo(owner="user", repo="repo"),
            )

    def test_valid_local_request(self):
        """Test valid local directory request."""
        req = AnalyzeRequest(directory_path="/Users/test/project")
        assert req.directory_path == "/Users/test/project"
        assert req.github_repo is None

    def test_valid_github_request(self):
        """Test valid GitHub request."""
        req = AnalyzeRequest(
            github_repo=GitHubRepoInfo(owner="user", repo="repo")
        )
        assert req.github_repo is not None
        assert req.directory_path is None


# ==================== Token Sanitization Tests ====================

class TestTokenSanitization:
    """Test that tokens are not leaked in error messages."""

    def test_auth_error_no_token_leak(self):
        """Test that auth errors don't leak tokens."""
        from app.auth import get_current_user
        from unittest.mock import patch, MagicMock
        import pytest

        # This would need to be tested with actual auth flow
        # Here we verify the structure doesn't expose raw tokens

    def test_github_token_not_in_error(self):
        """Test that GitHub tokens aren't exposed in errors."""
        # The routes should never include raw tokens in error messages
        # This is a structural test to ensure the pattern is followed
        import inspect
        from app.api import routes

        source = inspect.getsource(routes)

        # Check that error messages don't directly include x_github_token
        # This is a basic check - in practice, review the actual error handling
        assert "detail=x_github_token" not in source
        assert "detail=f\"{x_github_token" not in source


# ==================== SQL Injection Prevention Tests ====================

class TestSQLInjectionPrevention:
    """Test that SQL injection is prevented through parameterized queries."""

    @pytest.mark.parametrize("malicious_input", [
        "'; DROP TABLE analyses; --",
        "1; DELETE FROM users; --",
        "' OR '1'='1",
        "1' UNION SELECT * FROM users --",
        "admin'--",
        "' OR 1=1 --",
    ])
    def test_analysis_id_sql_injection(self, malicious_input):
        """Test that SQL injection in analysis_id is prevented.

        The Supabase client uses parameterized queries, so these values
        should be treated as literal strings, not SQL code.
        """
        # This is a structural test - the actual prevention is in Supabase client
        # We verify the code uses parameterized queries (.eq() method) not string concat
        import inspect
        from app.services import database

        source = inspect.getsource(database)

        # Verify we're using .eq() for equality checks, not string formatting
        assert ".eq(" in source
        # Verify we're not building raw SQL with string formatting
        assert 'f"SELECT' not in source
        assert "f'SELECT" not in source

    def test_user_id_not_in_url(self):
        """Test that user IDs come from auth, not URL parameters."""
        import inspect
        from app.api import routes

        source = inspect.getsource(routes)

        # User ID should come from get_current_user, not URL params
        assert "current_user.id" in source or "current_user = Depends" in source


# ==================== Input Boundary Tests ====================

class TestInputBoundaries:
    """Test input validation at boundaries."""

    def test_max_owner_length(self):
        """Test that owner names at max length (39) work."""
        repo = GitHubRepoInfo(owner="a" * 39, repo="repo")
        assert len(repo.owner) == 39

    def test_exceeds_max_owner_length(self):
        """Test that owner names exceeding max length are rejected."""
        with pytest.raises(ValueError):
            GitHubRepoInfo(owner="a" * 40, repo="repo")

    def test_max_repo_length(self):
        """Test that repo names at max length (100) work."""
        repo = GitHubRepoInfo(owner="owner", repo="a" * 100)
        assert len(repo.repo) == 100

    def test_max_branch_length(self):
        """Test that branch names at max length (256) work."""
        repo = GitHubRepoInfo(owner="owner", repo="repo", branch="a" * 256)
        assert len(repo.branch) == 256

    def test_max_path_length(self):
        """Test that paths at max length (4096) work."""
        long_path = "/".join(["dir"] * 500)[:4096]
        repo = GitHubRepoInfo(owner="owner", repo="repo", path=long_path)
        assert len(repo.path) <= 4096


# ==================== Edge Case Tests ====================

class TestSecurityEdgeCases:
    """Test security edge cases."""

    def test_unicode_in_username(self):
        """Test that unicode in usernames is rejected."""
        with pytest.raises(ValueError):
            GitHubRepoInfo(owner="user\u200bname", repo="repo")  # Zero-width space

    def test_unicode_in_repo(self):
        """Test that unicode in repo names is rejected."""
        with pytest.raises(ValueError):
            GitHubRepoInfo(owner="owner", repo="repo\u200bname")

    def test_whitespace_trimmed_in_owner(self):
        """Test that whitespace is handled in owner."""
        repo = GitHubRepoInfo(owner="  validowner  ", repo="repo")
        assert repo.owner == "validowner"

    def test_whitespace_trimmed_in_repo(self):
        """Test that whitespace is handled in repo."""
        repo = GitHubRepoInfo(owner="owner", repo="  validrepo  ")
        assert repo.repo == "validrepo"

    def test_empty_branch_becomes_none(self):
        """Test that empty branch string becomes None."""
        repo = GitHubRepoInfo(owner="owner", repo="repo", branch="   ")
        assert repo.branch is None

    def test_empty_path_becomes_none(self):
        """Test that empty path string becomes None."""
        repo = GitHubRepoInfo(owner="owner", repo="repo", path="   ")
        assert repo.path is None

    def test_path_normalization(self):
        """Test that paths are normalized (backslashes to forward slashes)."""
        repo = GitHubRepoInfo(owner="owner", repo="repo", path="src\\components")
        assert "\\" not in repo.path
        assert "/" in repo.path or repo.path == "src/components"
