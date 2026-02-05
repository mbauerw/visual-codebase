"""
Security endpoint tests for authentication and account management.

Phase 2 Testing: Tests for password change, account deletion, and data export endpoints.

These tests cover:
- Password change flow (validation, history check, update)
- Account deletion lifecycle (request, status, cancel)
- Data export operations
- Profile security
"""

import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi.testclient import TestClient

from app.main import app
from app.models.schemas import (
    DeletionStatus,
    ExportStatus,
    ExportType,
    PasswordPolicy,
    PasswordValidationResult,
    PasswordValidationCriteria,
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


@pytest.fixture
def mock_oauth_user():
    """Mock OAuth-authenticated user (GitHub)."""
    user = MagicMock()
    user.id = "oauth-user-456"
    user.email = "oauth@example.com"
    user.app_metadata = {"provider": "github"}
    return user


def setup_auth_mock(mock_supabase, mock_user):
    """Helper to setup auth mocking."""
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.user = mock_user
    mock_client.auth.get_user.return_value = mock_response
    mock_supabase.return_value = mock_client
    return mock_client


# ==================== Password Policy Tests ====================

class TestPasswordPolicy:
    """Test password policy endpoint."""

    def test_get_password_policy_returns_defaults(self, client):
        """Test that password policy returns default values."""
        with patch("app.api.routes.PasswordService") as mock_service_class:
            mock_service = MagicMock()
            mock_service.get_policy = AsyncMock(return_value=PasswordPolicy())
            mock_service_class.return_value = mock_service

            response = client.get("/api/auth/password-policy")

            assert response.status_code == 200
            data = response.json()
            assert data["min_length"] == 8
            assert data["require_uppercase"] is True
            assert data["require_lowercase"] is True
            assert data["require_number"] is True
            assert data["require_special"] is True

    def test_get_password_policy_custom_values(self, client):
        """Test that custom password policy is returned."""
        with patch("app.api.routes.PasswordService") as mock_service_class:
            mock_service = MagicMock()
            mock_service.get_policy = AsyncMock(return_value=PasswordPolicy(
                min_length=12,
                require_uppercase=True,
                require_lowercase=True,
                require_number=True,
                require_special=False,
                history_count=3,
            ))
            mock_service_class.return_value = mock_service

            response = client.get("/api/auth/password-policy")

            assert response.status_code == 200
            data = response.json()
            assert data["min_length"] == 12
            assert data["require_special"] is False
            assert data["history_count"] == 3


# ==================== Password Validation Tests ====================

class TestPasswordValidation:
    """Test password validation endpoint."""

    def test_validate_strong_password(self, client):
        """Test that a strong password passes validation."""
        with patch("app.api.routes.PasswordService") as mock_service_class:
            mock_service = MagicMock()
            mock_service.validate_strength = AsyncMock(return_value=PasswordValidationResult(
                valid=True,
                score=95,
                criteria=[
                    PasswordValidationCriteria(criterion="min_length", passed=True, message="At least 8 characters"),
                    PasswordValidationCriteria(criterion="uppercase", passed=True, message="Contains uppercase"),
                    PasswordValidationCriteria(criterion="lowercase", passed=True, message="Contains lowercase"),
                    PasswordValidationCriteria(criterion="number", passed=True, message="Contains number"),
                    PasswordValidationCriteria(criterion="special", passed=True, message="Contains special"),
                ],
                suggestions=[],
            ))
            mock_service_class.return_value = mock_service

            response = client.post(
                "/api/auth/validate-password",
                json={"password": "StrongP@ssw0rd!"}
            )

            assert response.status_code == 200
            data = response.json()
            assert data["valid"] is True
            assert data["score"] >= 80

    def test_validate_weak_password(self, client):
        """Test that a weak password fails validation."""
        with patch("app.api.routes.PasswordService") as mock_service_class:
            mock_service = MagicMock()
            mock_service.validate_strength = AsyncMock(return_value=PasswordValidationResult(
                valid=False,
                score=20,
                criteria=[
                    PasswordValidationCriteria(criterion="min_length", passed=False, message="Must be at least 8 characters"),
                    PasswordValidationCriteria(criterion="uppercase", passed=False, message="Add an uppercase letter"),
                    PasswordValidationCriteria(criterion="lowercase", passed=True, message="Contains lowercase"),
                    PasswordValidationCriteria(criterion="number", passed=False, message="Add a number"),
                    PasswordValidationCriteria(criterion="special", passed=False, message="Add a special character"),
                ],
                suggestions=["Add 5 more characters", "Add an uppercase letter"],
            ))
            mock_service_class.return_value = mock_service

            response = client.post(
                "/api/auth/validate-password",
                json={"password": "abc"}
            )

            assert response.status_code == 200
            data = response.json()
            assert data["valid"] is False
            assert data["score"] < 50
            assert len(data["suggestions"]) > 0


# ==================== Password Change Tests ====================

class TestPasswordChange:
    """Test password change endpoint."""

    @patch("app.auth.get_supabase_client")
    def test_password_change_requires_auth(self, mock_supabase, client):
        """Test that password change requires authentication."""
        response = client.post(
            "/api/user/profile/password",
            json={"current_password": "OldP@ss123", "new_password": "NewP@ssw0rd!"}
        )

        assert response.status_code == 401

    @patch("app.auth.get_supabase_client")
    @patch("app.api.routes.PasswordService")
    @patch("app.api.routes.ProfileService")
    def test_password_change_success(
        self, mock_profile_class, mock_password_class, mock_supabase, client, mock_auth_user
    ):
        """Test successful password change."""
        setup_auth_mock(mock_supabase, mock_auth_user)

        # Mock password validation
        mock_password = MagicMock()
        mock_password.validate_strength = AsyncMock(return_value=PasswordValidationResult(
            valid=True,
            score=90,
            criteria=[],
            suggestions=[],
        ))
        mock_password.check_history = AsyncMock(return_value=True)
        mock_password_class.return_value = mock_password

        # Mock profile service
        mock_profile = MagicMock()
        mock_profile.change_password = AsyncMock(return_value={"success": True})
        mock_profile_class.return_value = mock_profile

        response = client.post(
            "/api/user/profile/password",
            json={"current_password": "OldP@ss123", "new_password": "NewStr0ng!Pass"},
            headers={"Authorization": "Bearer valid-token"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "updated" in data["message"].lower()

    @patch("app.auth.get_supabase_client")
    @patch("app.api.routes.PasswordService")
    def test_password_change_weak_password_rejected(
        self, mock_password_class, mock_supabase, client, mock_auth_user
    ):
        """Test that weak passwords are rejected."""
        setup_auth_mock(mock_supabase, mock_auth_user)

        mock_password = MagicMock()
        mock_password.validate_strength = AsyncMock(return_value=PasswordValidationResult(
            valid=False,
            score=20,
            criteria=[],
            suggestions=["Password too weak"],
        ))
        mock_password_class.return_value = mock_password

        response = client.post(
            "/api/user/profile/password",
            json={"current_password": "OldP@ss123", "new_password": "weakpass1"},
            headers={"Authorization": "Bearer valid-token"}
        )

        assert response.status_code == 400
        assert "strength requirements" in response.json()["detail"].lower()

    @patch("app.auth.get_supabase_client")
    @patch("app.api.routes.PasswordService")
    def test_password_change_history_check_fails(
        self, mock_password_class, mock_supabase, client, mock_auth_user
    ):
        """Test that recently used passwords are rejected."""
        setup_auth_mock(mock_supabase, mock_auth_user)

        mock_password = MagicMock()
        mock_password.validate_strength = AsyncMock(return_value=PasswordValidationResult(
            valid=True,
            score=90,
            criteria=[],
            suggestions=[],
        ))
        mock_password.check_history = AsyncMock(return_value=False)  # Password in history
        mock_password_class.return_value = mock_password

        response = client.post(
            "/api/user/profile/password",
            json={"current_password": "OldP@ss123", "new_password": "OldP@ssword123"},
            headers={"Authorization": "Bearer valid-token"}
        )

        assert response.status_code == 400
        assert "recently used" in response.json()["detail"].lower()


# ==================== Account Deletion Request Tests ====================

class TestAccountDeletionRequest:
    """Test account deletion request endpoint."""

    @patch("app.auth.get_supabase_client")
    def test_deletion_request_requires_auth(self, mock_supabase, client):
        """Test that deletion request requires authentication."""
        response = client.post(
            "/api/user/account/delete",
            json={"reason": "Testing"}
        )

        assert response.status_code == 401

    @patch("app.auth.get_supabase_client")
    @patch("app.api.routes.AccountDeletionService")
    def test_deletion_request_success(
        self, mock_deletion_class, mock_supabase, client, mock_auth_user
    ):
        """Test successful account deletion request."""
        setup_auth_mock(mock_supabase, mock_auth_user)

        scheduled_at = datetime.now(timezone.utc) + timedelta(days=30)
        mock_service = MagicMock()
        mock_service.request_deletion = AsyncMock(return_value={
            "deletion_id": "deletion-123",
            "scheduled_deletion_at": scheduled_at,
            "status": DeletionStatus.PENDING,
            "export_requested": False,
            "export_id": None,
            "message": "Account scheduled for deletion"
        })
        mock_deletion_class.return_value = mock_service

        response = client.post(
            "/api/user/account/delete",
            json={"reason": "No longer needed", "export_data": False},
            headers={"Authorization": "Bearer valid-token"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["deletion_id"] == "deletion-123"
        assert data["status"] == "pending"
        assert data["export_requested"] is False

    @patch("app.auth.get_supabase_client")
    @patch("app.api.routes.AccountDeletionService")
    def test_deletion_request_with_export(
        self, mock_deletion_class, mock_supabase, client, mock_auth_user
    ):
        """Test deletion request with data export."""
        setup_auth_mock(mock_supabase, mock_auth_user)

        scheduled_at = datetime.now(timezone.utc) + timedelta(days=30)
        mock_service = MagicMock()
        mock_service.request_deletion = AsyncMock(return_value={
            "deletion_id": "deletion-123",
            "scheduled_deletion_at": scheduled_at,
            "status": DeletionStatus.PENDING,
            "export_requested": True,
            "export_id": "export-456",
            "message": "Account scheduled for deletion"
        })
        mock_deletion_class.return_value = mock_service

        response = client.post(
            "/api/user/account/delete",
            json={"reason": "Moving on", "export_data": True},
            headers={"Authorization": "Bearer valid-token"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["export_requested"] is True
        assert data["export_id"] == "export-456"

    @patch("app.auth.get_supabase_client")
    @patch("app.api.routes.AccountDeletionService")
    def test_deletion_request_already_pending(
        self, mock_deletion_class, mock_supabase, client, mock_auth_user
    ):
        """Test that duplicate deletion requests are rejected."""
        setup_auth_mock(mock_supabase, mock_auth_user)

        mock_service = MagicMock()
        mock_service.request_deletion = AsyncMock(return_value={
            "error": True,
            "message": "A deletion request is already pending for this account."
        })
        mock_deletion_class.return_value = mock_service

        response = client.post(
            "/api/user/account/delete",
            json={"reason": "Duplicate request"},
            headers={"Authorization": "Bearer valid-token"}
        )

        assert response.status_code == 400
        assert "already pending" in response.json()["detail"].lower()


# ==================== Account Deletion Status Tests ====================

class TestAccountDeletionStatus:
    """Test account deletion status endpoint."""

    @patch("app.auth.get_supabase_client")
    def test_deletion_status_requires_auth(self, mock_supabase, client):
        """Test that deletion status requires authentication."""
        response = client.get("/api/user/account/deletion-status")

        assert response.status_code == 401

    @patch("app.auth.get_supabase_client")
    @patch("app.api.routes.AccountDeletionService")
    def test_deletion_status_pending(
        self, mock_deletion_class, mock_supabase, client, mock_auth_user
    ):
        """Test getting pending deletion status."""
        setup_auth_mock(mock_supabase, mock_auth_user)

        scheduled_at = datetime.now(timezone.utc) + timedelta(days=25)
        mock_service = MagicMock()
        mock_service.get_deletion_status = AsyncMock(return_value={
            "deletion_id": "deletion-123",
            "scheduled_deletion_at": scheduled_at,
            "status": DeletionStatus.PENDING,
            "days_remaining": 25,
            "can_cancel": True
        })
        mock_deletion_class.return_value = mock_service

        response = client.get(
            "/api/user/account/deletion-status",
            headers={"Authorization": "Bearer valid-token"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["deletion_id"] == "deletion-123"
        assert data["days_remaining"] == 25
        assert data["can_cancel"] is True

    @patch("app.auth.get_supabase_client")
    @patch("app.api.routes.AccountDeletionService")
    def test_deletion_status_not_found(
        self, mock_deletion_class, mock_supabase, client, mock_auth_user
    ):
        """Test 404 when no pending deletion request."""
        setup_auth_mock(mock_supabase, mock_auth_user)

        mock_service = MagicMock()
        mock_service.get_deletion_status = AsyncMock(return_value=None)
        mock_deletion_class.return_value = mock_service

        response = client.get(
            "/api/user/account/deletion-status",
            headers={"Authorization": "Bearer valid-token"}
        )

        assert response.status_code == 404
        assert "pending deletion" in response.json()["detail"].lower()


# ==================== Cancel Account Deletion Tests ====================

class TestCancelAccountDeletion:
    """Test account deletion cancellation endpoint."""

    @patch("app.auth.get_supabase_client")
    def test_cancel_deletion_requires_auth(self, mock_supabase, client):
        """Test that cancellation requires authentication."""
        response = client.post("/api/user/account/cancel-deletion")

        assert response.status_code == 401

    @patch("app.auth.get_supabase_client")
    @patch("app.api.routes.AccountDeletionService")
    def test_cancel_deletion_success(
        self, mock_deletion_class, mock_supabase, client, mock_auth_user
    ):
        """Test successful deletion cancellation."""
        setup_auth_mock(mock_supabase, mock_auth_user)

        mock_service = MagicMock()
        mock_service.cancel_deletion = AsyncMock(return_value={
            "message": "Account deletion cancelled. Your account has been restored.",
            "account_restored": True
        })
        mock_deletion_class.return_value = mock_service

        response = client.post(
            "/api/user/account/cancel-deletion",
            headers={"Authorization": "Bearer valid-token"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["account_restored"] is True
        assert "cancelled" in data["message"].lower()

    @patch("app.auth.get_supabase_client")
    @patch("app.api.routes.AccountDeletionService")
    def test_cancel_deletion_no_pending_request(
        self, mock_deletion_class, mock_supabase, client, mock_auth_user
    ):
        """Test cancellation when no pending request exists."""
        setup_auth_mock(mock_supabase, mock_auth_user)

        mock_service = MagicMock()
        mock_service.cancel_deletion = AsyncMock(return_value={
            "message": "No pending deletion request found.",
            "account_restored": False
        })
        mock_deletion_class.return_value = mock_service

        response = client.post(
            "/api/user/account/cancel-deletion",
            headers={"Authorization": "Bearer valid-token"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["account_restored"] is False

    @patch("app.auth.get_supabase_client")
    @patch("app.api.routes.AccountDeletionService")
    def test_cancel_deletion_grace_period_expired(
        self, mock_deletion_class, mock_supabase, client, mock_auth_user
    ):
        """Test cancellation when grace period has expired."""
        setup_auth_mock(mock_supabase, mock_auth_user)

        mock_service = MagicMock()
        mock_service.cancel_deletion = AsyncMock(return_value={
            "message": "The grace period has expired. Deletion cannot be cancelled.",
            "account_restored": False
        })
        mock_deletion_class.return_value = mock_service

        response = client.post(
            "/api/user/account/cancel-deletion",
            headers={"Authorization": "Bearer valid-token"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["account_restored"] is False
        assert "expired" in data["message"].lower()


# ==================== Data Export Request Tests ====================

class TestDataExportRequest:
    """Test data export request endpoint."""

    @patch("app.auth.get_supabase_client")
    def test_export_request_requires_auth(self, mock_supabase, client):
        """Test that export request requires authentication."""
        response = client.post(
            "/api/user/data/export",
            json={"export_type": "full"}
        )

        assert response.status_code == 401

    @patch("app.auth.get_supabase_client")
    @patch("app.api.routes.DataExportService")
    def test_export_request_full_success(
        self, mock_export_class, mock_supabase, client, mock_auth_user
    ):
        """Test successful full data export request."""
        setup_auth_mock(mock_supabase, mock_auth_user)

        mock_service = MagicMock()
        mock_service.create_export = AsyncMock(return_value={
            "export_id": "export-123",
            "status": ExportStatus.PENDING,
            "estimated_time_seconds": 30
        })
        mock_export_class.return_value = mock_service

        response = client.post(
            "/api/user/data/export",
            json={"export_type": "full"},
            headers={"Authorization": "Bearer valid-token"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["export_id"] == "export-123"
        assert data["status"] == "pending"

    @patch("app.auth.get_supabase_client")
    @patch("app.api.routes.DataExportService")
    def test_export_request_profile_only(
        self, mock_export_class, mock_supabase, client, mock_auth_user
    ):
        """Test profile-only data export request."""
        setup_auth_mock(mock_supabase, mock_auth_user)

        mock_service = MagicMock()
        mock_service.create_export = AsyncMock(return_value={
            "export_id": "export-456",
            "status": ExportStatus.PENDING,
            "estimated_time_seconds": 10
        })
        mock_export_class.return_value = mock_service

        response = client.post(
            "/api/user/data/export",
            json={"export_type": "profile_only"},
            headers={"Authorization": "Bearer valid-token"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["export_id"] == "export-456"


# ==================== Data Export Status Tests ====================

class TestDataExportStatus:
    """Test data export status endpoint."""

    @patch("app.auth.get_supabase_client")
    def test_export_status_requires_auth(self, mock_supabase, client):
        """Test that export status requires authentication."""
        response = client.get("/api/user/data/export/export-123")

        assert response.status_code == 401

    @patch("app.auth.get_supabase_client")
    @patch("app.api.routes.DataExportService")
    def test_export_status_pending(
        self, mock_export_class, mock_supabase, client, mock_auth_user
    ):
        """Test getting pending export status."""
        setup_auth_mock(mock_supabase, mock_auth_user)

        mock_service = MagicMock()
        mock_service.get_export_status = AsyncMock(return_value={
            "export_id": "export-123",
            "status": ExportStatus.PENDING,
            "download_url": None,
            "expires_at": None,
            "file_size_bytes": None
        })
        mock_export_class.return_value = mock_service

        response = client.get(
            "/api/user/data/export/export-123",
            headers={"Authorization": "Bearer valid-token"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["export_id"] == "export-123"
        assert data["status"] == "pending"
        assert data["download_url"] is None

    @patch("app.auth.get_supabase_client")
    @patch("app.api.routes.DataExportService")
    def test_export_status_completed(
        self, mock_export_class, mock_supabase, client, mock_auth_user
    ):
        """Test getting completed export status with download URL."""
        setup_auth_mock(mock_supabase, mock_auth_user)

        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        mock_service = MagicMock()
        mock_service.get_export_status = AsyncMock(return_value={
            "export_id": "export-123",
            "status": ExportStatus.COMPLETED,
            "download_url": "/api/user/data/export/export-123/download",
            "expires_at": expires_at,
            "file_size_bytes": 1048576
        })
        mock_export_class.return_value = mock_service

        response = client.get(
            "/api/user/data/export/export-123",
            headers={"Authorization": "Bearer valid-token"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "completed"
        assert data["download_url"] is not None
        assert data["file_size_bytes"] == 1048576

    @patch("app.auth.get_supabase_client")
    @patch("app.api.routes.DataExportService")
    def test_export_status_not_found(
        self, mock_export_class, mock_supabase, client, mock_auth_user
    ):
        """Test 404 when export not found."""
        setup_auth_mock(mock_supabase, mock_auth_user)

        mock_service = MagicMock()
        mock_service.get_export_status = AsyncMock(return_value=None)
        mock_export_class.return_value = mock_service

        response = client.get(
            "/api/user/data/export/nonexistent",
            headers={"Authorization": "Bearer valid-token"}
        )

        assert response.status_code == 404


# ==================== Profile Security Tests ====================

class TestProfileSecurity:
    """Test profile endpoint security."""

    @patch("app.auth.get_supabase_client")
    def test_get_profile_requires_auth(self, mock_supabase, client):
        """Test that get profile requires authentication."""
        response = client.get("/api/user/profile")

        assert response.status_code == 401

    @patch("app.auth.get_supabase_client")
    def test_update_profile_requires_auth(self, mock_supabase, client):
        """Test that update profile requires authentication."""
        response = client.patch(
            "/api/user/profile",
            json={"display_name": "Hacker"}
        )

        assert response.status_code == 401

    @patch("app.auth.get_supabase_client")
    @patch("app.api.routes.ProfileService")
    def test_get_profile_success(
        self, mock_profile_class, mock_supabase, client, mock_auth_user
    ):
        """Test successful profile retrieval."""
        setup_auth_mock(mock_supabase, mock_auth_user)

        mock_service = MagicMock()
        mock_service.get_profile = AsyncMock(return_value={
            "id": mock_auth_user.id,
            "email": mock_auth_user.email,
            "display_name": "Test User",
            "full_name": "Test User",
            "avatar_url": None,
            "preferences": {},
            "auth_provider": "email",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })
        mock_profile_class.return_value = mock_service

        response = client.get(
            "/api/user/profile",
            headers={"Authorization": "Bearer valid-token"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["email"] == mock_auth_user.email
        assert data["display_name"] == "Test User"

    @patch("app.auth.get_supabase_client")
    @patch("app.api.routes.ProfileService")
    def test_get_profile_not_found(
        self, mock_profile_class, mock_supabase, client, mock_auth_user
    ):
        """Test 404 when profile not found."""
        setup_auth_mock(mock_supabase, mock_auth_user)

        mock_service = MagicMock()
        mock_service.get_profile = AsyncMock(return_value=None)
        mock_profile_class.return_value = mock_service

        response = client.get(
            "/api/user/profile",
            headers={"Authorization": "Bearer valid-token"}
        )

        assert response.status_code == 404

    @patch("app.auth.get_supabase_client")
    @patch("app.api.routes.ProfileService")
    def test_update_profile_success(
        self, mock_profile_class, mock_supabase, client, mock_auth_user
    ):
        """Test successful profile update."""
        setup_auth_mock(mock_supabase, mock_auth_user)

        mock_service = MagicMock()
        mock_service.update_profile = AsyncMock()
        mock_service.get_profile = AsyncMock(return_value={
            "id": mock_auth_user.id,
            "email": mock_auth_user.email,
            "display_name": "New Name",
            "full_name": None,
            "avatar_url": "https://example.com/avatar.png",
            "preferences": {"theme": "dark"},
            "auth_provider": "email",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })
        mock_profile_class.return_value = mock_service

        response = client.patch(
            "/api/user/profile",
            json={
                "display_name": "New Name",
                "avatar_url": "https://example.com/avatar.png",
                "preferences": {"theme": "dark"}
            },
            headers={"Authorization": "Bearer valid-token"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["display_name"] == "New Name"


# ==================== Authorization Boundary Tests ====================

class TestAuthorizationBoundaries:
    """Test authorization boundaries and access control."""

    @patch("app.auth.get_supabase_client")
    @patch("app.api.routes.DataExportService")
    def test_cannot_access_other_users_export(
        self, mock_export_class, mock_supabase, client, mock_auth_user
    ):
        """Test that users cannot access other users' exports."""
        setup_auth_mock(mock_supabase, mock_auth_user)

        # Service returns None for mismatched user_id
        mock_service = MagicMock()
        mock_service.get_export_status = AsyncMock(return_value=None)
        mock_export_class.return_value = mock_service

        response = client.get(
            "/api/user/data/export/other-users-export",
            headers={"Authorization": "Bearer valid-token"}
        )

        assert response.status_code == 404

    @patch("app.auth.get_supabase_client")
    @patch("app.api.routes.AccountDeletionService")
    def test_deletion_scoped_to_user(
        self, mock_deletion_class, mock_supabase, client, mock_auth_user
    ):
        """Test that deletion operations are scoped to authenticated user."""
        setup_auth_mock(mock_supabase, mock_auth_user)

        mock_service = MagicMock()
        mock_service.request_deletion = AsyncMock(return_value={
            "deletion_id": "deletion-123",
            "scheduled_deletion_at": datetime.now(timezone.utc) + timedelta(days=30),
            "status": DeletionStatus.PENDING,
            "export_requested": False,
            "export_id": None,
            "message": "Scheduled"
        })
        mock_deletion_class.return_value = mock_service

        response = client.post(
            "/api/user/account/delete",
            json={"reason": "Test"},
            headers={"Authorization": "Bearer valid-token"}
        )

        assert response.status_code == 200
        # Verify the service was called with the authenticated user's ID
        mock_service.request_deletion.assert_called_once()
        call_args = mock_service.request_deletion.call_args
        assert call_args[1]["user_id"] == mock_auth_user.id


# ==================== Edge Case Tests ====================

class TestSecurityEdgeCases:
    """Test security edge cases."""

    @patch("app.auth.get_supabase_client")
    @patch("app.api.routes.PasswordService")
    @patch("app.api.routes.ProfileService")
    def test_password_change_service_failure(
        self, mock_profile_class, mock_password_class, mock_supabase, client, mock_auth_user
    ):
        """Test handling of password change service failure."""
        setup_auth_mock(mock_supabase, mock_auth_user)

        mock_password = MagicMock()
        mock_password.validate_strength = AsyncMock(return_value=PasswordValidationResult(
            valid=True,
            score=90,
            criteria=[],
            suggestions=[],
        ))
        mock_password.check_history = AsyncMock(return_value=True)
        mock_password_class.return_value = mock_password

        mock_profile = MagicMock()
        mock_profile.change_password = AsyncMock(return_value={
            "success": False,
            "message": "Internal error occurred"
        })
        mock_profile_class.return_value = mock_profile

        response = client.post(
            "/api/user/profile/password",
            json={"current_password": "OldP@ss123", "new_password": "ValidP@ss123"},
            headers={"Authorization": "Bearer valid-token"}
        )

        assert response.status_code == 400

    def test_empty_password_validation(self, client):
        """Test that empty password is handled."""
        response = client.post(
            "/api/auth/validate-password",
            json={"password": ""}
        )

        # Should return 200 with validation result (not crash)
        assert response.status_code in [200, 422]

    def test_very_long_password_validation(self, client):
        """Test that very long passwords are handled."""
        long_password = "A" * 10000 + "a1@"

        with patch("app.api.routes.PasswordService") as mock_service_class:
            mock_service = MagicMock()
            mock_service.validate_strength = AsyncMock(return_value=PasswordValidationResult(
                valid=True,
                score=100,
                criteria=[],
                suggestions=[],
            ))
            mock_service_class.return_value = mock_service

            response = client.post(
                "/api/auth/validate-password",
                json={"password": long_password}
            )

            # Should not crash with very long input
            assert response.status_code in [200, 422]
