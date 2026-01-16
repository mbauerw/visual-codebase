"""Account deletion and data export service."""
import json
import uuid
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List

from ..config.supabase import get_supabase_admin_client
from ..models.schemas import (
    DeletionStatus,
    ExportStatus,
    ExportType,
)


# Grace period before permanent deletion (in days)
GRACE_PERIOD_DAYS = 30


class AccountDeletionService:
    """Service for account deletion lifecycle management."""

    def __init__(self):
        self.supabase = get_supabase_admin_client()

    async def request_deletion(
        self,
        user_id: str,
        reason: Optional[str] = None,
        export_data: bool = False,
    ) -> Dict[str, Any]:
        """Initiate soft delete process.

        1. Creates deletion request record
        2. Sets deletion_scheduled_at on profile
        3. Marks profile as deleted_at = NOW()
        4. If export_data=True, triggers async export
        5. Returns deletion details

        Args:
            user_id: The user's UUID
            reason: Optional reason for deletion
            export_data: Whether to export data before deletion

        Returns:
            Deletion response dict
        """
        now = datetime.utcnow()
        scheduled_deletion = now + timedelta(days=GRACE_PERIOD_DAYS)

        # Check if there's already a pending deletion
        existing = self.supabase.table("account_deletion_requests").select("*").eq(
            "user_id", user_id
        ).eq("status", DeletionStatus.PENDING.value).execute()

        if existing.data:
            return {
                "error": True,
                "message": "A deletion request is already pending for this account."
            }

        # Create deletion request
        deletion_id = str(uuid.uuid4())
        deletion_data = {
            "id": deletion_id,
            "user_id": user_id,
            "scheduled_deletion_at": scheduled_deletion.isoformat(),
            "reason": reason,
            "status": DeletionStatus.PENDING.value,
            "data_exported": False,
        }

        self.supabase.table("account_deletion_requests").insert(deletion_data).execute()

        # Soft delete the profile
        self.supabase.table("profiles").update({
            "deleted_at": now.isoformat(),
            "deletion_scheduled_at": scheduled_deletion.isoformat(),
            "updated_at": now.isoformat(),
        }).eq("id", user_id).execute()

        # Handle data export if requested
        export_id = None
        if export_data:
            export_service = DataExportService()
            export_result = await export_service.create_export(user_id, ExportType.FULL)
            export_id = export_result.get("export_id")

            # Update deletion request with export info
            self.supabase.table("account_deletion_requests").update({
                "data_exported": True,
            }).eq("id", deletion_id).execute()

        return {
            "deletion_id": deletion_id,
            "scheduled_deletion_at": scheduled_deletion,
            "status": DeletionStatus.PENDING,
            "export_requested": export_data,
            "export_id": export_id,
            "message": f"Your account is scheduled for permanent deletion on {scheduled_deletion.strftime('%B %d, %Y')}. You can cancel this within the next {GRACE_PERIOD_DAYS} days."
        }

    async def cancel_deletion(self, user_id: str) -> Dict[str, Any]:
        """Cancel pending deletion (within grace period).

        1. Verifies deletion is still pending
        2. Clears deleted_at and deletion_scheduled_at on profile
        3. Updates deletion request status to 'cancelled'
        4. Returns restoration confirmation

        Args:
            user_id: The user's UUID

        Returns:
            Cancellation response dict
        """
        # Find pending deletion request
        result = self.supabase.table("account_deletion_requests").select("*").eq(
            "user_id", user_id
        ).eq("status", DeletionStatus.PENDING.value).order("created_at", desc=True).limit(1).execute()

        if not result.data:
            return {
                "message": "No pending deletion request found.",
                "account_restored": False
            }

        deletion_request = result.data[0]
        scheduled_at = datetime.fromisoformat(deletion_request["scheduled_deletion_at"].replace("Z", "+00:00"))

        # Check if still within grace period
        if datetime.utcnow() > scheduled_at.replace(tzinfo=None):
            return {
                "message": "The grace period has expired. Deletion cannot be cancelled.",
                "account_restored": False
            }

        now = datetime.utcnow()

        # Update deletion request to cancelled
        self.supabase.table("account_deletion_requests").update({
            "status": DeletionStatus.CANCELLED.value,
            "completed_at": now.isoformat(),
        }).eq("id", deletion_request["id"]).execute()

        # Restore the profile
        self.supabase.table("profiles").update({
            "deleted_at": None,
            "deletion_scheduled_at": None,
            "updated_at": now.isoformat(),
        }).eq("id", user_id).execute()

        return {
            "message": "Account deletion cancelled. Your account has been restored.",
            "account_restored": True
        }

    async def get_deletion_status(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get current deletion request status.

        Args:
            user_id: The user's UUID

        Returns:
            Deletion status dict or None if no pending deletion
        """
        result = self.supabase.table("account_deletion_requests").select("*").eq(
            "user_id", user_id
        ).eq("status", DeletionStatus.PENDING.value).order("created_at", desc=True).limit(1).execute()

        if not result.data:
            return None

        request = result.data[0]
        scheduled_at = datetime.fromisoformat(request["scheduled_deletion_at"].replace("Z", "+00:00"))
        now = datetime.utcnow()
        days_remaining = max(0, (scheduled_at.replace(tzinfo=None) - now).days)

        return {
            "deletion_id": request["id"],
            "scheduled_deletion_at": scheduled_at,
            "status": DeletionStatus(request["status"]),
            "days_remaining": days_remaining,
            "can_cancel": days_remaining > 0
        }

    async def execute_hard_delete(self, user_id: str) -> bool:
        """Permanently delete all user data.

        Called by background job after grace period expires.

        Order of deletion (respecting FK constraints):
        1. analysis_function_calls (via analysis_id)
        2. analysis_functions (via analysis_id)
        3. analysis_file_contents (via analysis_id)
        4. analysis_edges (via analysis_id)
        5. analysis_nodes (via analysis_id)
        6. analyses (via user_id)
        7. account_deletion_requests (via user_id)
        8. data_exports (via user_id)
        9. security_events (via user_id)
        10. profiles (by id)
        11. auth.users (via Supabase admin API)

        Args:
            user_id: The user's UUID

        Returns:
            True if successful, False otherwise
        """
        try:
            # Get all analysis IDs for this user
            analyses_result = self.supabase.table("analyses").select("id").eq("user_id", user_id).execute()
            analysis_ids = [a["id"] for a in analyses_result.data] if analyses_result.data else []

            # Delete analysis-related data (cascades should handle most of this, but being explicit)
            for analysis_id in analysis_ids:
                # Delete function calls
                self.supabase.table("analysis_function_calls").delete().eq("analysis_id", analysis_id).execute()
                # Delete functions
                self.supabase.table("analysis_functions").delete().eq("analysis_id", analysis_id).execute()
                # Delete file contents
                self.supabase.table("analysis_file_contents").delete().eq("analysis_id", analysis_id).execute()
                # Delete edges
                self.supabase.table("analysis_edges").delete().eq("analysis_id", analysis_id).execute()
                # Delete nodes
                self.supabase.table("analysis_nodes").delete().eq("analysis_id", analysis_id).execute()

            # Delete analyses
            self.supabase.table("analyses").delete().eq("user_id", user_id).execute()

            # Delete deletion requests
            self.supabase.table("account_deletion_requests").delete().eq("user_id", user_id).execute()

            # Delete data exports
            self.supabase.table("data_exports").delete().eq("user_id", user_id).execute()

            # Delete security events
            self.supabase.table("security_events").delete().eq("user_id", user_id).execute()

            # Delete password history
            self.supabase.table("password_history").delete().eq("user_id", user_id).execute()

            # Delete profile
            self.supabase.table("profiles").delete().eq("id", user_id).execute()

            # Delete auth user (this is the final step)
            self.supabase.auth.admin.delete_user(user_id)

            return True

        except Exception as e:
            print(f"Error during hard delete for user {user_id}: {e}")
            return False


class DataExportService:
    """Service for user data export operations."""

    def __init__(self):
        self.supabase = get_supabase_admin_client()

    async def create_export(
        self,
        user_id: str,
        export_type: ExportType = ExportType.FULL,
    ) -> Dict[str, Any]:
        """Create a new data export request.

        Args:
            user_id: The user's UUID
            export_type: Type of export to create

        Returns:
            Export creation response
        """
        export_id = str(uuid.uuid4())
        now = datetime.utcnow()

        # Create export record
        export_data = {
            "id": export_id,
            "user_id": user_id,
            "export_type": export_type.value,
            "status": ExportStatus.PENDING.value,
            "created_at": now.isoformat(),
        }

        self.supabase.table("data_exports").insert(export_data).execute()

        return {
            "export_id": export_id,
            "status": ExportStatus.PENDING,
            "estimated_time_seconds": 30  # Rough estimate
        }

    async def process_export(self, export_id: str) -> Dict[str, Any]:
        """Process a pending data export.

        This would typically run as a background task.

        Args:
            export_id: The export ID

        Returns:
            Processing result
        """
        # Update status to processing
        self.supabase.table("data_exports").update({
            "status": ExportStatus.PROCESSING.value,
        }).eq("id", export_id).execute()

        # Get export details
        result = self.supabase.table("data_exports").select("*").eq("id", export_id).single().execute()
        if not result.data:
            return {"error": "Export not found"}

        export = result.data
        user_id = export["user_id"]
        export_type = export["export_type"]

        try:
            # Gather data based on export type
            export_data = {}

            if export_type in [ExportType.FULL.value, ExportType.PROFILE_ONLY.value]:
                # Get profile
                profile = self.supabase.table("profiles").select("*").eq("id", user_id).single().execute()
                export_data["profile"] = profile.data if profile.data else {}

            if export_type in [ExportType.FULL.value, ExportType.ANALYSES_ONLY.value]:
                # Get analyses with nodes and edges
                analyses = self.supabase.table("analyses").select("*").eq("user_id", user_id).execute()
                export_data["analyses"] = []

                for analysis in (analyses.data or []):
                    analysis_data = dict(analysis)

                    # Get nodes
                    nodes = self.supabase.table("analysis_nodes").select("*").eq(
                        "analysis_id", analysis["id"]
                    ).execute()
                    analysis_data["nodes"] = nodes.data or []

                    # Get edges
                    edges = self.supabase.table("analysis_edges").select("*").eq(
                        "analysis_id", analysis["id"]
                    ).execute()
                    analysis_data["edges"] = edges.data or []

                    export_data["analyses"].append(analysis_data)

            export_data["exported_at"] = datetime.utcnow().isoformat()
            export_data["export_type"] = export_type

            # Convert to JSON
            json_content = json.dumps(export_data, default=str, indent=2)
            file_size = len(json_content.encode('utf-8'))

            # In a real implementation, we'd upload to Supabase Storage
            # For now, we'll store a reference (placeholder)
            file_path = f"exports/{user_id}/{export_id}.json"
            expires_at = datetime.utcnow() + timedelta(days=7)

            # Update export record
            self.supabase.table("data_exports").update({
                "status": ExportStatus.COMPLETED.value,
                "file_path": file_path,
                "file_size_bytes": file_size,
                "expires_at": expires_at.isoformat(),
                "completed_at": datetime.utcnow().isoformat(),
            }).eq("id", export_id).execute()

            return {
                "export_id": export_id,
                "status": ExportStatus.COMPLETED,
                "file_path": file_path,
                "file_size_bytes": file_size
            }

        except Exception as e:
            # Mark as failed
            self.supabase.table("data_exports").update({
                "status": ExportStatus.FAILED.value,
            }).eq("id", export_id).execute()

            return {"error": str(e)}

    async def get_export_status(self, user_id: str, export_id: str) -> Optional[Dict[str, Any]]:
        """Get export status and download URL if ready.

        Args:
            user_id: The user's UUID
            export_id: The export ID

        Returns:
            Export status dict or None if not found
        """
        result = self.supabase.table("data_exports").select("*").eq(
            "id", export_id
        ).eq("user_id", user_id).single().execute()

        if not result.data:
            return None

        export = result.data
        response = {
            "export_id": export["id"],
            "status": ExportStatus(export["status"]),
            "download_url": None,
            "expires_at": None,
            "file_size_bytes": export.get("file_size_bytes"),
        }

        if export["status"] == ExportStatus.COMPLETED.value:
            # In a real implementation, we'd generate a signed URL from Supabase Storage
            response["download_url"] = f"/api/user/data/export/{export_id}/download"
            if export.get("expires_at"):
                response["expires_at"] = datetime.fromisoformat(export["expires_at"].replace("Z", "+00:00"))

        return response
